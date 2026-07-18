// Browser-side runtime, bundled and inlined into the generated HTML.
// Imports from src/schema must stay type-only so the bundle carries no
// server-side dependencies. src/generate/ids.ts is a pure string helper and
// safe to bundle; it keeps the element-id conventions in one place.
import { errorId } from "../generate/ids.ts";
import { formatMessage, resolveMessages } from "../messages.ts";
import type {
	ChoiceTableItem,
	Form,
	FormItem,
	RubricItem,
} from "../schema/form-schema.ts";
import { initDraft } from "./draft.ts";
import { applyPrefill } from "./prefill.ts";
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

function scrollBehavior(doc: Document): "auto" | "smooth" {
	return doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")
		.matches
		? "auto"
		: "smooth";
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
	const messages = resolveMessages(form);
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
						message: formatMessage(messages.required_row, {
							row: row.title,
							title: item.title,
						}),
					});
				}
			}
			continue;
		}
		if (!isAnswered(readItemValue(doc, item))) {
			failures.push({
				itemId: item.id,
				message: formatMessage(messages.required, { title: item.title }),
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

// Elements that carry aria-invalid for a failure key: the choice group
// wrapper when the item renders one, otherwise every control named after the
// key (text inputs/textareas, a table row's cell inputs).
function invalidTargets(doc: Document, key: string): Element[] {
	const group = doc.querySelector(
		`[data-item-id="${attrEscape(key)}"] [role="group"]`,
	);
	if (group) return [group];
	return Array.from(doc.querySelectorAll(`[name="${attrEscape(key)}"]`));
}

function addDescribedBy(el: Element, id: string): void {
	const tokens = (el.getAttribute("aria-describedby") ?? "")
		.split(/\s+/)
		.filter(Boolean);
	if (!tokens.includes(id)) tokens.push(id);
	el.setAttribute("aria-describedby", tokens.join(" "));
}

function removeDescribedBy(el: Element, id: string): void {
	const tokens = (el.getAttribute("aria-describedby") ?? "")
		.split(/\s+/)
		.filter((token) => token !== "" && token !== id);
	if (tokens.length === 0) el.removeAttribute("aria-describedby");
	else el.setAttribute("aria-describedby", tokens.join(" "));
}

function setInvalidState(doc: Document, key: string, invalid: boolean): void {
	for (const el of invalidTargets(doc, key)) {
		if (invalid) {
			el.setAttribute("aria-invalid", "true");
			addDescribedBy(el, errorId(key));
		} else {
			el.removeAttribute("aria-invalid");
			removeDescribedBy(el, errorId(key));
		}
	}
}

// Table-row slots are generated without announcement attributes; make every
// slot an addressable live region before the first submit can populate it.
function initErrorSlots(doc: Document): void {
	for (const el of Array.from(doc.querySelectorAll("[data-error-for]"))) {
		const key = el.getAttribute("data-error-for");
		if (!key) continue;
		if (!el.id) el.id = errorId(key);
		if (!el.hasAttribute("role")) el.setAttribute("role", "alert");
	}
}

// Live clearing while the user edits: the failure key doubles as the control
// name, so the edited control names exactly the error to retract. Errors only
// come back on the next submit — no re-validation mid-edit.
function clearFieldError(doc: Document, key: string): void {
	const slot = doc.querySelector(`[data-error-for="${attrEscape(key)}"]`);
	if (!slot || slot.hasAttribute("hidden")) return;
	slot.textContent = "";
	slot.setAttribute("hidden", "");
	setInvalidState(doc, key, false);
}

function showErrors(doc: Document, failures: RequiredFailure[]): void {
	// Covers item-level slots and the per-row slots inside tables.
	for (const el of Array.from(doc.querySelectorAll("[data-error-for]"))) {
		const key = el.getAttribute("data-error-for");
		if (key === null) continue;
		const failure = failures.find((f) => failureKey(f) === key);
		if (failure) {
			el.textContent = failure.message;
			el.removeAttribute("hidden");
		} else {
			el.textContent = "";
			el.setAttribute("hidden", "");
		}
		setInvalidState(doc, key, failure !== undefined);
	}
}

export function initForm(doc: Document): void {
	const formEl = doc.querySelector("form#yaml-form");
	if (!formEl) return;
	initTableScroll(doc);
	// Prefill runs before the evaluator is built and before the first
	// visibility pass, so rules see prefilled answers on first render.
	const form = applyPrefill(doc, readFormData(doc));
	initErrorSlots(doc);
	const visibility = createVisibilityEvaluator(form);
	const refreshVisibility = () =>
		applyVisibility(doc, visibility.compute(readRawAnswers(doc, form)));
	// Draft restore runs after prefill (draft overlays it) and before the
	// first refreshVisibility() below, so rules see restored answers.
	const draft = initDraft(doc, form, () => readRawAnswers(doc, form));
	const onEdit = (event: Event) => {
		refreshVisibility();
		draft?.save();
		const name = (event.target as Element | null)?.getAttribute?.("name");
		if (name) clearFieldError(doc, name);
	};
	formEl.addEventListener("change", onEdit);
	// text fields fire "input" per keystroke; "change" only on commit
	formEl.addEventListener("input", onEdit);
	// "Clear selection" on optional single-choice items: unticking radios is
	// impossible for the user, so the generator emits a .choice-clear button.
	formEl.addEventListener("click", (event) => {
		const button = (event.target as Element | null)?.closest?.(".choice-clear");
		const itemId = button
			?.closest("[data-item-id]")
			?.getAttribute("data-item-id");
		if (!itemId) return;
		for (const input of inputsByName(doc, itemId)) input.checked = false;
		refreshVisibility();
		draft?.save();
	});
	refreshVisibility();
	formEl.addEventListener("submit", (event) => {
		event.preventDefault();
		const failures = validateRequired(doc);
		showErrors(doc, failures);
		const first = failures[0];
		if (first) {
			doc
				.querySelector(`[data-item-id="${attrEscape(first.itemId)}"]`)
				?.scrollIntoView?.({ behavior: scrollBehavior(doc), block: "center" });
			// Any failing control shares its failure key as the input name; a
			// choice group's first radio/checkbox doubles as the focus target.
			doc
				.querySelector<HTMLElement>(`[name="${attrEscape(failureKey(first))}"]`)
				?.focus?.({ preventScroll: true });
			return;
		}
		// Mailto "success" only means the mail client opened; the user may still
		// cancel the mail, so those drafts survive until pruned or discarded.
		const clearDraft = form.actions.some((a) => a.type === "mailto")
			? undefined
			: () => draft?.clear();
		void performSubmit(
			doc,
			readFormData(doc),
			collectAnswers(doc),
			undefined,
			clearDraft,
		);
	});
}
