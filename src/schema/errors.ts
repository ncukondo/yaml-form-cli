export type FormErrorCode =
	| "yaml_syntax"
	| "invalid_schema"
	| "duplicate_item_id"
	| "duplicate_row_key"
	| "constant_value_required"
	| "descriptor_count_mismatch"
	| "rubric_multiple_not_allowed"
	| "unknown_item_type";

export interface FormError {
	code: FormErrorCode;
	/** Dotted/bracketed location in the YAML document, e.g. `items[2].value`. Empty for document-level errors. */
	path: string;
	message: string;
}

export function formatPath(path: readonly PropertyKey[]): string {
	let out = "";
	for (const segment of path) {
		if (typeof segment === "number") out += `[${segment}]`;
		else out += out === "" ? String(segment) : `.${String(segment)}`;
	}
	return out;
}
