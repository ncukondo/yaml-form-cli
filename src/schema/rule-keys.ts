import {
	extractDependentKeys,
	type Rule,
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
 * The closed set of literal values each choice-derived answer key can hold:
 * `choice` ids, `choice_table` / `rubric` row keys (and `.value` under
 * `comment_per_row`), each mapping to that item's shared scale values.
 * Free-text keys (`short_text`, `long_text`, `constant`, `.comment`) are
 * absent — their domain is open, so comparisons against them are never
 * unreachable.
 */
function choiceDomains(form: Form): Map<string, Set<string>> {
	const domains = new Map<string, Set<string>>();
	for (const item of form.items) {
		switch (item.type) {
			case "choice":
				domains.set(item.id, new Set(item.choices.map((c) => c.value)));
				break;
			case "choice_table": {
				const values = new Set(item.choices.map((c) => c.value));
				for (const row of item.items)
					domains.set(`${item.id}.${row.key}`, values);
				break;
			}
			case "rubric": {
				const values = new Set(item.choices.map((c) => c.value));
				for (const row of item.items) {
					// `.comment` stays free-text; only the scored `.value` is closed.
					const key = item.comment_per_row
						? `${item.id}.${row.key}.value`
						: `${item.id}.${row.key}`;
					domains.set(key, values);
				}
				break;
			}
		}
	}
	return domains;
}

interface Comparison {
	key: string;
	values: string[];
}

/**
 * Every leaf comparison whose literal(s) must lie in the key's value domain.
 * Regex operators (`matches` / `notMatches`) are excluded — their literal is a
 * pattern, not a value.
 */
function comparisons(rule: Rule, out: Comparison[]): void {
	switch (rule.type) {
		case "and":
		case "or":
			for (const child of rule.children) comparisons(child, out);
			break;
		case "not":
			comparisons(rule.child, out);
			break;
		case "matches":
		case "notMatches":
			break;
		case "in":
		case "notIn":
			out.push({ key: rule.key, values: rule.value });
			break;
		default:
			out.push({ key: rule.key, values: [rule.value] });
	}
}

/**
 * Validate every `visible_when` expression: it must parse, every key it
 * references (including anyOf/allOf/noneOf key lists) must be a possible
 * answer key of the form, and every literal compared against a choice-derived
 * key must be one of that key's reachable values (an unreachable comparison
 * makes the rule constant, which is always a mistake).
 */
export function checkRuleKeys(form: Form): FormError[] {
	const known = answerKeys(form);
	const domains = choiceDomains(form);
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

		const cmps: Comparison[] = [];
		comparisons(parsed.value, cmps);
		for (const cmp of cmps) {
			const domain = domains.get(cmp.key);
			if (domain === undefined) continue; // unknown (reported above) or free-text
			for (const value of cmp.values) {
				if (domain.has(value)) continue;
				errors.push({
					code: "rule_value_unreachable",
					path,
					message: `visible_when on item "${item.id}" compares "${cmp.key}" against "${value}", which is never a value of "${cmp.key}" (choices: ${[...domain].join(", ")}). Verify rule behavior with \`yaml-form eval\`.`,
				});
			}
		}
	});

	return errors;
}
