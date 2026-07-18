import type {
	ChoiceItem,
	ConstantItem,
	FormItem,
	LongTextItem,
	ShortTextItem,
} from "../schema/form-schema.ts";
import { escapeAttr, escapeHtml, renderText } from "./escape.ts";
import { renderChoiceTable } from "./items/choice-table.ts";
import { renderRubric } from "./items/rubric.ts";

function renderConstant(item: ConstantItem): string {
	return `<p class="constant-value">${renderText(item.value)}</p>`;
}

function renderShortText(item: ShortTextItem): string {
	return `<input type="text" name="${escapeAttr(item.id)}" id="input-${escapeAttr(item.id)}">`;
}

function renderLongText(item: LongTextItem): string {
	return `<textarea name="${escapeAttr(item.id)}" id="input-${escapeAttr(item.id)}"></textarea>`;
}

function renderChoice(item: ChoiceItem): string {
	const kind = item.multiple ? "checkbox" : "radio";
	const options = item.choices
		.map(
			(choice) =>
				`<label class="choice-option"><input type="${kind}" name="${escapeAttr(item.id)}" value="${escapeAttr(choice.value)}"><span>${escapeHtml(choice.title)}</span></label>`,
		)
		.join("\n");
	return `<div class="choice-options" role="group">\n${options}\n</div>`;
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

export function renderItem(item: FormItem): string {
	const requiredMark = item.required
		? '<span class="required-mark" aria-hidden="true">*</span>'
		: "";
	const title = `<span class="item-title" id="label-${escapeAttr(item.id)}">${escapeHtml(item.title)}${requiredMark}</span>`;
	const description = item.description
		? `<p class="item-description">${renderText(item.description)}</p>`
		: "";
	const error =
		item.type === "constant"
			? ""
			: `<p class="item-error" data-error-for="${escapeAttr(item.id)}" hidden></p>`;
	return `<section class="form-item" data-item-id="${escapeAttr(item.id)}" data-item-type="${item.type}">
${title}
${description}${renderControl(item)}
${error}
</section>`;
}
