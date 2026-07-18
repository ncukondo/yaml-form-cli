import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml, NOSCRIPT_WARNING } from "../../src/generate/index.ts";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("sample must parse");
	return result.form;
}

let html: string;
let document: Document;

beforeAll(async () => {
	html = await generateHtml(parseOk(sampleYaml));
	const window = new Window();
	window.document.write(html);
	document = window.document as unknown as Document;
});

describe("generated document shell", () => {
	test("is a single standalone HTML5 document", () => {
		expect(html.trimStart().toLowerCase()).toStartWith("<!doctype html>");
		expect(html.match(/<html/g)).toHaveLength(1);
		expect(document.querySelector("meta[charset]")).not.toBeNull();
		expect(document.querySelector('meta[name="viewport"]')).not.toBeNull();
		expect(document.title).toBe("Test Form");
	});

	test("has no external resource references", () => {
		expect(document.querySelector("script[src]")).toBeNull();
		expect(document.querySelector("link")).toBeNull();
		expect(document.querySelector("img")).toBeNull();
		expect(document.querySelector("style")).not.toBeNull();
		const scripts = document.querySelectorAll("script");
		expect(scripts.length).toBeGreaterThan(0);
	});

	test("warns via noscript when JavaScript is disabled", () => {
		// assert on the raw HTML: DOM parsers treat noscript content as text
		expect(html).toContain("<noscript>");
		expect(html).toContain(NOSCRIPT_WARNING);
		expect(NOSCRIPT_WARNING.length).toBeGreaterThan(0);
	});

	test("renders form title and auto-linked description", () => {
		const heading = document.querySelector("h1");
		expect(heading?.textContent).toBe("Test Form");
		const link = document.querySelector(
			'.form-description a[href="https://sample.com/"]',
		);
		expect(link).not.toBeNull();
	});

	test("escapes HTML in user-provided text", async () => {
		const form = parseOk(`
title: "<script>alert(1)</script>"
items:
  - title: "a < b"
    id: a
`);
		const out = await generateHtml(form);
		expect(out).not.toContain("<script>alert(1)</script>");
		expect(out).toContain("&lt;script&gt;");
	});
});

describe("basic item rendering", () => {
	test("every item gets a container with its id", () => {
		for (const id of [
			"constant_test",
			"id_sample",
			"long_text_sample",
			"single_choice",
			"multiple_choice",
		]) {
			expect(document.querySelector(`[data-item-id="${id}"]`)).not.toBeNull();
		}
	});

	test("constant renders its value, not an editable input", () => {
		const constant = document.querySelector('[data-item-id="constant_test"]');
		expect(constant?.textContent).toContain("value");
		expect(constant?.querySelector("input, textarea, select")).toBeNull();
	});

	test("short_text renders a text input with label and description", () => {
		const item = document.querySelector('[data-item-id="id_sample"]');
		const input = item?.querySelector('input[type="text"]');
		expect(input).not.toBeNull();
		expect(input?.getAttribute("name")).toBe("id_sample");
		expect(item?.textContent).toContain("Short Text");
		expect(item?.textContent).toContain("description for a item");
		expect(item?.querySelector(".required-mark")).not.toBeNull();
	});

	test("long_text renders a textarea", () => {
		const item = document.querySelector('[data-item-id="long_text_sample"]');
		expect(
			item?.querySelector("textarea[name=long_text_sample]"),
		).not.toBeNull();
	});

	test("single choice renders radios, multiple renders checkboxes", () => {
		const single = document.querySelector('[data-item-id="single_choice"]');
		expect(single?.querySelectorAll('input[type="radio"]')).toHaveLength(4);
		const multiple = document.querySelector('[data-item-id="multiple_choice"]');
		const boxes = Array.from(
			multiple?.querySelectorAll('input[type="checkbox"]') ?? [],
		);
		expect(boxes).toHaveLength(4);
		const values = boxes.map((b) => b.getAttribute("value"));
		expect(values).toContain("value4");
	});

	test("choice_table and rubric render containers with their ids", () => {
		expect(
			document.querySelector('[data-item-id="choice_table_sample"]'),
		).not.toBeNull();
		expect(
			document.querySelector('[data-item-id="presentation_rubric"]'),
		).not.toBeNull();
	});

	test("embeds the form definition as JSON for the runtime", () => {
		const data = document.querySelector(
			'script[type="application/json"]#yaml-form-data',
		);
		expect(data).not.toBeNull();
		const parsed = JSON.parse(data?.textContent ?? "");
		expect(parsed.title).toBe("Test Form");
		expect(Array.isArray(parsed.items)).toBe(true);
	});

	test("has a submit button inside a form element", () => {
		expect(
			document.querySelector('form#yaml-form button[type="submit"]'),
		).not.toBeNull();
	});
});
