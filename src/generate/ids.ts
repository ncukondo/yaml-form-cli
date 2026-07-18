/** Shared element-id conventions linking item titles, descriptions and inputs. */

export function inputId(itemId: string): string {
	return `input-${itemId}`;
}

export function labelId(itemId: string): string {
	return `label-${itemId}`;
}

export function descriptionId(itemId: string): string {
	return `desc-${itemId}`;
}

/** key is an item id, or `<item id>.<row key>` for table-row error slots. */
export function errorId(key: string): string {
	return `error-${key}`;
}
