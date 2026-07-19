// Draft autosave to localStorage (decision 0014). Bundled into the generated
// HTML, so imports from src/schema must stay type-only. Storage can be
// unavailable or throwing (privacy mode, quota, file:// quirks): every access
// is guarded, and any failure silently disables autosave for the session —
// the form itself must never be affected.
import { resolveMessages } from "../messages.ts";
import type { Form } from "../schema/form-schema.ts";
import {
	applySelection,
	applyTextValue,
	enumerateTargets,
	type PrefillTarget,
} from "./prefill.ts";
import type { RawAnswers } from "./visibility.ts";

export const DRAFT_PREFIX = "yaml-form:draft:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 300;

export interface DraftStore {
	/** Schedule a debounced write; call on every edit. */
	save(): void;
	/** Write pending changes immediately (pagehide). */
	flush(): void;
	/** Delete the stored draft (submit success). */
	clear(): void;
}

/**
 * `yaml-form:draft:<id ?? title>:<version ?? "">:<param signature>` — the
 * signature is the canonical serialization of the *recognized* prefill
 * parameters (decision 0013's key set): sorted by key, repeated values in
 * order, unknown parameters excluded. A different distribution URL therefore
 * produces a different key, while query noise does not fragment drafts.
 */
export function draftKey(
	form: Form,
	search: string,
	targets: Map<string, PrefillTarget> = enumerateTargets(form),
): string {
	const entries = Array.from(new URLSearchParams(search).entries()).filter(
		([key]) => targets.has(key),
	);
	entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
	const signature = new URLSearchParams(entries).toString();
	return `${DRAFT_PREFIX}${form.id ?? form.title}:${form.version ?? ""}:${signature}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function warn(message: string): void {
	console.warn(`yaml-form: ${message}`);
}

function getStorage(doc: Document): Storage | null {
	try {
		return doc.defaultView?.localStorage ?? null;
	} catch {
		return null;
	}
}

function savedAtOf(raw: string | null): number {
	if (raw === null) return Number.NaN;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isPlainObject(parsed) || typeof parsed.saved_at !== "string")
			return Number.NaN;
		return Date.parse(parsed.saved_at);
	} catch {
		return Number.NaN;
	}
}

// Bounds growth on origins shared across forms (file://): entries older than
// 30 days — or too malformed to date — are dropped at init.
function prune(storage: Storage): void {
	const doomed: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key?.startsWith(DRAFT_PREFIX)) continue;
		const savedAt = savedAtOf(storage.getItem(key));
		if (Number.isNaN(savedAt) || Date.now() - savedAt > MAX_AGE_MS) {
			doomed.push(key);
		}
	}
	for (const key of doomed) storage.removeItem(key);
}

// The stored raw-answers shape flattened to the same keys enumerateTargets
// produces: item id, `<id>.<rowKey>`, `<id>.<rowKey>.comment`.
function flattenStored(answers: Record<string, unknown>): Map<string, unknown> {
	const flat = new Map<string, unknown>();
	for (const [id, value] of Object.entries(answers)) {
		if (!isPlainObject(value)) {
			flat.set(id, value);
			continue;
		}
		for (const [rowKey, cell] of Object.entries(value)) {
			const key = `${id}.${rowKey}`;
			if (!isPlainObject(cell)) {
				flat.set(key, cell);
				continue;
			}
			if (typeof cell.value === "string") flat.set(key, cell.value);
			if (typeof cell.comment === "string")
				flat.set(`${key}.comment`, cell.comment);
		}
	}
	return flat;
}

/**
 * Apply a stored draft to the form. The draft is a full snapshot of the
 * answers at save time, so choice groups are set to exactly the stored
 * selection — absent or empty means the user had nothing selected there
 * (deliberate clearing of prefilled choices included). Stale entries
 * (unknown keys, values no longer in the choice set) are skipped with a
 * warning. Returns false — and touches nothing — when no stored key matches
 * the form, so a fully stale draft shows no "restored" notice.
 */
function applyDraftAnswers(
	doc: Document,
	targets: Map<string, PrefillTarget>,
	answers: unknown,
): boolean {
	if (!isPlainObject(answers)) return false;
	const flat = flattenStored(answers);
	if (!Array.from(flat.keys()).some((key) => targets.has(key))) return false;
	for (const [key, target] of targets) {
		if (target.kind === "constant") continue;
		const stored = flat.get(key);
		if (target.kind === "text") {
			if (typeof stored === "string") applyTextValue(doc, key, stored);
			continue;
		}
		const values =
			typeof stored === "string"
				? [stored]
				: Array.isArray(stored)
					? stored.filter((v): v is string => typeof v === "string")
					: [];
		const valid = values.filter((v) => target.values.has(v));
		for (const v of values) {
			if (!target.values.has(v))
				warn(`ignoring stale draft value "${v}" for "${key}"`);
		}
		applySelection(doc, key, new Set(valid));
	}
	return true;
}

/**
 * Set up autosave for an initialized form: prune stale drafts, restore a
 * matching one (with the announced, discardable notice), and return the
 * store `initForm` drives on edit / pagehide / submit success. Returns null
 * when `autosave: false` or storage is unavailable. `resetForm` puts the
 * fields back into the pristine prefilled state; discard uses it instead of
 * a reload, which some file:// setups silently refuse — leaving the restored
 * values in the DOM to be re-saved by the next edit.
 */
export function initDraft(
	doc: Document,
	form: Form,
	readAnswers: () => RawAnswers,
	resetForm?: () => void,
): DraftStore | null {
	if (!form.autosave) return null;
	const storage = getStorage(doc);
	if (!storage) return null;
	const win = doc.defaultView;
	const targets = enumerateTargets(form);
	const constantIds = new Set(
		form.items
			.filter((item) => item.type === "constant")
			.map((item) => item.id),
	);

	let disabled = false;
	let restored = false;
	let dirty = false;
	let timer: number | null = null;
	const key = draftKey(form, win?.location?.search ?? "", targets);

	try {
		prune(storage);
		const raw = storage.getItem(key);
		if (raw !== null) {
			const parsed: unknown = JSON.parse(raw);
			if (isPlainObject(parsed)) {
				restored = applyDraftAnswers(doc, targets, parsed.answers);
			}
		}
	} catch {
		disabled = true;
	}

	const cancelTimer = (): void => {
		if (timer !== null) {
			win?.clearTimeout(timer);
			timer = null;
		}
	};

	const write = (): void => {
		if (disabled || !dirty) return;
		const answers: RawAnswers = {};
		for (const [id, value] of Object.entries(readAnswers())) {
			if (!constantIds.has(id)) answers[id] = value;
		}
		try {
			storage.setItem(
				key,
				JSON.stringify({ saved_at: new Date().toISOString(), answers }),
			);
			dirty = false;
		} catch {
			disabled = true;
		}
	};

	const store: DraftStore = {
		save() {
			if (disabled || !win) return;
			dirty = true;
			cancelTimer();
			timer = win.setTimeout(() => {
				timer = null;
				write();
			}, DEBOUNCE_MS);
		},
		flush() {
			cancelTimer();
			write();
		},
		clear() {
			// A cleared draft must stay cleared: drop the pending debounce
			// timer and the dirty mark so a later pagehide flush cannot
			// resurrect the just-submitted answers.
			cancelTimer();
			dirty = false;
			try {
				storage.removeItem(key);
			} catch {
				// already gone or storage revoked — nothing to recover
			}
		},
	};

	if (restored) {
		const notice = doc.querySelector("#yaml-form-draft-notice");
		const discard = notice?.querySelector(".draft-discard");
		notice?.removeAttribute("hidden");
		discard?.addEventListener("click", () => {
			store.clear();
			// Back to the pristine prefilled state in place — no reload, so it
			// works on file:// too and the restored values cannot linger in the
			// DOM and resurrect via the next autosave.
			resetForm?.();
			// The notice (role="status") becomes the confirmation feedback;
			// autosave keeps working, so continued edits are preserved again.
			const messageEl = notice?.querySelector(".draft-notice-message");
			if (messageEl)
				messageEl.textContent = resolveMessages(form).draft_discarded;
			discard.remove();
		});
	}

	win?.addEventListener("pagehide", () => {
		store.flush();
	});
	return store;
}
