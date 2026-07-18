import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { parseForm } from "../../src/schema/index.ts";

const yaml = `
title: T
items:
  - { type: constant, title: Respondent, id: respondent, value: anonymous, hidden: true }
  - { type: constant, title: Cohort, id: cohort, value: "2026" }
  - { title: Name, id: name }
`;

let document: Document;

beforeAll(async () => {
	const result = parseForm(yaml);
	if (!result.ok) throw new Error("expected form to parse");
	const html = await generateHtml(result.form);
	const window = new Window();
	window.document.write(html);
	document = window.document as unknown as Document;
});

describe("hidden constant rendering", () => {
	// Assertions stay on primitives: printing a happy-dom node in a failure
	// diff crashes bun's inspector.
	test("hidden constant renders no section", () => {
		const sections = document.querySelectorAll('[data-item-id="respondent"]');
		expect(sections.length).toBe(0);
	});

	test("visible constant is unchanged", () => {
		const section = document.querySelector('[data-item-id="cohort"]');
		expect(section?.querySelector(".constant-value")?.textContent).toBe("2026");
	});

	test("hidden constant still lands in the embedded form data", () => {
		const data = document.querySelector("#yaml-form-data")?.textContent;
		expect(data).toContain('"respondent"');
	});
});
