import type { ChoiceTableItem, RubricItem } from "../../schema/form-schema.ts";
import { escapeAttr, escapeHtml } from "../escape.ts";
import { labelId } from "../ids.ts";

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
	const required = item.required ? ' aria-required="true"' : "";
	return `<td class="table-cell" role="cell"><label class="table-cell-label"><input type="${inputKind}" name="${escapeAttr(name)}" value="${escapeAttr(choice.value)}" aria-label="${escapeAttr(cellAccessibleName(row.title, choice.title))}"${describedBy}${required}><span class="cell-choice">${escapeHtml(choice.title)}</span>${descriptorHtml}</label></td>`;
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

/**
 * Rendered tbody rows above which the container is marked tall and styles.ts
 * gives it its own scroll region (max-height). Short tables stay unmarked so
 * they flow with the page instead of trapping wheel scrolling.
 */
const TALL_TABLE_ROW_THRESHOLD = 10;

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
	const renderedRows = item.items.length * (options.commentPerRow ? 2 : 1);
	const scrollClass =
		renderedRows > TALL_TABLE_ROW_THRESHOLD
			? "table-scroll table-scroll-tall"
			: "table-scroll";
	// Explicit ARIA roles mirror the implicit table semantics: the stacked
	// mobile layout (display: block in styles.ts) would otherwise strip them.
	return `<div class="${scrollClass}">
<table class="choice-table" role="table" data-table-for="${escapeAttr(item.id)}" aria-labelledby="${escapeAttr(labelId(item.id))}">
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
