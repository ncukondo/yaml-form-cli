// Fragment output (decision 0019, task 0034): a self-contained .yaml-form-root
// subtree with no document envelope, safe to composite into a host page more
// than once. Structure and guardrail tests; the end-to-end multi-fragment
// bootstrap lives in tests/runtime/fragment-compose.test.ts.
import { describe, expect, test } from "bun:test";
import { generateFragment, generateHtml } from "../../src/generate/index.ts";
import { parseForm } from "../../src/schema/index.ts";

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

const withId = `
title: Survey
id: survey1
autosave: true
actions:
  - type: log
items:
  - { id: name, title: Name, required: true }
`;

describe("generate --fragment structure", () => {
	test("emits a .yaml-form-root div, not a full document", async () => {
		const html = await generateFragment(parseOk(withId));
		expect(html.trimStart()).toStartWith(
			'<div class="yaml-form-root" id="yf-survey1">',
		);
		expect(html).not.toContain("<!doctype");
		expect(html).not.toContain("<head>");
		expect(html).not.toContain("<html");
		expect(html).not.toContain("<body>");
		expect(html.trimEnd()).toEndWith("</div>");
	});

	test("scoped style, data/meta, and the runtime script all sit inside the root", async () => {
		const html = await generateFragment(parseOk(withId));
		// A single <style> inside the div, scoped under .yaml-form-root.
		expect(html).toContain("<style>");
		expect(html).toContain(".yaml-form-root {");
		// Embedded data + meta are found by class (not document id).
		expect(html).toContain(
			'<script type="application/json" class="yaml-form-data">',
		);
		expect(html).toContain(
			'<script type="application/json" class="yaml-form-meta">',
		);
		// The shared runtime bundle ships inside the root; its currentScript
		// bootstrap then self-initializes exactly this root.
		expect(html).toContain("currentScript");
		expect(html).toContain(".yaml-form-root");
		// The runtime <script> is the last child before the closing </div>.
		expect(html).toMatch(/<script>[\s\S]*<\/script>\s*<\/div>\s*$/);
	});

	test("carries no standalone page reset (host owns layout/canvas)", async () => {
		const html = await generateFragment(parseOk(withId));
		expect(html).not.toContain("font-family: system-ui");
		expect(html).not.toContain('class="container');
		expect(html).not.toContain("max-width: 46rem");
	});

	test("autosave off drops the restore-notice markup and styles", async () => {
		const html = await generateFragment(
			parseOk(
				"title: T\nid: x\nautosave: false\nactions:\n  - type: log\nitems:\n  - { id: a, title: A }\n",
			),
		);
		// The bundle references `.draft-notice` as a selector regardless; assert
		// the notice element and its style rule are absent.
		expect(html).not.toContain('class="draft-notice"');
		expect(html).not.toContain(".draft-notice[hidden]");
	});

	test("requires an id (fragments must keep ids unique on a shared page)", async () => {
		const noId = parseOk(
			"title: T\nactions:\n  - type: log\nitems:\n  - { id: a, title: A }\n",
		);
		expect(generateFragment(noId)).rejects.toThrow(/requires the form.*id/i);
	});
});

describe("standalone output is unchanged by fragment support", () => {
	test("generateHtml still emits a full document with the container main", async () => {
		const html = await generateHtml(parseOk(withId));
		expect(html.trimStart()).toStartWith("<!doctype html>");
		expect(html).toContain(
			'<main class="container yaml-form-root" id="yf-survey1">',
		);
		expect(html).toContain("font-family: system-ui");
	});
});
