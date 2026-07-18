import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { baseStyles } from "../../src/generate/styles.ts";
import { parseForm } from "../../src/schema/index.ts";

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

describe("short_text input_type / autocomplete rendering (decision 0011)", () => {
	test("input_type becomes the input's type attribute", async () => {
		const document = await loadDocument(`
title: T
items:
  - id: mail
    title: Mail
    input_type: email
  - id: phone
    title: Phone
    input_type: tel
`);
		expect(
			document.querySelector('input[name="mail"]')?.getAttribute("type"),
		).toBe("email");
		expect(
			document.querySelector('input[name="phone"]')?.getAttribute("type"),
		).toBe("tel");
	});

	test("omitted input_type keeps type=text and no autocomplete attribute", async () => {
		const document = await loadDocument(`
title: T
items:
  - id: a
    title: A
`);
		const input = document.querySelector('input[name="a"]');
		expect(input?.getAttribute("type")).toBe("text");
		expect(input?.hasAttribute("autocomplete")).toBe(false);
	});

	test("autocomplete is rendered verbatim, escaped as an attribute", async () => {
		const document = await loadDocument(`
title: T
items:
  - id: mail
    title: Mail
    input_type: email
    autocomplete: email
  - id: ship
    title: Ship
    autocomplete: "section-x shipping tel"
`);
		expect(
			document
				.querySelector('input[name="mail"]')
				?.getAttribute("autocomplete"),
		).toBe("email");
		const ship = document.querySelector('input[name="ship"]');
		expect(ship?.getAttribute("type")).toBe("text");
		expect(ship?.getAttribute("autocomplete")).toBe("section-x shipping tel");
	});
});

describe("input_type variants keep the text-input styling", () => {
	test("a rule extends base/focus/invalid styling to the new types", () => {
		for (const type of ["email", "tel", "url", "number"]) {
			expect(baseStyles).toContain(`[type="${type}"]`);
		}
		const rule = baseStyles.match(
			/input:is\(\[type="email"\][^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--border-input)");
	});
});
