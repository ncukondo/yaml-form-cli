import type { ChoiceTableItem, RubricItem } from "../../schema/form-schema.ts";
import { escapeAttr, escapeHtml } from "../escape.ts";

type TableItem = ChoiceTableItem | RubricItem;

export interface TableOptions {
	inputKind: "radio" | "checkbox";
	/** Per-cell descriptor texts for a row, in column order (rubric). */
	descriptorsFor?: (rowIndex: number) => readonly string[];
	commentPerRow?: boolean;
}

function renderCell(
	item: TableItem,
	row: TableItem["items"][number],
	choice: TableItem["choices"][number],
	descriptor: string | undefined,
	inputKind: "radio" | "checkbox",
): string {
	const name = `${item.id}.${row.key}`;
	const descriptorHtml =
		descriptor === undefined
			? ""
			: `<span class="cell-descriptor">${escapeHtml(descriptor)}</span>`;
	return `<td class="table-cell"><label class="table-cell-label"><input type="${inputKind}" name="${escapeAttr(name)}" value="${escapeAttr(choice.value)}" aria-label="${escapeAttr(`${row.title}: ${choice.title}`)}"><span class="cell-choice">${escapeHtml(choice.title)}</span>${descriptorHtml}</label></td>`;
}

function renderRow(
	item: TableItem,
	row: TableItem["items"][number],
	rowIndex: number,
	options: TableOptions,
): string {
	const name = `${item.id}.${row.key}`;
	const descriptors = options.descriptorsFor?.(rowIndex);
	const cells = item.choices
		.map((choice, colIndex) =>
			renderCell(item, row, choice, descriptors?.[colIndex], options.inputKind),
		)
		.join("\n");
	const rowHtml = `<tr class="table-row" data-row-key="${escapeAttr(row.key)}">
<th scope="row" class="row-label"><span class="row-title">${escapeHtml(row.title)}</span><p class="item-error row-error" data-error-for="${escapeAttr(name)}" hidden></p></th>
${cells}
</tr>`;
	if (!options.commentPerRow) return rowHtml;
	const commentHtml = `<tr class="table-comment-row" data-row-key="${escapeAttr(row.key)}">
<td colspan="${item.choices.length + 1}"><label class="row-comment-label"><span class="row-comment-title">Comment — ${escapeHtml(row.title)}</span><textarea class="row-comment" name="${escapeAttr(`${name}.comment`)}"></textarea></label></td>
</tr>`;
	return `${rowHtml}\n${commentHtml}`;
}

export function renderTable(item: TableItem, options: TableOptions): string {
	const headCells = item.choices
		.map(
			(choice) =>
				`<th scope="col" class="table-col-header">${escapeHtml(choice.title)}</th>`,
		)
		.join("");
	const bodyRows = item.items
		.map((row, rowIndex) => renderRow(item, row, rowIndex, options))
		.join("\n");
	return `<div class="table-scroll">
<table class="choice-table" data-table-for="${escapeAttr(item.id)}">
<thead>
<tr><th class="table-corner"></th>${headCells}</tr>
</thead>
<tbody>
${bodyRows}
</tbody>
</table>
</div>`;
}

export function renderChoiceTable(item: ChoiceTableItem): string {
	return renderTable(item, {
		inputKind: item.multiple ? "checkbox" : "radio",
	});
}
