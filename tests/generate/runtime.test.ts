import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import {
	collectAnswers,
	initForm,
	validateRequired,
} from "../../src/runtime/form.ts";
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
	initForm(document.querySelector(".yaml-form-root") as Element);
	return document;
}

let document: Document;

beforeEach(async () => {
	document = await loadDom(sampleYaml);
});

function submitForm(doc: Document) {
	const form = doc.querySelector(".yaml-form-root form") as HTMLFormElement;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

function setText(id: string, value: string) {
	const input = document.querySelector(
		`[name="${id}"]`,
	) as HTMLInputElement | null;
	if (!input) throw new Error(`no input named ${id}`);
	input.value = value;
}

function check(id: string, value: string) {
	const box = document.querySelector(
		`[name="${id}"][value="${value}"]`,
	) as HTMLInputElement | null;
	if (!box) throw new Error(`no input ${id}=${value}`);
	box.checked = true;
}

describe("required validation", () => {
	test("blocks submit and shows a per-item message when required is empty", () => {
		const failures = validateRequired(document);
		expect(failures.map((f) => f.itemId)).toContain("id_sample");
		submitForm(document);
		const error = document.querySelector('[data-error-for="id_sample"]');
		expect(error?.hasAttribute("hidden")).toBe(false);
		expect(error?.textContent).not.toBe("");
	});

	test("passes once the required field is filled", () => {
		setText("id_sample", "hello");
		const failures = validateRequired(document);
		expect(failures.map((f) => f.itemId)).not.toContain("id_sample");
	});

	test("clears the error message after a successful re-validation", () => {
		submitForm(document);
		setText("id_sample", "hello");
		submitForm(document);
		const error = document.querySelector('[data-error-for="id_sample"]');
		expect(error?.hasAttribute("hidden")).toBe(true);
	});

	test("required choice requires at least one selection", async () => {
		const doc = await loadDom(`
title: T
items:
  - type: choice
    title: Pick
    id: pick
    required: true
    choices: [a, b]
`);
		expect(validateRequired(doc).map((f) => f.itemId)).toContain("pick");
		const box = doc.querySelector(
			'[name="pick"][value="a"]',
		) as HTMLInputElement;
		box.checked = true;
		expect(validateRequired(doc).map((f) => f.itemId)).not.toContain("pick");
	});
});

describe("answer collection", () => {
	test("collects basic answers keyed by item id", () => {
		setText("id_sample", "free text");
		setText("long_text_sample", "long\ntext");
		check("single_choice", "option2");
		check("multiple_choice", "option1");
		check("multiple_choice", "value4");
		const answers = collectAnswers(document);
		expect(answers.constant_test).toBe("value");
		expect(answers.id_sample).toBe("free text");
		expect(answers.long_text_sample).toBe("long\ntext");
		expect(answers.single_choice).toBe("option2");
		expect(answers.multiple_choice).toEqual(["option1", "value4"]);
	});

	test("multiple choice with a single selection is still an array", () => {
		check("multiple_choice", "option2");
		const answers = collectAnswers(document);
		expect(answers.multiple_choice).toEqual(["option2"]);
	});

	test("unanswered optional items are omitted", () => {
		const answers = collectAnswers(document);
		expect(answers).not.toHaveProperty("single_choice");
		expect(answers).not.toHaveProperty("multiple_choice");
		expect(answers.id_sample).toBe("");
	});
});
