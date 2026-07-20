// Browser-side runtime, bundled and inlined into the generated HTML.
// Imports from src/schema must stay type-only. src/generate/ids.ts is a pure
// string helper and safe to bundle; it keeps the element-id conventions in one
// place. Everything is scoped to a root element (decision 0019): a document can
// host more than one form, so nothing is looked up document-wide.
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

function scrollBehavior(root: Element): "auto" | "smooth" {
	return root.ownerDocument?.defaultView?.matchMedia?.(
		"(prefers-reduced-motion: reduce)",
	).matches
		? "auto"
		: "smooth";
}

export function readFormData(root: ParentNode): Form {
	const el = root.querySelector(
		'script[type="application/json"].yaml-form-data',
	);
	if (!el?.textContent)
		throw new Error("yaml-form: embedded form data missing");
	return JSON.parse(el.textContent) as Form;
}

function inputsByName(root: ParentNode, name: string): HTMLInputElement[] {
	return Array.from(
		root.querySelectorAll<HTMLInputElement>(
			`input[name="${attrEscape(name)}"]`,
		),
	);
}

function readItemValue(
	root: ParentNode,
	item: FormItem,
): string | string[] | undefined {
	switch (item.type) {
		case "short_text":
		case "long_text": {
			const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
				`[name="${attrEscape(item.id)}"]`,
			);
			return el?.value ?? "";
		}
		case "choice": {
			const selected = inputsByName(root, item.id)
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
	root: ParentNode,
	item: ChoiceTableItem | RubricItem,
	rowKey: string,
): string[] {
	return inputsByName(root, `${item.id}.${rowKey}`)
		.filter((el) => el.checked)
		.map((el) => el.value);
}

function readRowComment(
	root: ParentNode,
	item: RubricItem,
	rowKey: string,
): string {
	const el = root.querySelector<HTMLTextAreaElement>(
		`[name="${attrEscape(`${item.id}.${rowKey}.comment`)}"]`,
	);
	return el?.value ?? "";
}

function readTableValue(
	root: ParentNode,
	item: ChoiceTableItem | RubricItem,
): Record<string, TableRowAnswer> {
	const rows: Record<string, TableRowAnswer> = {};
	for (const row of item.items) {
		const selected = readRowSelection(root, item, row.key);
		if (item.type === "choice_table" && item.multiple) {
			if (selected.length > 0) rows[row.key] = selected;
		} else if (item.type === "rubric" && item.comment_per_row) {
			const value = selected[0];
			const comment = readRowComment(root, item, row.key);
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
function readRawAnswers(root: ParentNode, form: Form): RawAnswers {
	const raw: RawAnswers = {};
	for (const item of form.items) {
		if (item.type === "constant") {
			raw[item.id] = item.value;
			continue;
		}
		if (item.type === "choice_table" || item.type === "rubric") {
			raw[item.id] = readTableValue(root, item) as RawAnswers[string];
			continue;
		}
		const value = readItemValue(root, item);
		if (value !== undefined) raw[item.id] = value;
	}
	return raw;
}

// Reflects the hidden attribute maintained by the visibility pass (initForm
// and change events); items without a rule are always visible.
function isItemVisible(root: ParentNode, item: FormItem): boolean {
	if (item.visible_when === undefined) return true;
	const el = root.querySelector(`[data-item-id="${attrEscape(item.id)}"]`);
	return el ? !el.hasAttribute("hidden") : true;
}

export function validateRequired(root: ParentNode): RequiredFailure[] {
	const form = readFormData(root);
	const messages = resolveMessages(form);
	const failures: RequiredFailure[] = [];
	for (const item of form.items) {
		if (!item.required || item.type === "constant") continue;
		if (!isItemVisible(root, item)) continue;
		if (item.type === "choice_table" || item.type === "rubric") {
			// required = every row has a selection; a comment alone is not enough
			for (const row of item.items) {
				if (readRowSelection(root, item, row.key).length === 0) {
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
		if (!isAnswered(readItemValue(root, item))) {
			failures.push({
				itemId: item.id,
				message: formatMessage(messages.required, { title: item.title }),
			});
		}
	}
	return failures;
}

export function collectAnswers(root: ParentNode): Answers {
	const form = readFormData(root);
	const answers: Answers = {};
	for (const item of form.items) {
		if (!isItemVisible(root, item)) continue;
		switch (item.type) {
			case "constant":
				answers[item.id] = item.value;
				break;
			case "short_text":
			case "long_text": {
				const value = readItemValue(root, item);
				answers[item.id] = typeof value === "string" ? value : "";
				break;
			}
			case "choice": {
				const value = readItemValue(root, item);
				if (isAnswered(value) && value !== undefined) {
					answers[item.id] = value;
				}
				break;
			}
			case "choice_table":
			case "rubric": {
				const rows = readTableValue(root, item);
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
function invalidTargets(root: ParentNode, key: string): Element[] {
	const group = root.querySelector(
		`[data-item-id="${attrEscape(key)}"] [role="group"]`,
	);
	if (group) return [group];
	return Array.from(root.querySelectorAll(`[name="${attrEscape(key)}"]`));
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

// The root element's id is the per-form id prefix (decision 0019): a11y ids
// stay unique across forms on one page. "" for an id-less standalone form.
function setInvalidState(root: Element, key: string, invalid: boolean): void {
	for (const el of invalidTargets(root, key)) {
		if (invalid) {
			el.setAttribute("aria-invalid", "true");
			addDescribedBy(el, errorId(root.id, key));
		} else {
			el.removeAttribute("aria-invalid");
			removeDescribedBy(el, errorId(root.id, key));
		}
	}
}

// Table-row slots are generated without announcement attributes; make every
// slot an addressable live region before the first submit can populate it.
function initErrorSlots(root: Element): void {
	for (const el of Array.from(root.querySelectorAll("[data-error-for]"))) {
		const key = el.getAttribute("data-error-for");
		if (!key) continue;
		if (!el.id) el.id = errorId(root.id, key);
		if (!el.hasAttribute("role")) el.setAttribute("role", "alert");
	}
}

// Live clearing while the user edits: the failure key doubles as the control
// name, so the edited control names exactly the error to retract. Errors only
// come back on the next submit — no re-validation mid-edit.
function clearFieldError(root: Element, key: string): void {
	const slot = root.querySelector(`[data-error-for="${attrEscape(key)}"]`);
	if (!slot || slot.hasAttribute("hidden")) return;
	slot.textContent = "";
	slot.setAttribute("hidden", "");
	setInvalidState(root, key, false);
}

function showErrors(root: Element, failures: RequiredFailure[]): void {
	// Covers item-level slots and the per-row slots inside tables.
	for (const el of Array.from(root.querySelectorAll("[data-error-for]"))) {
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
		setInvalidState(root, key, failure !== undefined);
	}
}

export function initForm(root: Element): void {
	const formEl = root.querySelector("form");
	if (!formEl) return;
	initTableScroll(root);
	// Prefill runs before the evaluator is built and before the first
	// visibility pass, so rules see prefilled answers on first render.
	const form = applyPrefill(root, readFormData(root));
	initErrorSlots(root);
	const visibility = createVisibilityEvaluator(form);
	const refreshVisibility = () =>
		applyVisibility(root, visibility.compute(readRawAnswers(root, form)));
	// Pristine prefilled state, rebuilt in place: empty every field, then
	// re-apply the URL prefill. Discard uses this instead of a reload.
	const resetForm = () => {
		for (const el of Array.from(
			formEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
				"input, textarea",
			),
		)) {
			if (el.type === "checkbox" || el.type === "radio") {
				(el as HTMLInputElement).checked = false;
			} else {
				el.value = "";
			}
		}
		applyPrefill(root, form);
		refreshVisibility();
	};
	// Draft restore runs after prefill (draft overlays it) and before the
	// first refreshVisibility() below, so rules see restored answers.
	const draft = initDraft(
		root,
		form,
		() => readRawAnswers(root, form),
		resetForm,
	);
	const onEdit = (event: Event) => {
		refreshVisibility();
		draft?.save();
		const name = (event.target as Element | null)?.getAttribute?.("name");
		if (name) clearFieldError(root, name);
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
		for (const input of inputsByName(root, itemId)) input.checked = false;
		refreshVisibility();
		draft?.save();
	});
	refreshVisibility();
	formEl.addEventListener("submit", (event) => {
		event.preventDefault();
		const failures = validateRequired(root);
		showErrors(root, failures);
		const first = failures[0];
		if (first) {
			root
				.querySelector(`[data-item-id="${attrEscape(first.itemId)}"]`)
				?.scrollIntoView?.({ behavior: scrollBehavior(root), block: "center" });
			// Any failing control shares its failure key as the input name; a
			// choice group's first radio/checkbox doubles as the focus target.
			root
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
			root,
			readFormData(root),
			collectAnswers(root),
			undefined,
			clearDraft,
		);
	});
}
