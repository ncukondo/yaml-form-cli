import type { RubricItem } from "../../schema/form-schema.ts";
import { renderTable } from "./choice-table.ts";

export function renderRubric(item: RubricItem): string {
	return renderTable(item, {
		inputKind: "radio",
		descriptorsFor: (rowIndex) => item.items[rowIndex]?.descriptors ?? [],
		commentPerRow: item.comment_per_row,
	});
}
