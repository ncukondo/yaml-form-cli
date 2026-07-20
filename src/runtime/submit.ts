// Submit orchestration: payload building and the success/failure UI flow.
// Runs in the browser (bundled into the generated HTML); schema imports must
// stay type-only.
import { type Messages, resolveMessages } from "../messages.ts";
import type { Form } from "../schema/form-schema.ts";
import { type ActionEnv, runActions } from "./actions.ts";

// Answer shapes across all item types, including the nested table/rubric
// shapes that land with task 0005.
export type AnswerCell =
	| string
	| string[]
	| { value?: string; comment?: string };
export type AnswerValue = string | string[] | Record<string, AnswerCell>;
export type SubmitAnswers = Record<string, AnswerValue>;

export interface SubmitPayload {
	payload_version: number;
	generator: string;
	form: { title: string; id?: string; version?: string };
	submitted_at: string;
	answers: SubmitAnswers;
}

// ISO 8601 with the client's local UTC offset (e.g. 2026-07-18T21:34:56+09:00).
export function formatLocalIso(date: Date): string {
	const pad = (n: number, width = 2) => String(n).padStart(width, "0");
	const offsetMin = -date.getTimezoneOffset();
	const sign = offsetMin >= 0 ? "+" : "-";
	const abs = Math.abs(offsetMin);
	return (
		`${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
		`${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
	);
}

export function buildPayload(
	form: Form,
	answers: SubmitAnswers,
	options: { generator: string; now?: Date },
): SubmitPayload {
	const formInfo: SubmitPayload["form"] = { title: form.title };
	if (form.id !== undefined) formInfo.id = form.id;
	if (form.version !== undefined) formInfo.version = form.version;
	return {
		payload_version: 1,
		generator: options.generator,
		form: formInfo,
		submitted_at: formatLocalIso(options.now ?? new Date()),
		answers,
	};
}

// The generator name/version is stamped into the page at generation time so
// the (cacheable) runtime bundle stays version-independent.
function readGenerator(root: Element): string {
	const el = root.querySelector(
		'script[type="application/json"].yaml-form-meta',
	);
	if (!el?.textContent) return "yaml-form";
	try {
		const meta = JSON.parse(el.textContent) as { generator?: unknown };
		return typeof meta.generator === "string" ? meta.generator : "yaml-form";
	} catch {
		return "yaml-form";
	}
}

function defaultEnv(root: Element): ActionEnv {
	const win = root.ownerDocument?.defaultView ?? null;
	return {
		log: (...args) => {
			win?.console.log(...args);
		},
		fetch: (url, init) => {
			if (!win?.fetch) {
				return Promise.reject(new Error("fetch is not available"));
			}
			return win.fetch(url, init);
		},
		openUrl: (url) => {
			if (win) win.location.href = url;
		},
	};
}

// UI state machine for one submit attempt: idle → pending → success | failure
// (failure returns the UI to a re-submittable idle-with-error state).
type SubmitState =
	| { kind: "pending" }
	| { kind: "success" }
	| { kind: "failure" };

function submitButton(root: Element): HTMLButtonElement | null {
	return root.querySelector('form button[type="submit"]');
}

function setError(root: Element, message: string | null): void {
	const errorEl = root.querySelector(".form-error");
	if (!errorEl) return;
	if (message === null) {
		errorEl.textContent = "";
		errorEl.setAttribute("hidden", "");
	} else {
		errorEl.textContent = message;
		errorEl.removeAttribute("hidden");
	}
}

function showSuccess(root: Element, form: Form, messages: Messages): void {
	root.querySelector("form")?.setAttribute("hidden", "");
	// Keep the form title as context; the fill-in instructions are done with.
	root.querySelector(".form-description")?.setAttribute("hidden", "");
	// The restore notice belongs to the editing session; leaving it up would
	// offer a "discard draft" reload from the success screen.
	root.querySelector(".draft-notice")?.setAttribute("hidden", "");
	const successEl = root.querySelector<HTMLElement>(".form-success");
	if (!successEl) return;
	// Write into the message slot so the checkmark icon markup survives; fall
	// back to the section itself for documents without the slot.
	// post_submit.message predates messages.submit_success and wins (0010).
	const messageEl =
		successEl.querySelector<HTMLElement>(".success-message") ?? successEl;
	messageEl.textContent = form.post_submit?.message ?? messages.submit_success;
	successEl.removeAttribute("hidden");
	// The form (and the focused Submit button) just got hidden; without this,
	// focus falls back to <body> and screen readers lose their place.
	successEl.focus();
}

function applySubmitState(
	root: Element,
	form: Form,
	messages: Messages,
	state: SubmitState,
	idleLabel: string,
): void {
	const button = submitButton(root);
	switch (state.kind) {
		case "pending":
			if (button) {
				button.disabled = true;
				button.textContent = messages.submitting;
			}
			setError(root, null);
			break;
		case "failure":
			if (button) {
				button.disabled = false;
				button.textContent = idleLabel;
			}
			setError(root, messages.submit_failed);
			break;
		case "success":
			if (button) {
				button.disabled = false;
				button.textContent = idleLabel;
			}
			showSuccess(root, form, messages);
			break;
	}
}

// Roots with a submission in flight; blocks re-entry from a second submit
// event (programmatic submits bypass the disabled button). Keyed per root so
// one form's in-flight submit never blocks another on the same page.
const pendingRoots = new WeakSet<Element>();

export async function performSubmit(
	root: Element,
	form: Form,
	answers: SubmitAnswers,
	envOverride?: Partial<ActionEnv>,
	/** Called once when all actions succeed (initForm clears the draft here). */
	onSuccess?: () => void,
): Promise<void> {
	if (pendingRoots.has(root)) return;
	pendingRoots.add(root);
	const env = { ...defaultEnv(root), ...envOverride };
	const messages = resolveMessages(form);
	const idleLabel = submitButton(root)?.textContent ?? messages.submit;
	applySubmitState(root, form, messages, { kind: "pending" }, idleLabel);
	try {
		const payload = buildPayload(form, answers, {
			generator: readGenerator(root),
		});
		const result = await runActions(form.actions, payload, form, env);
		if (result.ok) onSuccess?.();
		applySubmitState(
			root,
			form,
			messages,
			{ kind: result.ok ? "success" : "failure" },
			idleLabel,
		);
	} finally {
		pendingRoots.delete(root);
	}
}
