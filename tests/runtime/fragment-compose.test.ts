// End-to-end fragment composition (task 0034): two generated fragments placed
// in one document each self-initialize via the runtime bundle's
// document.currentScript bootstrap (task 0031's main.ts) and operate
// independently, including the submit events (task 0033).
//
// happy-dom does not execute inline <script>s injected via document.write, so
// the bundle is run explicitly once per fragment with document.currentScript
// shimmed to that fragment's own inline script — exactly what a browser passes
// the bootstrap. This exercises the real bootstrap, not a stand-in.
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateFragment } from "../../src/generate/index.ts";
import { getRuntimeBundle } from "../../src/generate/runtime-bundle.ts";
import { parseForm } from "../../src/schema/index.ts";

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Both forms share the item id "name" to prove per-form id prefixing.
const formYaml = (id: string) => `
title: ${id}
id: ${id}
actions:
  - type: log
items:
  - { id: name, title: Name, required: true }
`;

async function composeTwoFragments() {
	const a = await generateFragment(parseOk(formYaml("alpha")));
	const b = await generateFragment(parseOk(formYaml("beta")));
	const bundle = await getRuntimeBundle();
	const window = new Window();
	window.document.write(`<!doctype html><html><body>${a}${b}</body></html>`);
	const document = window.document as unknown as Document;
	// Run the bundle once per root, shimming document.currentScript to that
	// root's own inline <script> — as a browser would when the tag executes.
	const scripts = Array.from(
		document.querySelectorAll(".yaml-form-root > script:not([type])"),
	);
	const run = new Function("document", "window", bundle);
	for (const script of scripts) {
		Object.defineProperty(document, "currentScript", {
			configurable: true,
			get: () => script,
		});
		run(document, window);
	}
	Object.defineProperty(document, "currentScript", {
		configurable: true,
		get: () => null,
	});
	const roots = Array.from(
		document.querySelectorAll(".yaml-form-root"),
	) as Element[];
	return { document, window, roots, scriptCount: scripts.length };
}

function fill(root: Element, value: string) {
	const input = root.querySelector<HTMLInputElement>('[name="name"]');
	if (!input) throw new Error("no name input");
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

describe("two fragments composited in one document", () => {
	test("each fragment ships its own inline bootstrap script", async () => {
		const { scriptCount } = await composeTwoFragments();
		expect(scriptCount).toBe(2);
	});

	test("two bundle copies coexist in one global scope (IIFE isolation)", async () => {
		// On a real page two fragment <script>s are classic scripts sharing one
		// global scope; a top-level `let`/`const`/`class` in the bundle would make
		// the second copy throw "Identifier already declared". The bundle is
		// IIFE-wrapped to prevent that. Running two concatenated copies in a single
		// shared scope must neither fail to parse nor throw. A minimal document
		// stub with no roots makes each copy take the harmless querySelectorAll
		// fallback (empty NodeList → no init).
		const bundle = await getRuntimeBundle();
		const stubDoc = { currentScript: null, querySelectorAll: () => [] };
		const runBoth = new Function("document", "window", `${bundle}\n${bundle}`);
		expect(() => runBoth(stubDoc, {})).not.toThrow();
	});

	test("the currentScript bootstrap initializes each root independently", async () => {
		const { document, roots } = await composeTwoFragments();
		// Submit alpha empty → alpha shows its required error; beta untouched.
		submit(document, roots[0] as Element);
		await flush();
		expect(
			(roots[0] as Element)
				.querySelector('[data-error-for="name"]')
				?.hasAttribute("hidden"),
		).toBe(false);
		expect(
			(roots[1] as Element)
				.querySelector('[data-error-for="name"]')
				?.hasAttribute("hidden"),
		).toBe(true);
	});

	test("submit-success bubbles to document with the right form id per fragment", async () => {
		const { document, roots } = await composeTwoFragments();
		const seen: Array<{ id: unknown; name: unknown }> = [];
		document.addEventListener("yaml-form:submit-success", (event) => {
			const detail = (event as CustomEvent).detail;
			seen.push({ id: detail.form.id, name: detail.payload.answers.name });
		});
		fill(roots[1] as Element, "Grace");
		submit(document, roots[1] as Element);
		await flush();
		// Only beta submitted; the delegated document listener saw its id/answers.
		expect(seen).toEqual([{ id: "beta", name: "Grace" }]);
		// Beta shows success; alpha stays on its form.
		expect(
			(roots[1] as Element)
				.querySelector(".form-success")
				?.hasAttribute("hidden"),
		).toBe(false);
		expect(
			(roots[0] as Element).querySelector("form")?.hasAttribute("hidden"),
		).toBe(false);
	});
});
