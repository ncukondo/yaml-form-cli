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
