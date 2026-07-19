export type FormErrorCode =
	| "yaml_syntax"
	| "invalid_schema"
	| "duplicate_item_id"
	| "duplicate_row_key"
	| "constant_value_required"
	| "descriptor_count_mismatch"
	| "rubric_multiple_not_allowed"
	| "unknown_item_type"
	| "hidden_visible_when_conflict"
	| "unknown_rule_key"
	| "rule_value_unreachable"
	| "rule_syntax_error"
	// Not a form-content problem: an I/O failure (unreadable input, unwritable
	// output) surfaced through the same --json error envelope.
	| "io_error";

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
