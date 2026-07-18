import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import {
	collectAnswers,
	initForm,
	validateRequired,
} from "../../src/runtime/form.ts";
import {
	computeVisibility,
	flattenAnswers,
} from "../../src/runtime/visibility.ts";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

async function loadDom(source: string) {
	const html = await generateHtml(parseOk(source));
	const window = new Window();
	window.document.write(html);
	const document = window.document as unknown as Document;
	initForm(document);
	return document;
}

function fireChange(doc: Document, el: Element) {
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	el.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

function selectChoice(doc: Document, name: string, value: string) {
	const inputs = Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
	);
	const chosen = inputs.find((el) => el.value === value);
	if (!chosen) throw new Error(`no input ${name}=${value}`);
	if (chosen.type === "radio") {
		for (const el of inputs) el.checked = el === chosen;
	} else {
		chosen.checked = true;
	}
	fireChange(doc, chosen);
}

function setText(doc: Document, id: string, value: string) {
	const input = doc.querySelector<HTMLInputElement>(`[name="${id}"]`);
	if (!input) throw new Error(`no input named ${id}`);
	input.value = value;
	fireChange(doc, input);
}

function isHidden(doc: Document, itemId: string): boolean {
	const el = doc.querySelector(`[data-item-id="${itemId}"]`);
	if (!el) throw new Error(`no item ${itemId}`);
	return el.hasAttribute("hidden");
}

describe("flattenAnswers", () => {
	test("flattens nested objects to dotted keys, recursively", () => {
		const flat = flattenAnswers({
			plain: "1",
			tags: ["a", "b"],
			table: { row1: "x", row2: ["y", "z"] },
			rubric: { clarity: { value: "2", comment: "good" } },
		});
		expect(flat).toEqual({
			plain: "1",
			tags: ["a", "b"],
			"table.row1": "x",
			"table.row2": ["y", "z"],
			"rubric.clarity.value": "2",
			"rubric.clarity.comment": "good",
		});
	});
});

describe("computeVisibility", () => {
	test("dotted-key rule sees a table answer", () => {
		const form = parseOk(sampleYaml);
		const low = computeVisibility(form, {
			presentation_rubric: { clarity: "1" },
		});
		expect(low.get("clarity_feedback")).toBe(true);
		const high = computeVisibility(form, {
			presentation_rubric: { clarity: "3" },
		});
		expect(high.get("clarity_feedback")).toBe(false);
		const none = computeVisibility(form, {});
		expect(none.get("clarity_feedback")).toBe(false);
	});

	test("items without visible_when are always visible", () => {
		const form = parseOk(sampleYaml);
		const visibility = computeVisibility(form, {});
		expect(visibility.get("id_sample")).toBe(true);
		expect(visibility.get("constant_test")).toBe(true);
	});

	test("chained: hiding A hides B that depends on A's answer", () => {
		const form = parseOk(`
title: T
items:
  - { type: choice, id: a, title: A, choices: ["yes", "no"] }
  - { type: choice, id: b, title: B, choices: [x, y], visible_when: 'a = "yes"' }
  - { type: short_text, id: c, title: C, visible_when: 'b = "x"' }
`);
		const open = computeVisibility(form, { a: "yes", b: "x" });
		expect(open.get("b")).toBe(true);
		expect(open.get("c")).toBe(true);
		// a flips to "no": b hides, and even though b's stale answer is still
		// present in the raw answers, c must hide too.
		const closed = computeVisibility(form, { a: "no", b: "x" });
		expect(closed.get("b")).toBe(false);
		expect(closed.get("c")).toBe(false);
	});
});

describe("live show/hide", () => {
	test("has_other toggles other_comments", async () => {
		const doc = await loadDom(sampleYaml);
		expect(isHidden(doc, "other_comments")).toBe(true);
		selectChoice(doc, "has_other", "yes");
		expect(isHidden(doc, "other_comments")).toBe(false);
		selectChoice(doc, "has_other", "no");
		expect(isHidden(doc, "other_comments")).toBe(true);
	});

	test("array answers are matched with includes", async () => {
		const doc = await loadDom(`
title: T
items:
  - { type: choice, id: tags, title: Tags, multiple: true, choices: [a, b] }
  - { type: short_text, id: dep, title: Dep, visible_when: 'tags includes "a"' }
`);
		expect(isHidden(doc, "dep")).toBe(true);
		selectChoice(doc, "tags", "b");
		expect(isHidden(doc, "dep")).toBe(true);
		selectChoice(doc, "tags", "a");
		expect(isHidden(doc, "dep")).toBe(false);
	});

	test("rubric answer toggles a dotted-key dependent item", async () => {
		const doc = await loadDom(sampleYaml);
		expect(isHidden(doc, "clarity_feedback")).toBe(true);
		// visible_when: 'presentation_rubric.clarity in ["1","2"]'
		selectChoice(doc, "presentation_rubric.clarity", "1");
		expect(isHidden(doc, "clarity_feedback")).toBe(false);
		selectChoice(doc, "presentation_rubric.clarity", "2");
		expect(isHidden(doc, "clarity_feedback")).toBe(false);
		selectChoice(doc, "presentation_rubric.clarity", "3");
		expect(isHidden(doc, "clarity_feedback")).toBe(true);
	});

	test("choice_table answer feeds dotted-key rules", async () => {
		const doc = await loadDom(`
title: T
items:
  - type: choice_table
    id: ct
    title: CT
    choices: [s1, s2]
    items: [q1, q2]
  - type: short_text
    id: dep
    title: Dep
    visible_when: 'ct.q1 = "s2"'
`);
		expect(isHidden(doc, "dep")).toBe(true);
		selectChoice(doc, "ct.q1", "s2");
		expect(isHidden(doc, "dep")).toBe(false);
	});

	test("text input re-evaluates per keystroke (input event), not only on change", async () => {
		const doc = await loadDom(`
title: T
items:
  - { type: short_text, id: code, title: Code }
  - { type: short_text, id: dep, title: Dep, visible_when: 'code = "42"' }
`);
		const input = doc.querySelector<HTMLInputElement>('[name="code"]');
		if (!input) throw new Error("no input");
		input.value = "42";
		const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
			.Event;
		input.dispatchEvent(new EventCtor("input", { bubbles: true }));
		expect(isHidden(doc, "dep")).toBe(false);
	});

	test("chained visibility in the DOM", async () => {
		const doc = await loadDom(`
title: T
items:
  - { type: choice, id: a, title: A, choices: ["yes", "no"] }
  - { type: choice, id: b, title: B, choices: [x, y], visible_when: 'a = "yes"' }
  - { type: short_text, id: c, title: C, visible_when: 'b = "x"' }
`);
		expect(isHidden(doc, "b")).toBe(true);
		expect(isHidden(doc, "c")).toBe(true);
		selectChoice(doc, "a", "yes");
		selectChoice(doc, "b", "x");
		expect(isHidden(doc, "b")).toBe(false);
		expect(isHidden(doc, "c")).toBe(false);
		// hiding a's branch hides b, whose stale answer must no longer show c
		selectChoice(doc, "a", "no");
		expect(isHidden(doc, "b")).toBe(true);
		expect(isHidden(doc, "c")).toBe(true);
	});
});

describe("hidden items are excluded", () => {
	test("from collected answers", async () => {
		const doc = await loadDom(sampleYaml);
		selectChoice(doc, "has_other", "yes");
		setText(doc, "other_comments", "some comments");
		expect(collectAnswers(doc).other_comments).toBe("some comments");
		selectChoice(doc, "has_other", "no");
		expect(collectAnswers(doc)).not.toHaveProperty("other_comments");
	});

	test("from required validation", async () => {
		const doc = await loadDom(`
title: T
items:
  - { type: choice, id: gate, title: Gate, choices: [show, hide] }
  - type: short_text
    id: detail
    title: Detail
    required: true
    visible_when: 'gate = "show"'
`);
		expect(validateRequired(doc).map((f) => f.itemId)).not.toContain("detail");
		selectChoice(doc, "gate", "show");
		expect(validateRequired(doc).map((f) => f.itemId)).toContain("detail");
		selectChoice(doc, "gate", "hide");
		expect(validateRequired(doc).map((f) => f.itemId)).not.toContain("detail");
	});
});
