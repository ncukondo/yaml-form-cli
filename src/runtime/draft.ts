// Draft autosave to localStorage (decision 0014). Bundled into the generated
// HTML, so imports from src/schema must stay type-only. Storage can be
// unavailable or throwing (privacy mode, quota, file:// quirks): every access
// is guarded, and any failure silently disables autosave for the session —
// the form itself must never be affected.
import type { Form } from "../schema/form-schema.ts";
import {
	applyChoiceValues,
	applyTextValue,
	enumerateTargets,
} from "./prefill.ts";
import type { RawAnswers } from "./visibility.ts";

export const DRAFT_PREFIX = "yaml-form:draft:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 300;

export interface DraftStore {
	/** Whether a draft was found and applied at init. */
	restored: boolean;
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
export function draftKey(form: Form, search: string): string {
	const targets = enumerateTargets(form);
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

// Restore degrades exactly like prefill: apply what still matches the form,
// skip unknown ids and out-of-set values, never break rendering. Constants
// are never applied from a draft — their values come from the YAML/URL.
function applyDraftAnswers(doc: Document, form: Form, answers: unknown): void {
	if (!isPlainObject(answers)) return;
	const targets = enumerateTargets(form);
	const apply = (key: string, value: unknown): void => {
		const target = targets.get(key);
		if (!target) return;
		if (target.kind === "text" && typeof value === "string") {
			applyTextValue(doc, key, value);
			return;
		}
		if (target.kind !== "choice") return;
		const values =
			typeof value === "string"
				? [value]
				: Array.isArray(value)
					? value.filter((v): v is string => typeof v === "string")
					: [];
		if (values.length > 0) applyChoiceValues(doc, key, target, values, false);
	};
	for (const [id, value] of Object.entries(answers)) {
		if (!isPlainObject(value)) {
			apply(id, value);
			continue;
		}
		for (const [rowKey, cell] of Object.entries(value)) {
			const key = `${id}.${rowKey}`;
			if (!isPlainObject(cell)) {
				apply(key, cell);
				continue;
			}
			if (typeof cell.value === "string") apply(key, cell.value);
			if (typeof cell.comment === "string")
				apply(`${key}.comment`, cell.comment);
		}
	}
}

function noticeElements(doc: Document): {
	notice: Element | null;
	discard: Element | null;
} {
	const notice = doc.querySelector("#yaml-form-draft-notice");
	return { notice, discard: notice?.querySelector(".draft-discard") ?? null };
}

/**
 * Set up autosave for an initialized form: prune stale drafts, restore a
 * matching one (with the announced, discardable notice), and return the
 * store `initForm` drives on edit / pagehide / submit success. Returns null
 * when `autosave: false` or storage is unavailable.
 */
export function initDraft(
	doc: Document,
	form: Form,
	readAnswers: () => RawAnswers,
): DraftStore | null {
	if (!form.autosave) return null;
	const storage = getStorage(doc);
	if (!storage) return null;
	const win = doc.defaultView;

	let disabled = false;
	let restored = false;
	let dirty = false;
	let timer: number | null = null;
	const key = draftKey(form, win?.location?.search ?? "");

	try {
		prune(storage);
		const raw = storage.getItem(key);
		if (raw !== null) {
			const parsed: unknown = JSON.parse(raw);
			if (isPlainObject(parsed) && isPlainObject(parsed.answers)) {
				applyDraftAnswers(doc, form, parsed.answers);
				restored = true;
			}
		}
	} catch {
		disabled = true;
	}

	const write = (): void => {
		if (disabled || !dirty) return;
		const constantIds = new Set(
			form.items
				.filter((item) => item.type === "constant")
				.map((item) => item.id),
		);
		const answers: RawAnswers = {};
		for (const [id, value] of Object.entries(readAnswers())) {
			if (!constantIds.has(id)) answers[id] = value;
		}
		try {
			storage.setItem(
				key,
				JSON.stringify({ saved_at: new Date().toISOString(), answers }),
			);
		} catch {
			disabled = true;
		}
	};

	const store: DraftStore = {
		restored,
		save() {
			if (disabled || !win) return;
			dirty = true;
			if (timer !== null) win.clearTimeout(timer);
			timer = win.setTimeout(() => {
				timer = null;
				write();
			}, DEBOUNCE_MS);
		},
		flush() {
			if (timer !== null) {
				win?.clearTimeout(timer);
				timer = null;
			}
			write();
		},
		clear() {
			try {
				storage.removeItem(key);
			} catch {
				// already gone or storage revoked — nothing to recover
			}
		},
	};

	if (restored) {
		const { notice, discard } = noticeElements(doc);
		notice?.removeAttribute("hidden");
		discard?.addEventListener("click", () => {
			store.clear();
			// Stop re-saving the restored values, then reload: same URL, no
			// draft → pristine prefilled state.
			disabled = true;
			notice?.setAttribute("hidden", "");
			try {
				win?.location.reload();
			} catch {
				// happy-dom / file:// may refuse; the visible state is already reset
			}
		});
	}

	win?.addEventListener("pagehide", () => {
		store.flush();
	});
	return store;
}
