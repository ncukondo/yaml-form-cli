// Submit orchestration: payload building and the success/failure UI flow.
// Runs in the browser (bundled into the generated HTML); schema imports must
// stay type-only.
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

export const DEFAULT_SUCCESS_MESSAGE = "Your response has been submitted.";
export const SUBMIT_FAILURE_MESSAGE = "Submission failed. Please try again.";

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
function readGenerator(doc: Document): string {
	const el = doc.querySelector(
		'script[type="application/json"]#yaml-form-meta',
	);
	if (!el?.textContent) return "yaml-form";
	try {
		const meta = JSON.parse(el.textContent) as { generator?: unknown };
		return typeof meta.generator === "string" ? meta.generator : "yaml-form";
	} catch {
		return "yaml-form";
	}
}

function defaultEnv(doc: Document): ActionEnv {
	const win = doc.defaultView;
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

function showSuccess(doc: Document, form: Form): void {
	doc.querySelector("form#yaml-form")?.setAttribute("hidden", "");
	const successEl = doc.querySelector("#yaml-form-success");
	if (!successEl) return;
	successEl.textContent = form.post_submit?.message ?? DEFAULT_SUCCESS_MESSAGE;
	successEl.removeAttribute("hidden");
}

export async function performSubmit(
	doc: Document,
	form: Form,
	answers: SubmitAnswers,
	envOverride?: Partial<ActionEnv>,
): Promise<void> {
	const env = { ...defaultEnv(doc), ...envOverride };
	const errorEl = doc.querySelector("#yaml-form-error");
	if (errorEl) {
		errorEl.textContent = "";
		errorEl.setAttribute("hidden", "");
	}
	const payload = buildPayload(form, answers, {
		generator: readGenerator(doc),
	});
	const result = await runActions(form.actions, payload, form, env);
	if (result.ok) {
		showSuccess(doc, form);
	} else if (errorEl) {
		errorEl.textContent = SUBMIT_FAILURE_MESSAGE;
		errorEl.removeAttribute("hidden");
	}
}
