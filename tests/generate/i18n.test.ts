import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
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
	return { html, document: window.document as unknown as Document };
}

const requiredItem = `
items:
  - title: Name
    id: name
    required: true
`;

const rubricYaml = `
title: 発表評価
lang: ja
items:
  - type: rubric
    id: rubric
    title: ルーブリック
    choices: [{ title: 良, value: "1" }]
    items:
      - { id: clarity, title: 明確さ, descriptors: [明確である] }
    comment_per_row: true
`;

describe("html lang attribute", () => {
	test('defaults to <html lang="en">', async () => {
		const { html } = await loadDom(`title: T\n${requiredItem}`);
		expect(html).toContain('<html lang="en">');
	});

	test("emits the declared lang verbatim", async () => {
		const { html } = await loadDom(`title: T\nlang: ja-JP\n${requiredItem}`);
		expect(html).toContain('<html lang="ja-JP">');
	});
});

describe("built-in ja bundle", () => {
	test("localizes the submit button and required legend", async () => {
		const { document } = await loadDom(`title: T\nlang: ja\n${requiredItem}`);
		const button = document.querySelector(
			'form#yaml-form button[type="submit"]',
		);
		expect(button?.textContent).toBe("送信");
		const legend = document.querySelector(".required-legend");
		expect(legend?.textContent).toContain("必須");
		expect(legend?.textContent).not.toContain("required");
		expect(legend?.querySelector(".required-mark")?.textContent).toBe("*");
	});

	test("localizes per-row comment labels with the row title", async () => {
		const { document } = await loadDom(rubricYaml);
		const comment = document.querySelector(".row-comment-title");
		expect(comment?.textContent).toBe("コメント — 明確さ");
	});

	test("an unknown lang falls back to English strings", async () => {
		const { document, html } = await loadDom(
			`title: T\nlang: xx\n${requiredItem}`,
		);
		expect(html).toContain('<html lang="xx">');
		expect(
			document.querySelector('form#yaml-form button[type="submit"]')
				?.textContent,
		).toBe("Submit");
	});
});

describe("message overrides", () => {
	test("override the submit label on top of the bundle", async () => {
		const { document } = await loadDom(`
title: T
lang: ja
messages:
  submit: 回答する
${requiredItem}`);
		expect(
			document.querySelector('form#yaml-form button[type="submit"]')
				?.textContent,
		).toBe("回答する");
	});

	test("required_legend override keeps the {mark} span and escapes text", async () => {
		const { document } = await loadDom(`
title: T
messages:
  required_legend: "{mark} <b>must</b> be filled"
${requiredItem}`);
		const legend = document.querySelector(".required-legend");
		expect(legend?.querySelector(".required-mark")?.textContent).toBe("*");
		expect(legend?.textContent).toContain("<b>must</b> be filled");
		expect(legend?.querySelector("b")).toBeNull();
	});

	test("comment override interpolates {row}", async () => {
		const { document } = await loadDom(`${rubricYaml}messages:
  comment: "{row} へのコメント"
`);
		expect(document.querySelector(".row-comment-title")?.textContent).toBe(
			"明確さ へのコメント",
		);
	});

	test("defaults stay English when nothing is configured", async () => {
		const { document } = await loadDom(`title: T\n${requiredItem}`);
		expect(
			document.querySelector('form#yaml-form button[type="submit"]')
				?.textContent,
		).toBe("Submit");
		expect(document.querySelector(".required-legend")?.textContent).toContain(
			"indicates required",
		);
	});
});
