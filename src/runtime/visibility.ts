// Browser-side evaluation of visible_when rules. Bundled into the generated
// HTML together with form.ts, so imports from src/schema must stay type-only.
import {
	evaluateRule,
	extractDependentKeys,
	type Rule,
	safeParseSource,
} from "@ncukondo/dynamic-form-rules";
import type { Form } from "../schema/form-schema.ts";

/** Answers before flattening: table/rubric items contribute nested objects. */
export type RawAnswerValue =
	| string
	| string[]
	| { [key: string]: RawAnswerValue };
export type RawAnswers = Record<string, RawAnswerValue>;

export type FlatAnswers = Record<string, string | string[]>;

/**
 * Flatten nested answers to the dotted-key view rules evaluate against
 * (`rubric.row`, and `rubric.row.value` / `.comment` with comment_per_row).
 */
export function flattenAnswers(answers: RawAnswers): FlatAnswers {
	const flat: FlatAnswers = {};
	const visit = (key: string, value: RawAnswerValue): void => {
		if (typeof value === "string" || Array.isArray(value)) {
			flat[key] = value;
			return;
		}
		for (const [subKey, child] of Object.entries(value)) {
			visit(`${key}.${subKey}`, child);
		}
	};
	for (const [key, value] of Object.entries(answers)) visit(key, value);
	return flat;
}

interface ParsedRule {
	itemId: string;
	rule: Rule;
	keys: string[];
}

export interface VisibilityEvaluator {
	compute(answers: RawAnswers): Map<string, boolean>;
}

/**
 * Parse every visible_when rule once; `compute` then evaluates all of them in
 * one pass over the current answers.
 */
export function createVisibilityEvaluator(form: Form): VisibilityEvaluator {
	const itemIds = form.items.map((item) => item.id);
	const ruled: ParsedRule[] = [];
	for (const item of form.items) {
		if (item.visible_when === undefined) continue;
		const parsed = safeParseSource(item.visible_when);
		// Rules are validated at generation time; if one still fails to parse
		// here, fail open so the item is never silently lost.
		if (!parsed.ok) continue;
		ruled.push({
			itemId: item.id,
			rule: parsed.value,
			keys: extractDependentKeys(parsed.value),
		});
	}

	const compute = (answers: RawAnswers): Map<string, boolean> => {
		const visible = new Map(itemIds.map((id) => [id, true]));
		// A hidden item's answers are excluded from the view rules see, so
		// hiding one item can toggle another; iterate to a fixed point,
		// bounded by the number of ruled items.
		for (let round = 0; round <= ruled.length; round++) {
			const flat = flattenAnswers(visibleAnswers(answers, visible));
			let changed = false;
			for (const { itemId, rule, keys } of ruled) {
				const next = evaluateRule(ruleView(flat, keys), rule);
				if (visible.get(itemId) !== next) {
					visible.set(itemId, next);
					changed = true;
				}
			}
			if (!changed) break;
		}
		return visible;
	};

	return { compute };
}

/** One-shot convenience over createVisibilityEvaluator. */
export function computeVisibility(
	form: Form,
	answers: RawAnswers,
): Map<string, boolean> {
	return createVisibilityEvaluator(form).compute(answers);
}

export function applyVisibility(
	doc: Document,
	visibility: Map<string, boolean>,
): void {
	for (const [itemId, visible] of visibility) {
		const el = doc.querySelector(`[data-item-id="${attrEscape(itemId)}"]`);
		if (!el) continue;
		if (visible) el.removeAttribute("hidden");
		else el.setAttribute("hidden", "");
	}
}

function visibleAnswers(
	answers: RawAnswers,
	visible: Map<string, boolean>,
): RawAnswers {
	const out: RawAnswers = {};
	for (const [itemId, value] of Object.entries(answers)) {
		if (visible.get(itemId) !== false) out[itemId] = value;
	}
	return out;
}

// The engine indexes keyValues directly (`keyValues[key].includes(...)`), so
// every key a rule depends on must be present: unanswered/hidden ones default
// to "". Array answers pass through untouched for `includes`/`notIncludes`.
function ruleView(flat: FlatAnswers, keys: string[]): Record<string, string> {
	const view: FlatAnswers = {};
	for (const key of keys) view[key] = flat[key] ?? "";
	return view as Record<string, string>;
}

function attrEscape(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
