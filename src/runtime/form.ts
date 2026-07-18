// Browser-side runtime, bundled and inlined into the generated HTML.
// Imports from src/schema must stay type-only so the bundle carries no
// server-side dependencies.
import type { Form, FormItem } from "../schema/form-schema.ts";

export type Answers = Record<string, string | string[]>;

export interface RequiredFailure {
	itemId: string;
	message: string;
}

function attrEscape(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function readFormData(doc: Document): Form {
	const el = doc.querySelector(
		'script[type="application/json"]#yaml-form-data',
	);
	if (!el?.textContent)
		throw new Error("yaml-form: embedded form data missing");
	return JSON.parse(el.textContent) as Form;
}

function inputsByName(doc: Document, name: string): HTMLInputElement[] {
	return Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${attrEscape(name)}"]`),
	);
}

function readItemValue(
	doc: Document,
	item: FormItem,
): string | string[] | undefined {
	switch (item.type) {
		case "short_text":
		case "long_text": {
			const el = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(
				`[name="${attrEscape(item.id)}"]`,
			);
			return el?.value ?? "";
		}
		case "choice": {
			const selected = inputsByName(doc, item.id)
				.filter((el) => el.checked)
				.map((el) => el.value);
			if (item.multiple) return selected;
			return selected[0];
		}
		default:
			// constant is read from the form data; tables land with task 0005
			return undefined;
	}
}

function isAnswered(value: string | string[] | undefined): boolean {
	if (value === undefined) return false;
	if (Array.isArray(value)) return value.length > 0;
	return value.trim() !== "";
}

// Visibility (visible_when) is task 0004; until then every item is visible.
function isItemVisible(_doc: Document, _item: FormItem): boolean {
	return true;
}

export function validateRequired(doc: Document): RequiredFailure[] {
	const form = readFormData(doc);
	const failures: RequiredFailure[] = [];
	for (const item of form.items) {
		if (!item.required || item.type === "constant") continue;
		if (item.type === "choice_table" || item.type === "rubric") continue;
		if (!isItemVisible(doc, item)) continue;
		if (!isAnswered(readItemValue(doc, item))) {
			failures.push({
				itemId: item.id,
				message: `"${item.title}" is required.`,
			});
		}
	}
	return failures;
}

export function collectAnswers(doc: Document): Answers {
	const form = readFormData(doc);
	const answers: Answers = {};
	for (const item of form.items) {
		if (!isItemVisible(doc, item)) continue;
		switch (item.type) {
			case "constant":
				answers[item.id] = item.value;
				break;
			case "short_text":
			case "long_text": {
				const value = readItemValue(doc, item);
				answers[item.id] = typeof value === "string" ? value : "";
				break;
			}
			case "choice": {
				const value = readItemValue(doc, item);
				if (isAnswered(value) && value !== undefined) {
					answers[item.id] = value;
				}
				break;
			}
			default:
				// choice_table / rubric collection lands with task 0005
				break;
		}
	}
	return answers;
}

function showErrors(doc: Document, failures: RequiredFailure[]): void {
	const form = readFormData(doc);
	for (const item of form.items) {
		const el = doc.querySelector(`[data-error-for="${attrEscape(item.id)}"]`);
		if (!el) continue;
		const failure = failures.find((f) => f.itemId === item.id);
		if (failure) {
			el.textContent = failure.message;
			el.removeAttribute("hidden");
		} else {
			el.textContent = "";
			el.setAttribute("hidden", "");
		}
	}
}

export function initForm(doc: Document): void {
	const formEl = doc.querySelector("form#yaml-form");
	if (!formEl) return;
	formEl.addEventListener("submit", (event) => {
		event.preventDefault();
		const failures = validateRequired(doc);
		showErrors(doc, failures);
		if (failures.length > 0) {
			doc
				.querySelector(
					`[data-item-id="${attrEscape(failures[0]?.itemId ?? "")}"]`,
				)
				?.scrollIntoView?.({ behavior: "smooth", block: "center" });
			return;
		}
		// Submit actions (log/post/mailto) land with task 0006.
		console.log("yaml-form answers", collectAnswers(doc));
	});
}
