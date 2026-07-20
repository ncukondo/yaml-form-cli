// Guards against docs drifting from real behavior: the answers, payload, and
// mailto examples in docs/reference.md must match what the runtime actually
// produces for an equivalent form.
import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { buildMailtoBody } from "../../src/runtime/actions.ts";
import { collectAnswers, initForm } from "../../src/runtime/form.ts";
import { buildPayload, formatLocalIso } from "../../src/runtime/submit.ts";
import { parseForm } from "../../src/schema/index.ts";

const reference = await Bun.file(
	new URL("../../docs/reference.md", import.meta.url).pathname,
).text();

/** The fenced code block that follows `marker` in docs/reference.md. */
function docBlock(marker: string): string {
	const at = reference.indexOf(marker);
	if (at === -1) throw new Error(`marker not found in docs: ${marker}`);
	const open = reference.indexOf("```", at);
	const bodyStart = reference.indexOf("\n", open) + 1;
	const close = reference.indexOf("```", bodyStart);
	return reference.slice(bodyStart, close);
}

function parseJsonc(block: string): unknown {
	const withoutComments = block
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/[^\n]*/g, "");
	return JSON.parse(withoutComments);
}

// A form producing exactly the ids shown in the docs' answers example.
const docsFixtureYaml = `
title: "Test Form"
id: "test_form"
version: "2.0"
items:
  - { type: constant, id: constant_test, title: constant_sample, value: value }
  - { type: short_text, id: id_sample, title: "Short Text" }
  - { type: choice, id: single_choice, title: "Single Choice", choices: [option1, option2] }
  - type: choice
    id: multiple_choice
    title: "Multiple Choice"
    multiple: true
    choices: [option1, option2, option3, { title: option4, value: value4 }]
  - type: choice_table
    id: choice_table_sample
    title: "Choice Table"
    items: [sub_question1, { title: sub_question8, id: sq8 }]
    choices: [scale1, scale2, scale3]
  - type: choice_table
    id: multiple_choice_table
    title: "Multiple Choice Table"
    multiple: true
    items: [sub_question1]
    choices: [scale1, scale2, scale3]
  - type: rubric
    id: presentation_rubric
    title: "Presentation Rubric"
    choices:
      - { title: Novice, value: "1" }
      - { title: Competent, value: "2" }
      - { title: Expert, value: "3" }
    items:
      - { id: clarity, title: Clarity, descriptors: [a, b, c] }
      - { id: evidence, title: "Use of evidence", descriptors: [a, b, c] }
  - type: rubric
    id: commented_rubric
    title: "Commented Rubric"
    comment_per_row: true
    choices:
      - { title: Novice, value: "1" }
      - { title: Competent, value: "2" }
    items:
      - { id: clarity, title: Clarity, descriptors: [a, b] }
`;

let doc: Document;

function set(name: string, value: string) {
	const el = doc.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
	if (!el) throw new Error(`no input named ${name}`);
	el.value = value;
}

function check(name: string, value: string) {
	const el = doc.querySelector(
		`[name="${name}"][value="${value}"]`,
	) as HTMLInputElement | null;
	if (!el) throw new Error(`no input ${name}=${value}`);
	el.checked = true;
}

beforeAll(async () => {
	const parsed = parseForm(docsFixtureYaml);
	if (!parsed.ok) {
		throw new Error(JSON.stringify(parsed.errors, null, 2));
	}
	const html = await generateHtml(parsed.form);
	const window = new Window();
	window.document.write(html);
	doc = window.document as unknown as Document;
	initForm(doc.querySelector(".yaml-form-root") as Element);
	// Fill in exactly the answers shown in the docs example
	set("id_sample", "free text");
	check("single_choice", "option2");
	check("multiple_choice", "option1");
	check("multiple_choice", "value4");
	check("choice_table_sample.sub_question1", "scale3");
	check("choice_table_sample.sq8", "scale1");
	check("multiple_choice_table.sub_question1", "scale1");
	check("multiple_choice_table.sub_question1", "scale3");
	check("presentation_rubric.clarity", "2");
	check("presentation_rubric.evidence", "3");
	check("commented_rubric.clarity", "2");
	set("commented_rubric.clarity.comment", "...");
});

describe("docs examples match generated output", () => {
	test("Submitted data shape block equals collectAnswers output", () => {
		const documented = parseJsonc(docBlock("### Submitted data shape"));
		expect(collectAnswers(doc)).toEqual(
			documented as ReturnType<typeof collectAnswers>,
		);
	});

	test("Payload block matches buildPayload output", () => {
		const documented = parseJsonc(docBlock("### Payload")) as Record<
			string,
			unknown
		>;
		const parsed = parseForm(docsFixtureYaml);
		if (!parsed.ok) throw new Error("fixture must parse");
		const payload = buildPayload(parsed.form, collectAnswers(doc), {
			generator: documented.generator as string,
			now: new Date("2026-07-18T21:34:56+09:00"),
		});
		expect(payload.payload_version).toBe(documented.payload_version as number);
		expect(payload.form).toEqual(documented.form as typeof payload.form);
		expect(documented.generator).toMatch(/^yaml-form\/\d+\.\d+\.\d+$/);
		// documented timestamp is formatted exactly like formatLocalIso output
		expect(documented.submitted_at as string).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
		);
		expect(formatLocalIso(new Date())).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
		);
	});

	test("mailto body block equals buildMailtoBody output", () => {
		const parsed = parseForm(docsFixtureYaml);
		if (!parsed.ok) throw new Error("fixture must parse");
		// the docs body shows the subset of items answered in its example
		const answers = {
			id_sample: "free text",
			multiple_choice: ["option1", "value4"],
			choice_table_sample: { sub_question1: "scale3" },
			presentation_rubric: { clarity: "2", evidence: "3" },
		};
		const body = buildMailtoBody(parsed.form, answers);
		expect(`${body}\n`).toBe(docBlock("`mailto` body"));
	});
});
