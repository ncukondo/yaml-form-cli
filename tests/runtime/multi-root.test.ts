// Two forms in one document must operate independently (decision 0019): no
// id collisions, no cross-form querySelector, and one submit lock / success
// screen per root. Each generated form is a self-contained .yaml-form-root
// subtree; here both are placed in a single document and initialized.
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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Both forms share the item id "name" on purpose: without per-form id
// prefixing their inputs/labels would collide.
const formYaml = (id: string, title: string) => `
title: ${title}
id: ${id}
actions:
  - type: log
items:
  - id: name
    title: Name
    required: true
`;

/** The .yaml-form-root subtree of a generated document (drops the envelope). */
async function rootHtml(id: string, title: string): Promise<string> {
	const html = await generateHtml(parseOk(formYaml(id, title)));
	const start = html.indexOf("<main");
	const end = html.indexOf("</main>") + "</main>".length;
	return html.slice(start, end);
}

async function loadTwoRoots() {
	const a = await rootHtml("alpha", "Alpha");
	const b = await rootHtml("beta", "Beta");
	const window = new Window();
	window.document.write(`<!doctype html><html><body>${a}${b}</body></html>`);
	const document = window.document as unknown as Document;
	const roots = Array.from(
		document.querySelectorAll(".yaml-form-root"),
	) as Element[];
	const [rootA, rootB] = roots;
	if (!rootA || !rootB) throw new Error("expected two roots");
	initForm(rootA);
	initForm(rootB);
	return { document, window, rootA, rootB };
}

function fill(root: Element, name: string, value: string) {
	const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
	if (!input) throw new Error(`no input ${name}`);
	input.value = value;
}

function submit(document: Document, root: Element) {
	const form = root.querySelector("form") as HTMLFormElement;
	const EventCtor = (document.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

describe("two forms in one document", () => {
	test("ids are prefixed per form, so shared item ids do not collide", async () => {
		const { document, rootA, rootB } = await loadTwoRoots();
		// Root elements carry the prefix as their id.
		expect(rootA.id).toBe("yf-alpha");
		expect(rootB.id).toBe("yf-beta");
		// The shared item id "name" yields distinct, unique input ids.
		expect(document.querySelectorAll("#yf-alpha-input-name").length).toBe(1);
		expect(document.querySelectorAll("#yf-beta-input-name").length).toBe(1);
		// Each label points at its own form's input.
		const labelA = rootA.querySelector('label[for="yf-alpha-input-name"]');
		const labelB = rootB.querySelector('label[for="yf-beta-input-name"]');
		expect(labelA).not.toBeNull();
		expect(labelB).not.toBeNull();
	});

	test("submitting one form leaves the other untouched", async () => {
		const { document, rootA, rootB } = await loadTwoRoots();
		fill(rootA, "name", "Ada");
		submit(document, rootA);
		await flush();
		// A succeeded; B never validated and shows no success/error.
		expect(rootA.querySelector(".form-success")?.hasAttribute("hidden")).toBe(
			false,
		);
		expect(rootB.querySelector(".form-success")?.hasAttribute("hidden")).toBe(
			true,
		);
		expect(rootB.querySelector("form")?.hasAttribute("hidden")).toBe(false);
	});

	test("a required-field failure is confined to the submitted form", async () => {
		const { document, rootA, rootB } = await loadTwoRoots();
		// Submit A empty → A shows its required error; B shows none.
		submit(document, rootA);
		await flush();
		const errorA = rootA.querySelector('[data-error-for="name"]');
		const errorB = rootB.querySelector('[data-error-for="name"]');
		expect(errorA?.hasAttribute("hidden")).toBe(false);
		expect(errorB?.hasAttribute("hidden")).toBe(true);
	});
});
