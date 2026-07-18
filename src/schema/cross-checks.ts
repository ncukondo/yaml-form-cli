import { type FormError, formatPath } from "./errors.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowKey(row: unknown): string | undefined {
	if (typeof row === "string") return row;
	if (isPlainObject(row)) {
		if (typeof row.id === "string") return row.id;
		if (typeof row.title === "string") return row.title;
	}
	return undefined;
}

/**
 * Generation-time checks the structural schema cannot express, run on the raw
 * parsed document so they still report even when other items fail schema
 * validation.
 */
export function crossChecks(raw: unknown): FormError[] {
	const errors: FormError[] = [];
	if (!isPlainObject(raw) || !Array.isArray(raw.items)) return errors;

	const seenIds = new Map<string, number>();
	raw.items.forEach((item, i) => {
		if (!isPlainObject(item)) return;

		if (typeof item.id === "string" && item.id !== "") {
			const first = seenIds.get(item.id);
			if (first === undefined) {
				seenIds.set(item.id, i);
			} else {
				errors.push({
					code: "duplicate_item_id",
					path: formatPath(["items", i, "id"]),
					message: `Duplicate item id "${item.id}" (already used by items[${first}])`,
				});
			}
		}

		if (
			(item.type === "choice_table" || item.type === "rubric") &&
			Array.isArray(item.items)
		) {
			const seenKeys = new Map<string, number>();
			item.items.forEach((row, j) => {
				const key = rowKey(row);
				if (key === undefined) return;
				const first = seenKeys.get(key);
				if (first === undefined) {
					seenKeys.set(key, j);
				} else {
					errors.push({
						code: "duplicate_row_key",
						path: formatPath(["items", i, "items", j]),
						message: `Duplicate row key "${key}" in "${String(item.id)}" (already used by row ${first})`,
					});
				}
			});
		}

		if (item.type === "rubric") {
			const choiceCount = Array.isArray(item.choices)
				? item.choices.length
				: undefined;
			if (choiceCount !== undefined && Array.isArray(item.items)) {
				item.items.forEach((row, j) => {
					if (!isPlainObject(row) || !Array.isArray(row.descriptors)) return;
					if (row.descriptors.length !== choiceCount) {
						errors.push({
							code: "descriptor_count_mismatch",
							path: formatPath(["items", i, "items", j, "descriptors"]),
							message: `Row "${rowKey(row) ?? j}" has ${row.descriptors.length} descriptors but the rubric has ${choiceCount} choices (must match, in column order)`,
						});
					}
				});
			}
		}
	});

	return errors;
}
