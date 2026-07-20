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
	initForm(document.querySelector(".yaml-form-root") as Element);
	return document;
}

function selectChoice(doc: Document, name: string, value: string) {
	const inputs = Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
	);
	const chosen = inputs.find((el) => el.value === value);
	if (!chosen) throw new Error(`no input ${name}=${value}`);
	for (const el of inputs) el.checked = el === chosen;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	chosen.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

const formYaml = `
title: T
items:
  - { type: choice, id: gate, title: Gate, choices: ["yes", "no"] }
  - { type: short_text, id: mid, title: Mid, visible_when: 'gate = "yes"' }
  - { type: short_text, id: after, title: After }
`;

const lastItemYaml = `
title: T
items:
  - { type: choice, id: gate, title: Gate, choices: ["yes", "no"] }
  - { type: short_text, id: tail, title: Tail, visible_when: 'gate = "yes"' }
`;

// activeElement is compared via attributes, not element identity: a failing
// element-to-element toBe makes bun's diff printer walk the whole happy-dom
// tree and hang.
function activeDescriptor(doc: Document): string {
	const active = doc.activeElement as HTMLElement | null;
	if (!active) return "none";
	return (
		active.getAttribute("name") || active.id || active.tagName.toLowerCase()
	);
}

describe("focus recovery when visible_when hides the focused item", () => {
	test("focus moves to the next visible item's control", async () => {
		const doc = await loadDom(formYaml);
		selectChoice(doc, "gate", "yes");
		doc.querySelector<HTMLInputElement>('[name="mid"]')?.focus();
		expect(activeDescriptor(doc)).toBe("mid");

		selectChoice(doc, "gate", "no");
		expect(
			doc.querySelector('[data-item-id="mid"]')?.hasAttribute("hidden"),
		).toBe(true);
		expect(activeDescriptor(doc)).toBe("after");
	});

	test("falls back to the form when no visible item follows", async () => {
		const doc = await loadDom(lastItemYaml);
		selectChoice(doc, "gate", "yes");
		doc.querySelector<HTMLInputElement>('[name="tail"]')?.focus();

		selectChoice(doc, "gate", "no");
		// The form has no id now (shell ids dropped for root-scoping, decision
		// 0019); restoreFocus lands on the <form> element itself.
		expect(activeDescriptor(doc)).toBe("form");
	});

	test("focus outside the hidden item is left alone", async () => {
		const doc = await loadDom(formYaml);
		selectChoice(doc, "gate", "yes");
		doc.querySelector<HTMLInputElement>('[name="after"]')?.focus();

		selectChoice(doc, "gate", "no");
		expect(activeDescriptor(doc)).toBe("after");
	});
});
