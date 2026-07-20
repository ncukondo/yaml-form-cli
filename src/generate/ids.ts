/** Shared element-id conventions linking item titles, descriptions and inputs. */

/**
 * Per-form id prefix. When several forms share a page (fragment output,
 * decision 0019) every `id` / `for` / `aria-*` reference must stay unique;
 * `yf-<form.id>` scopes them. A form without an `id` (standalone, where it is
 * optional) gets an empty prefix, keeping the historical unprefixed ids. The
 * generated root element carries this exact string as its `id`, so the runtime
 * recovers the prefix from `root.id` without a document lookup.
 */
export function formIdPrefix(formId: string | undefined): string {
	return formId ? `yf-${formId}` : "";
}

function scoped(prefix: string, base: string): string {
	return prefix ? `${prefix}-${base}` : base;
}

export function inputId(prefix: string, itemId: string): string {
	return scoped(prefix, `input-${itemId}`);
}

export function labelId(prefix: string, itemId: string): string {
	return scoped(prefix, `label-${itemId}`);
}

export function descriptionId(prefix: string, itemId: string): string {
	return scoped(prefix, `desc-${itemId}`);
}

/** key is an item id, or `<item id>.<row key>` for table-row error slots. */
export function errorId(prefix: string, key: string): string {
	return scoped(prefix, `error-${key}`);
}

/** A descriptor cell's id (rubric), also referenced via aria-describedby. */
export function descriptorId(prefix: string, key: string): string {
	return scoped(prefix, `${key}.descriptor`);
}
