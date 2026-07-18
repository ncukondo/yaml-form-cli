import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { initForm } from "../../src/runtime/form.ts";
import { parseForm } from "../../src/schema/index.ts";

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
	return { document, window };
}

function submitForm(doc: Document) {
	const form = doc.querySelector("form#yaml-form") as HTMLFormElement;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

const requiredFormYaml = `
title: T
items:
  - id: name
    title: Name
    required: true
    description: helper text
  - type: choice
    id: pick
    title: Pick
    required: true
    choices: ["a", "b"]
  - type: choice_table
    id: grid
    title: Grid
    required: true
    items:
      - { title: "Row 1", id: r1 }
      - { title: "Row 2", id: r2 }
    choices: ["c1", "c2"]
`;

function textInput(doc: Document): HTMLInputElement {
	return doc.querySelector('[name="name"]') as HTMLInputElement;
}

function fillEverything(doc: Document) {
	textInput(doc).value = "x";
	(doc.querySelector('input[name="pick"]') as HTMLInputElement).checked = true;
	for (const row of ["r1", "r2"]) {
		(
			doc.querySelector(`input[name="grid.${row}"]`) as HTMLInputElement
		).checked = true;
	}
}

describe("error slot announcement markup", () => {
	test("table-row error slots get role=alert and a stable id at init", async () => {
		const { document } = await loadDom(requiredFormYaml);
		const slot = document.querySelector('[data-error-for="grid.r1"]');
		expect(slot?.getAttribute("role")).toBe("alert");
		expect(slot?.id).toBe("error-grid.r1");
	});
});

describe("failed submit marks failing fields", () => {
	test("text input gets aria-invalid and is described by its error slot", async () => {
		const { document } = await loadDom(requiredFormYaml);
		submitForm(document);
		const input = textInput(document);
		expect(input.getAttribute("aria-invalid")).toBe("true");
		const describedBy = input.getAttribute("aria-describedby")?.split(/\s+/);
		expect(describedBy).toContain("desc-name");
		expect(describedBy).toContain("error-name");
		const slot = document.querySelector("#error-name");
		expect(slot?.hasAttribute("hidden")).toBe(false);
		expect(slot?.textContent).toContain("required");
	});

	test("choice group gets aria-invalid and is described by its error slot", async () => {
		const { document } = await loadDom(requiredFormYaml);
		submitForm(document);
		const group = document.querySelector(
			'[data-item-id="pick"] [role="group"]',
		);
		expect(group?.getAttribute("aria-invalid")).toBe("true");
		expect(group?.getAttribute("aria-describedby")).toBe("error-pick");
	});

	test("table-row failure marks the row's inputs", async () => {
		const { document } = await loadDom(requiredFormYaml);
		submitForm(document);
		const rowInputs = Array.from(
			document.querySelectorAll('input[name="grid.r1"]'),
		);
		expect(rowInputs.length).toBeGreaterThan(0);
		for (const input of rowInputs) {
			expect(input.getAttribute("aria-invalid")).toBe("true");
			expect(input.getAttribute("aria-describedby")).toContain("error-grid.r1");
		}
		expect(
			document
				.querySelector('[data-error-for="grid.r1"]')
				?.hasAttribute("hidden"),
		).toBe(false);
	});
});

describe("focus management", () => {
	test("first failing field receives focus", async () => {
		const { document } = await loadDom(requiredFormYaml);
		submitForm(document);
		expect(document.activeElement).toBe(textInput(document) as Element);
	});

	test("focus lands on the first input of a failing choice group", async () => {
		const { document } = await loadDom(requiredFormYaml);
		textInput(document).value = "x";
		submitForm(document);
		expect(document.activeElement).toBe(
			document.querySelector('input[name="pick"]') as Element,
		);
	});

	test("focus lands on the first input of a failing table row", async () => {
		const { document } = await loadDom(requiredFormYaml);
		textInput(document).value = "x";
		(document.querySelector('input[name="pick"]') as HTMLInputElement).checked =
			true;
		submitForm(document);
		expect(document.activeElement).toBe(
			document.querySelector('input[name="grid.r1"]') as Element,
		);
	});
});

describe("invalid state clears once the field passes", () => {
	test("fixing the text value and resubmitting removes aria-invalid and the error reference", async () => {
		const { document } = await loadDom(requiredFormYaml);
		submitForm(document);
		expect(textInput(document).getAttribute("aria-invalid")).toBe("true");

		textInput(document).value = "x";
		submitForm(document);
		const input = textInput(document);
		expect(input.hasAttribute("aria-invalid")).toBe(false);
		// the description link must survive; only the error link goes away
		expect(input.getAttribute("aria-describedby")).toBe("desc-name");
		const slot = document.querySelector("#error-name");
		expect(slot?.hasAttribute("hidden")).toBe(true);
		expect(slot?.textContent).toBe("");
	});

	test("groups and rows fully clear aria-describedby when the error goes away", async () => {
		const { document } = await loadDom(requiredFormYaml);
		submitForm(document);
		fillEverything(document);
		submitForm(document);

		const group = document.querySelector(
			'[data-item-id="pick"] [role="group"]',
		);
		expect(group?.hasAttribute("aria-invalid")).toBe(false);
		expect(group?.hasAttribute("aria-describedby")).toBe(false);
		for (const input of Array.from(
			document.querySelectorAll('input[name="grid.r1"]'),
		)) {
			expect(input.hasAttribute("aria-invalid")).toBe(false);
			expect(input.hasAttribute("aria-describedby")).toBe(false);
		}
	});
});
