// Browser-side runtime, bundled and inlined into the generated HTML.
// Imports from src/schema must stay type-only so the bundle carries no
// server-side dependencies.
import type {
	ChoiceTableItem,
	Form,
	FormItem,
	RubricItem,
} from "../schema/form-schema.ts";
import { performSubmit } from "./submit.ts";
import { initTableScroll } from "./table-scroll.ts";
import {
	applyVisibility,
	createVisibilityEvaluator,
	type RawAnswers,
} from "./visibility.ts";

export type TableRowAnswer =
	| string
	| string[]
	| { value?: string; comment?: string };
export type AnswerValue = string | string[] | Record<string, TableRowAnswer>;
export type Answers = Record<string, AnswerValue>;

export interface RequiredFailure {
	itemId: string;
	/** Set for choice_table / rubric failures: the unanswered row. */
	rowKey?: string;
	message: string;
}

function failureKey(failure: RequiredFailure): string {
	return failure.rowKey === undefined
		? failure.itemId
		: `${failure.itemId}.${failure.rowKey}`;
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
			// constant is read from the form data; tables via readTableValue
			return undefined;
	}
}

function readRowSelection(
	doc: Document,
	item: ChoiceTableItem | RubricItem,
	rowKey: string,
): string[] {
	return inputsByName(doc, `${item.id}.${rowKey}`)
		.filter((el) => el.checked)
		.map((el) => el.value);
}

function readRowComment(
	doc: Document,
	item: RubricItem,
	rowKey: string,
): string {
	const el = doc.querySelector<HTMLTextAreaElement>(
		`[name="${attrEscape(`${item.id}.${rowKey}.comment`)}"]`,
	);
	return el?.value ?? "";
}

function readTableValue(
	doc: Document,
	item: ChoiceTableItem | RubricItem,
): Record<string, TableRowAnswer> {
	const rows: Record<string, TableRowAnswer> = {};
	for (const row of item.items) {
		const selected = readRowSelection(doc, item, row.key);
		if (item.type === "choice_table" && item.multiple) {
			if (selected.length > 0) rows[row.key] = selected;
		} else if (item.type === "rubric" && item.comment_per_row) {
			const value = selected[0];
			const comment = readRowComment(doc, item, row.key);
			if (value === undefined && comment.trim() === "") continue;
			const entry: { value?: string; comment?: string } = {};
			if (value !== undefined) entry.value = value;
			if (comment.trim() !== "") entry.comment = comment;
			rows[row.key] = entry;
		} else if (selected[0] !== undefined) {
			rows[row.key] = selected[0];
		}
	}
	return rows;
}

function isAnswered(value: string | string[] | undefined): boolean {
	if (value === undefined) return false;
	if (Array.isArray(value)) return value.length > 0;
	return value.trim() !== "";
}

// Answers of every item as rules see them, regardless of visibility; the
// visibility pass itself excludes hidden items' answers.
function readRawAnswers(doc: Document, form: Form): RawAnswers {
	const raw: RawAnswers = {};
	for (const item of form.items) {
		if (item.type === "constant") {
			raw[item.id] = item.value;
			continue;
		}
		if (item.type === "choice_table" || item.type === "rubric") {
			raw[item.id] = readTableValue(doc, item) as RawAnswers[string];
			continue;
		}
		const value = readItemValue(doc, item);
		if (value !== undefined) raw[item.id] = value;
	}
	return raw;
}

// Reflects the hidden attribute maintained by the visibility pass (initForm
// and change events); items without a rule are always visible.
function isItemVisible(doc: Document, item: FormItem): boolean {
	if (item.visible_when === undefined) return true;
	const el = doc.querySelector(`[data-item-id="${attrEscape(item.id)}"]`);
	return el ? !el.hasAttribute("hidden") : true;
}

export function validateRequired(doc: Document): RequiredFailure[] {
	const form = readFormData(doc);
	const failures: RequiredFailure[] = [];
	for (const item of form.items) {
		if (!item.required || item.type === "constant") continue;
		if (!isItemVisible(doc, item)) continue;
		if (item.type === "choice_table" || item.type === "rubric") {
			// required = every row has a selection; a comment alone is not enough
			for (const row of item.items) {
				if (readRowSelection(doc, item, row.key).length === 0) {
					failures.push({
						itemId: item.id,
						rowKey: row.key,
						message: `"${row.title}" in "${item.title}" is required.`,
					});
				}
			}
			continue;
		}
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
			case "choice_table":
			case "rubric": {
				const rows = readTableValue(doc, item);
				if (Object.keys(rows).length > 0) {
					answers[item.id] = rows;
				}
				break;
			}
		}
	}
	return answers;
}

function showErrors(doc: Document, failures: RequiredFailure[]): void {
	// Covers item-level slots and the per-row slots inside tables.
	for (const el of Array.from(doc.querySelectorAll("[data-error-for]"))) {
		const key = el.getAttribute("data-error-for");
		const failure = failures.find((f) => failureKey(f) === key);
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
	initTableScroll(doc);
	const form = readFormData(doc);
	const visibility = createVisibilityEvaluator(form);
	const refreshVisibility = () =>
		applyVisibility(doc, visibility.compute(readRawAnswers(doc, form)));
	formEl.addEventListener("change", refreshVisibility);
	// text fields fire "input" per keystroke; "change" only on commit
	formEl.addEventListener("input", refreshVisibility);
	refreshVisibility();
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
		void performSubmit(doc, readFormData(doc), collectAnswers(doc));
	});
}
