import type { Messages } from "../messages.ts";
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
function ariaAttrs(item: FormItem, prefix: string): string {
	const describedBy = item.description
		? ` aria-describedby="${escapeAttr(descriptionId(prefix, item.id))}"`
		: "";
	const required = item.required ? ' aria-required="true"' : "";
	return `${describedBy}${required}`;
}

function renderConstant(item: ConstantItem): string {
	return `<p class="constant-value">${renderText(item.value)}</p>`;
}

function renderShortText(item: ShortTextItem, prefix: string): string {
	const autocomplete = item.autocomplete
		? ` autocomplete="${escapeAttr(item.autocomplete)}"`
		: "";
	return `<input type="${item.input_type ?? "text"}" name="${escapeAttr(item.id)}" id="${escapeAttr(inputId(prefix, item.id))}"${autocomplete}${ariaAttrs(item, prefix)}>`;
}

function renderLongText(item: LongTextItem, prefix: string): string {
	return `<textarea name="${escapeAttr(item.id)}" id="${escapeAttr(inputId(prefix, item.id))}"${ariaAttrs(item, prefix)}></textarea>`;
}

function renderChoice(
	item: ChoiceItem,
	messages: Messages,
	prefix: string,
): string {
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
			: `\n<button type="button" class="choice-clear">${escapeHtml(messages.clear_selection)}</button>`;
	return `<div class="choice-options" role="group" aria-labelledby="${escapeAttr(labelId(prefix, item.id))}"${ariaAttrs(item, prefix)}>\n${options}${clear}\n</div>`;
}

function renderControl(
	item: FormItem,
	messages: Messages,
	prefix: string,
): string {
	switch (item.type) {
		case "constant":
			return renderConstant(item);
		case "short_text":
			return renderShortText(item, prefix);
		case "long_text":
			return renderLongText(item, prefix);
		case "choice":
			return renderChoice(item, messages, prefix);
		case "choice_table":
			return renderChoiceTable(item, messages, prefix);
		case "rubric":
			return renderRubric(item, messages, prefix);
	}
}

function renderTitle(item: FormItem, prefix: string): string {
	const requiredMark = item.required
		? '<span class="required-mark" aria-hidden="true">*</span>'
		: "";
	const content = `${escapeHtml(item.title)}${requiredMark}`;
	const id = escapeAttr(labelId(prefix, item.id));
	if (item.type === "short_text" || item.type === "long_text") {
		return `<label class="item-title" id="${id}" for="${escapeAttr(inputId(prefix, item.id))}">${content}</label>`;
	}
	return `<span class="item-title" id="${id}">${content}</span>`;
}

export function renderItem(
	item: FormItem,
	messages: Messages,
	prefix: string,
): string {
	// A hidden constant has no section at all; it still participates in
	// answers and rules via the embedded form data (decision 0013).
	if (item.type === "constant" && item.hidden) return "";
	const title = renderTitle(item, prefix);
	const description = item.description
		? `<p class="item-description" id="${escapeAttr(descriptionId(prefix, item.id))}">${renderText(item.description)}</p>`
		: "";
	const error =
		item.type === "constant"
			? ""
			: `<p class="item-error" id="${escapeAttr(errorId(prefix, item.id))}" data-error-for="${escapeAttr(item.id)}" role="alert" hidden></p>`;
	return `<section class="form-item" data-item-id="${escapeAttr(item.id)}" data-item-type="${item.type}">
${title}
${description}${renderControl(item, messages, prefix)}
${error}
</section>`;
}
