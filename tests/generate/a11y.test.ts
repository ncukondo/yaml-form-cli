import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

async function loadDocument(source: string) {
	const html = await generateHtml(parseOk(source));
	const window = new Window();
	window.document.write(html);
	return window.document as unknown as Document;
}

let document: Document;

beforeAll(async () => {
	document = await loadDocument(sampleYaml);
});

describe("text input labeling", () => {
	test("short_text title is a label wired to its input", () => {
		const label = document.querySelector(
			'[data-item-id="id_sample"] label.item-title',
		);
		expect(label).not.toBeNull();
		expect(label?.getAttribute("for")).toBe("input-id_sample");
		expect(label?.textContent).toContain("Short Text");
		expect(document.querySelector("input#input-id_sample")).not.toBeNull();
	});

	test("long_text title is a label wired to its textarea", () => {
		const label = document.querySelector(
			'[data-item-id="long_text_sample"] label.item-title',
		);
		expect(label?.getAttribute("for")).toBe("input-long_text_sample");
		expect(
			document.querySelector("textarea#input-long_text_sample"),
		).not.toBeNull();
	});

	test("non-input item titles stay non-label elements", () => {
		expect(
			document.querySelector('[data-item-id="single_choice"] label.item-title'),
		).toBeNull();
		expect(
			document.querySelector('[data-item-id="single_choice"] .item-title'),
		).not.toBeNull();
	});
});

describe("description wiring", () => {
	test("description is linked to the input via aria-describedby", () => {
		const input = document.querySelector("input#input-id_sample");
		expect(input?.getAttribute("aria-describedby")).toBe("desc-id_sample");
		const description = document.querySelector("#desc-id_sample");
		expect(description?.textContent).toContain("description for a item");
	});

	test("items without a description carry no aria-describedby", () => {
		const textarea = document.querySelector("textarea#input-long_text_sample");
		expect(textarea?.hasAttribute("aria-describedby")).toBe(false);
	});

	test("choice group with a description is described by it", async () => {
		const doc = await loadDocument(`
title: T
items:
  - type: choice
    id: pick
    title: Pick one
    description: helper text
    choices: ["a", "b"]
`);
		const group = doc.querySelector('[data-item-id="pick"] [role="group"]');
		expect(group?.getAttribute("aria-describedby")).toBe("desc-pick");
		expect(doc.querySelector("#desc-pick")?.textContent).toContain(
			"helper text",
		);
	});
});

describe("choice group and table naming", () => {
	test("choice group is named by the item title", () => {
		const group = document.querySelector(
			'[data-item-id="single_choice"] [role="group"]',
		);
		expect(group?.getAttribute("aria-labelledby")).toBe("label-single_choice");
		expect(
			document.querySelector("#label-single_choice")?.textContent,
		).toContain("Single Choice");
	});

	test("choice_table table is labelled by the item title", () => {
		const table = document.querySelector(
			'[data-item-id="choice_table_sample"] table.choice-table',
		);
		expect(table?.getAttribute("aria-labelledby")).toBe(
			"label-choice_table_sample",
		);
		expect(
			document.querySelector("#label-choice_table_sample")?.textContent,
		).toContain("Choice Table");
	});

	test("rubric table is labelled by the item title", () => {
		const table = document.querySelector(
			'[data-item-id="presentation_rubric"] table.choice-table',
		);
		expect(table?.getAttribute("aria-labelledby")).toBe(
			"label-presentation_rubric",
		);
	});
});

describe("required semantics", () => {
	test("required text input exposes aria-required", () => {
		const input = document.querySelector("input#input-id_sample");
		expect(input?.getAttribute("aria-required")).toBe("true");
	});

	test("optional inputs carry no aria-required", () => {
		const textarea = document.querySelector("textarea#input-long_text_sample");
		expect(textarea?.hasAttribute("aria-required")).toBe(false);
		const group = document.querySelector(
			'[data-item-id="single_choice"] [role="group"]',
		);
		expect(group?.hasAttribute("aria-required")).toBe(false);
	});

	test("required choice group exposes aria-required", async () => {
		const doc = await loadDocument(`
title: T
items:
  - type: choice
    id: pick
    title: Pick one
    required: true
    choices: ["a", "b"]
`);
		const group = doc.querySelector('[data-item-id="pick"] [role="group"]');
		expect(group?.getAttribute("aria-required")).toBe("true");
	});

	test("required table cells expose aria-required, optional ones do not", () => {
		const requiredRadio = document.querySelector(
			'[name="presentation_rubric.clarity"]',
		);
		expect(requiredRadio?.getAttribute("aria-required")).toBe("true");
		const optionalRadio = document.querySelector(
			'[name="choice_table_sample.sub_question1"]',
		);
		expect(optionalRadio?.hasAttribute("aria-required")).toBe(false);
	});
});

describe("error slot announcement attributes", () => {
	test("item error slot is an alert with a stable id", () => {
		const slot = document.querySelector('[data-error-for="id_sample"]');
		expect(slot?.getAttribute("role")).toBe("alert");
		expect(slot?.id).toBe("error-id_sample");
	});

	test("every item-level error slot carries role=alert and error-<id>", () => {
		const slots = Array.from(
			document.querySelectorAll(".form-item > [data-error-for]"),
		);
		expect(slots.length).toBeGreaterThan(0);
		for (const slot of slots) {
			expect(slot.getAttribute("role")).toBe("alert");
			expect(slot.id).toBe(`error-${slot.getAttribute("data-error-for")}`);
		}
	});
});

describe("required legend", () => {
	test("form shows a required legend when any item is required", () => {
		const legend = document.querySelector("form#yaml-form .required-legend");
		expect(legend).not.toBeNull();
		expect(legend?.textContent).toContain("*");
		expect(legend?.textContent).toContain("indicates required");
	});

	test("no legend when nothing is required", async () => {
		const doc = await loadDocument(`
title: T
items:
  - id: free
    title: Free text
`);
		expect(doc.querySelector(".required-legend")).toBeNull();
	});
});
