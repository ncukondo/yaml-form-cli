// URL-parameter prefill (decision 0013). Runs once at init, before the first
// visibility pass. Bundled into the generated HTML, so imports from
// src/schema must stay type-only.
import type { Form } from "../schema/form-schema.ts";

export type PrefillTarget =
	| { kind: "text" }
	| { kind: "choice"; multiple: boolean; values: Set<string> }
	| { kind: "constant" };

/**
 * Every URL-parameter key this form accepts (exact string match, no dotted
 * path parsing — item ids may themselves contain dots): item id for text and
 * choice items, `<id>.<rowKey>` for table rows, `<id>.<rowKey>.comment` for
 * rubric per-row comments, and item id for constants with `from_url: true`.
 */
export function enumerateTargets(form: Form): Map<string, PrefillTarget> {
	const targets = new Map<string, PrefillTarget>();
	const choiceValues = (choices: { value: string }[]) =>
		new Set(choices.map((c) => c.value));
	for (const item of form.items) {
		switch (item.type) {
			case "short_text":
			case "long_text":
				targets.set(item.id, { kind: "text" });
				break;
			case "choice":
				targets.set(item.id, {
					kind: "choice",
					multiple: item.multiple,
					values: choiceValues(item.choices),
				});
				break;
			case "choice_table":
				for (const row of item.items) {
					targets.set(`${item.id}.${row.key}`, {
						kind: "choice",
						multiple: item.multiple,
						values: choiceValues(item.choices),
					});
				}
				break;
			case "rubric":
				for (const row of item.items) {
					targets.set(`${item.id}.${row.key}`, {
						kind: "choice",
						multiple: false,
						values: choiceValues(item.choices),
					});
					if (item.comment_per_row) {
						targets.set(`${item.id}.${row.key}.comment`, { kind: "text" });
					}
				}
				break;
			case "constant":
				if (item.from_url) targets.set(item.id, { kind: "constant" });
				break;
		}
	}
	return targets;
}

function attrEscape(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function warn(message: string): void {
	console.warn(`yaml-form: ${message}`);
}

export function applyTextValue(
	doc: Document,
	name: string,
	value: string,
): void {
	const el = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(
		`[name="${attrEscape(name)}"]`,
	);
	if (el) el.value = value;
}

/**
 * Check the inputs matching `values` (union for `multiple`, last-wins
 * otherwise); values outside the choice set are warn-and-ignore.
 * `commaShorthand` enables 0013's comma splitting for `multiple` targets —
 * URL parameters use it, draft restore (exact stored values) must not.
 */
export function applyChoiceValues(
	doc: Document,
	name: string,
	target: Extract<PrefillTarget, { kind: "choice" }>,
	paramValues: string[],
	commaShorthand: boolean,
): void {
	const inputs = Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${attrEscape(name)}"]`),
	);
	if (target.multiple) {
		// Union of all occurrences; each occurrence matches whole first (a
		// choice value containing a comma wins), otherwise splits on commas.
		const selected = new Set<string>();
		for (const value of paramValues) {
			const tokens =
				target.values.has(value) || !commaShorthand
					? [value]
					: value.split(",");
			for (const token of tokens) {
				if (target.values.has(token)) selected.add(token);
				else
					warn(`ignoring unknown value "${token}" for URL parameter "${name}"`);
			}
		}
		for (const input of inputs) {
			if (selected.has(input.value)) input.checked = true;
		}
		return;
	}
	const value = paramValues[paramValues.length - 1];
	if (value === undefined) return;
	if (!target.values.has(value)) {
		warn(`ignoring unknown value "${value}" for URL parameter "${name}"`);
		return;
	}
	for (const input of inputs) input.checked = input.value === value;
}

/**
 * Apply `location.search` to the form. Constant overrides rewrite the
 * embedded `#yaml-form-data` JSON once, so rules, collectAnswers, and the
 * submit payload all see them; the returned form reflects the overrides.
 * Values reach the DOM via `input.value` / `checked` / `textContent` only —
 * URL data has no XSS path. Never throws error slots open and never breaks
 * rendering: unknown names and values are warn-and-ignore.
 */
export function applyPrefill(doc: Document, form: Form): Form {
	const search = doc.defaultView?.location?.search ?? "";
	if (search === "" || search === "?") return form;
	const params = new URLSearchParams(search);
	const targets = enumerateTargets(form);
	const overrides = new Map<string, string>();

	for (const key of new Set(params.keys())) {
		const target = targets.get(key);
		if (!target) {
			warn(`ignoring unknown URL parameter "${key}"`);
			continue;
		}
		const values = params.getAll(key);
		const last = values[values.length - 1];
		switch (target.kind) {
			case "text":
				if (last !== undefined) applyTextValue(doc, key, last);
				break;
			case "choice":
				applyChoiceValues(doc, key, target, values, true);
				break;
			case "constant":
				if (last !== undefined) overrides.set(key, last);
				break;
		}
	}

	if (overrides.size === 0) return form;
	for (const item of form.items) {
		const value = overrides.get(item.id);
		if (item.type !== "constant" || value === undefined) continue;
		item.value = value;
		const rendered = doc.querySelector(
			`[data-item-id="${attrEscape(item.id)}"] .constant-value`,
		);
		if (rendered) rendered.textContent = value;
	}
	const el = doc.querySelector(
		'script[type="application/json"]#yaml-form-data',
	);
	// <-escape mirrors generation so "</script>" can never appear in the data
	if (el) el.textContent = JSON.stringify(form).replaceAll("<", "\\u003c");
	return form;
}
