import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { collectAnswers, initForm } from "../../src/runtime/form.ts";
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
	initForm(document.querySelector(".yaml-form-root") as Element);
	return document;
}

function click(doc: Document, el: Element) {
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	el.dispatchEvent(new EventCtor("click", { bubbles: true, cancelable: true }));
}

const formYaml = `
title: T
items:
  - type: choice
    id: optional_pick
    title: Optional
    choices: [a, b]
  - type: choice
    id: required_pick
    title: Required
    required: true
    choices: [a, b]
  - type: choice
    id: multi_pick
    title: Multi
    multiple: true
    choices: [a, b]
  - type: short_text
    id: dep
    title: Dep
    visible_when: 'optional_pick = "a"'
`;

describe("clear-selection affordance markup", () => {
	test("optional single choice renders a clear button inside its group", async () => {
		const document = await loadDom(formYaml);
		const button = document.querySelector(
			'[data-item-id="optional_pick"] button.choice-clear',
		);
		expect(button).not.toBeNull();
		// must not act as a submit button
		expect(button?.getAttribute("type")).toBe("button");
		expect(button?.textContent).toBe("Clear selection");
	});

	test("required and multiple choice items get no clear button", async () => {
		const document = await loadDom(formYaml);
		expect(
			document.querySelector('[data-item-id="required_pick"] .choice-clear'),
		).toBeNull();
		expect(
			document.querySelector('[data-item-id="multi_pick"] .choice-clear'),
		).toBeNull();
	});
});

describe("clearing a selection", () => {
	test("unchecks the radios and omits the answer from the payload", async () => {
		const document = await loadDom(formYaml);
		const radio = document.querySelector(
			'input[name="optional_pick"]',
		) as HTMLInputElement;
		radio.checked = true;
		expect(collectAnswers(document).optional_pick).toBe("a");

		const button = document.querySelector(
			'[data-item-id="optional_pick"] button.choice-clear',
		) as HTMLElement;
		click(document, button);

		for (const input of Array.from(
			document.querySelectorAll<HTMLInputElement>(
				'input[name="optional_pick"]',
			),
		)) {
			expect(input.checked).toBe(false);
		}
		expect(collectAnswers(document)).not.toHaveProperty("optional_pick");
	});

	test("re-evaluates visible_when so dependent items hide again", async () => {
		const document = await loadDom(formYaml);
		const radio = document.querySelector(
			'input[name="optional_pick"]',
		) as HTMLInputElement;
		radio.checked = true;
		const EventCtor = (
			document.defaultView as unknown as { Event: typeof Event }
		).Event;
		radio.dispatchEvent(new EventCtor("change", { bubbles: true }));
		const dep = document.querySelector('[data-item-id="dep"]');
		expect(dep?.hasAttribute("hidden")).toBe(false);

		click(
			document,
			document.querySelector(
				'[data-item-id="optional_pick"] button.choice-clear',
			) as HTMLElement,
		);
		expect(dep?.hasAttribute("hidden")).toBe(true);
	});
});
