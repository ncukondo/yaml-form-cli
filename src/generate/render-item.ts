import type {
	ChoiceItem,
	ConstantItem,
	FormItem,
	LongTextItem,
	ShortTextItem,
} from "../schema/form-schema.ts";
import { escapeAttr, escapeHtml, renderText } from "./escape.ts";
import { descriptionId, errorId, inputId, labelId } from "./ids.ts";
import { renderChoiceTable } from "./items/choice-table.ts";
import { renderRubric } from "./items/rubric.ts";

/** aria-describedby / aria-required attributes shared by all input kinds. */
function ariaAttrs(item: FormItem): string {
	const describedBy = item.description
		? ` aria-describedby="${escapeAttr(descriptionId(item.id))}"`
		: "";
	const required = item.required ? ' aria-required="true"' : "";
	return `${describedBy}${required}`;
}

function renderConstant(item: ConstantItem): string {
	return `<p class="constant-value">${renderText(item.value)}</p>`;
}

function renderShortText(item: ShortTextItem): string {
	const autocomplete = item.autocomplete
		? ` autocomplete="${escapeAttr(item.autocomplete)}"`
		: "";
	return `<input type="${item.input_type ?? "text"}" name="${escapeAttr(item.id)}" id="${escapeAttr(inputId(item.id))}"${autocomplete}${ariaAttrs(item)}>`;
}

function renderLongText(item: LongTextItem): string {
	return `<textarea name="${escapeAttr(item.id)}" id="${escapeAttr(inputId(item.id))}"${ariaAttrs(item)}></textarea>`;
}

// Constant so task 0015 can route it through its message table once landed.
export const CLEAR_SELECTION_LABEL = "Clear selection";

function renderChoice(item: ChoiceItem): string {
	const kind = item.multiple ? "checkbox" : "radio";
	const options = item.choices
		.map(
			(choice) =>
				`<label class="choice-option"><input type="${kind}" name="${escapeAttr(item.id)}" value="${escapeAttr(choice.value)}"><span>${escapeHtml(choice.title)}</span></label>`,
		)
		.join("\n");
	// Radios cannot be unticked by the user; optional single-choice items get
	// a clear control so they can end unselected (checkboxes already can, and
	// required items must not end unselected).
	const clear =
		item.required || item.multiple
			? ""
			: `\n<button type="button" class="choice-clear">${escapeHtml(CLEAR_SELECTION_LABEL)}</button>`;
	return `<div class="choice-options" role="group" aria-labelledby="${escapeAttr(labelId(item.id))}"${ariaAttrs(item)}>\n${options}${clear}\n</div>`;
}

function renderControl(item: FormItem): string {
	switch (item.type) {
		case "constant":
			return renderConstant(item);
		case "short_text":
			return renderShortText(item);
		case "long_text":
			return renderLongText(item);
		case "choice":
			return renderChoice(item);
		case "choice_table":
			return renderChoiceTable(item);
		case "rubric":
			return renderRubric(item);
	}
}

function renderTitle(item: FormItem): string {
	const requiredMark = item.required
		? '<span class="required-mark" aria-hidden="true">*</span>'
		: "";
	const content = `${escapeHtml(item.title)}${requiredMark}`;
	const id = escapeAttr(labelId(item.id));
	if (item.type === "short_text" || item.type === "long_text") {
		return `<label class="item-title" id="${id}" for="${escapeAttr(inputId(item.id))}">${content}</label>`;
	}
	return `<span class="item-title" id="${id}">${content}</span>`;
}

export function renderItem(item: FormItem): string {
	const title = renderTitle(item);
	const description = item.description
		? `<p class="item-description" id="${escapeAttr(descriptionId(item.id))}">${renderText(item.description)}</p>`
		: "";
	const error =
		item.type === "constant"
			? ""
			: `<p class="item-error" id="${escapeAttr(errorId(item.id))}" data-error-for="${escapeAttr(item.id)}" role="alert" hidden></p>`;
	return `<section class="form-item" data-item-id="${escapeAttr(item.id)}" data-item-type="${item.type}">
${title}
${description}${renderControl(item)}
${error}
</section>`;
}
