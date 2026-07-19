import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
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
		expect(html).toContain(
			"This form requires JavaScript. Enable JavaScript and reload the page to fill it in.",
		);
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

describe("robots meta (decision 0017)", () => {
	const base = "title: T\nitems:\n  - {title: A, id: a}\n";
	async function robotsContent(yaml: string): Promise<string | null> {
		const out = await generateHtml(parseOk(yaml));
		const window = new Window();
		window.document.write(out);
		const doc = window.document as unknown as Document;
		return (
			doc.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null
		);
	}

	test("defaults to noindex, nofollow", async () => {
		expect(await robotsContent(base)).toBe("noindex, nofollow");
	});

	test("noindex: false yields nofollow only", async () => {
		expect(await robotsContent(`noindex: false\n${base}`)).toBe("nofollow");
	});

	test("nofollow: false yields noindex only", async () => {
		expect(await robotsContent(`nofollow: false\n${base}`)).toBe("noindex");
	});

	test("both false emits no robots meta", async () => {
		expect(
			await robotsContent(`noindex: false\nnofollow: false\n${base}`),
		).toBeNull();
	});
});

describe("structured links (decision 0018)", () => {
	async function doc(yaml: string): Promise<Document> {
		const out = await generateHtml(parseOk(yaml));
		const window = new Window();
		window.document.write(out);
		return window.document as unknown as Document;
	}

	test("top-level links render in the header with URL-derived target", async () => {
		const d = await doc(`
title: T
links:
  - { title: Back, url: /index.html }
  - { title: Docs, url: "https://example.com/docs" }
items:
  - { title: A, id: a }
`);
		const relative = d.querySelector<HTMLAnchorElement>(
			'header .form-links a[href="/index.html"]',
		);
		const absolute = d.querySelector<HTMLAnchorElement>(
			'header .form-links a[href="https://example.com/docs"]',
		);
		expect(relative?.textContent).toBe("Back");
		expect(relative?.getAttribute("target")).toBeNull();
		expect(absolute?.getAttribute("target")).toBe("_blank");
		expect(absolute?.getAttribute("rel")).toBe("noopener noreferrer");
	});

	test("target override wins over the URL-derived default", async () => {
		const d = await doc(`
title: T
links:
  - { title: Ext, url: "https://example.com", target: self }
  - { title: Int, url: /a, target: blank }
items:
  - { title: A, id: a }
`);
		expect(
			d
				.querySelector('.form-links a[href="https://example.com"]')
				?.getAttribute("target"),
		).toBeNull();
		expect(
			d.querySelector('.form-links a[href="/a"]')?.getAttribute("target"),
		).toBe("_blank");
	});

	test("post_submit.links render inside the success section", async () => {
		const d = await doc(`
title: T
post_submit:
  message: Saved.
  links:
    - { title: Next, url: ./r002.html }
items:
  - { title: A, id: a }
`);
		const link = d.querySelector<HTMLAnchorElement>(
			'#yaml-form-success .success-links a[href="./r002.html"]',
		);
		expect(link?.textContent).toBe("Next");
	});

	test("disallowed URL scheme is a generation error", () => {
		const result = parseForm(`
title: T
links:
  - { title: X, url: "javascript:alert(1)" }
items:
  - { title: A, id: a }
`);
		expect(result.ok).toBe(false);
	});
});

describe("success screen markup", () => {
	test("success section carries a checkmark icon and a message slot", () => {
		const success = document.querySelector("#yaml-form-success");
		expect(success).not.toBeNull();
		const icon = success?.querySelector("svg.success-icon");
		expect(icon).not.toBeNull();
		// decorative only — the announced content is the message text
		expect(icon?.getAttribute("aria-hidden")).toBe("true");
		expect(success?.querySelector("p.success-message")).not.toBeNull();
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
