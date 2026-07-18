import {
	extractDependentKeys,
	safeParseSource,
} from "@ncukondo/dynamic-form-rules";
import { type FormError, formatPath } from "./errors.ts";
import type { Form, FormItem } from "./form-schema.ts";

/**
 * All keys a form's answers can produce in the flattened view rules evaluate
 * against: plain item ids; `<item_id>.<row_key>` for choice_table and rubric;
 * with `comment_per_row`, `<item_id>.<row_key>.value` / `.comment` instead of
 * the bare row key.
 */
export function answerKeys(form: Form): Set<string> {
	const keys = new Set<string>();
	for (const item of form.items) keysForItem(item, keys);
	return keys;
}

function keysForItem(item: FormItem, keys: Set<string>): void {
	switch (item.type) {
		case "choice_table":
			for (const row of item.items) keys.add(`${item.id}.${row.key}`);
			break;
		case "rubric":
			for (const row of item.items) {
				if (item.comment_per_row) {
					keys.add(`${item.id}.${row.key}.value`);
					keys.add(`${item.id}.${row.key}.comment`);
				} else {
					keys.add(`${item.id}.${row.key}`);
				}
			}
			break;
		default:
			keys.add(item.id);
	}
}

/**
 * Validate every `visible_when` expression: it must parse, and every key it
 * references (including anyOf/allOf/noneOf key lists) must be a possible
 * answer key of the form.
 */
export function checkRuleKeys(form: Form): FormError[] {
	const known = answerKeys(form);
	const errors: FormError[] = [];

	form.items.forEach((item, i) => {
		if (item.visible_when === undefined) return;
		const path = formatPath(["items", i, "visible_when"]);

		const parsed = safeParseSource(item.visible_when);
		if (!parsed.ok) {
			errors.push({
				code: "rule_syntax_error",
				path,
				message: `Invalid visible_when expression on item "${item.id}" (parse failed at position ${parsed.pos})`,
			});
			return;
		}

		for (const key of new Set(extractDependentKeys(parsed.value))) {
			if (known.has(key)) continue;
			errors.push({
				code: "unknown_rule_key",
				path,
				message: `visible_when on item "${item.id}" references unknown key "${key}" (not a possible answer key of this form)`,
			});
		}
	});

	return errors;
}
