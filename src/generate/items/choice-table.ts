import type { ChoiceTableItem, RubricItem } from "../../schema/form-schema.ts";
import { escapeAttr, escapeHtml } from "../escape.ts";

type TableItem = ChoiceTableItem | RubricItem;

export interface TableOptions {
	inputKind: "radio" | "checkbox";
	/** Per-cell descriptor texts for a row, in column order (rubric). */
	descriptorsFor?: (rowIndex: number) => readonly string[];
	commentPerRow?: boolean;
}

/**
 * Accessible name for a cell input. Kept as the single construction point of
 * the "{row}: {choice}" phrase; the ": " separator is hard-coded until the
 * i18n hook (Task 0015) lands.
 */
function cellAccessibleName(rowTitle: string, choiceTitle: string): string {
	return `${rowTitle}: ${choiceTitle}`;
}

function renderCell(
	item: TableItem,
	row: TableItem["items"][number],
	choice: TableItem["choices"][number],
	descriptor: string | undefined,
	inputKind: "radio" | "checkbox",
): string {
	const name = `${item.id}.${row.key}`;
	// The aria-label overrides the visible label text, so the descriptor must
	// be linked back via aria-describedby to stay reachable to AT.
	const descriptorId = `${name}.${choice.value}.descriptor`;
	const descriptorHtml =
		descriptor === undefined
			? ""
			: `<span class="cell-descriptor" id="${escapeAttr(descriptorId)}">${escapeHtml(descriptor)}</span>`;
	const describedBy =
		descriptor === undefined
			? ""
			: ` aria-describedby="${escapeAttr(descriptorId)}"`;
	return `<td class="table-cell" role="cell"><label class="table-cell-label"><input type="${inputKind}" name="${escapeAttr(name)}" value="${escapeAttr(choice.value)}" aria-label="${escapeAttr(cellAccessibleName(row.title, choice.title))}"${describedBy}><span class="cell-choice">${escapeHtml(choice.title)}</span>${descriptorHtml}</label></td>`;
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
	const rowHtml = `<tr class="table-row" role="row" data-row-key="${escapeAttr(row.key)}">
<th scope="row" role="rowheader" class="row-label"><span class="row-title">${escapeHtml(row.title)}</span><p class="item-error row-error" data-error-for="${escapeAttr(name)}" hidden></p></th>
${cells}
</tr>`;
	if (!options.commentPerRow) return rowHtml;
	const commentHtml = `<tr class="table-comment-row" role="row" data-row-key="${escapeAttr(row.key)}">
<td colspan="${item.choices.length + 1}" role="cell"><label class="row-comment-label"><span class="row-comment-title">Comment — ${escapeHtml(row.title)}</span><textarea class="row-comment" name="${escapeAttr(`${name}.comment`)}"></textarea></label></td>
</tr>`;
	return `${rowHtml}\n${commentHtml}`;
}

export function renderTable(item: TableItem, options: TableOptions): string {
	const headCells = item.choices
		.map(
			(choice) =>
				`<th scope="col" role="columnheader" class="table-col-header">${escapeHtml(choice.title)}</th>`,
		)
		.join("");
	const bodyRows = item.items
		.map((row, rowIndex) => renderRow(item, row, rowIndex, options))
		.join("\n");
	// Explicit ARIA roles mirror the implicit table semantics: the stacked
	// mobile layout (display: block in styles.ts) would otherwise strip them.
	return `<div class="table-scroll">
<table class="choice-table" role="table" data-table-for="${escapeAttr(item.id)}">
<thead role="rowgroup">
<tr role="row"><th role="columnheader" class="table-corner"></th>${headCells}</tr>
</thead>
<tbody role="rowgroup">
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
