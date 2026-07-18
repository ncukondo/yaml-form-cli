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

const optionalChoiceYaml = `
items:
  - type: choice
    id: pick
    title: 選択
    choices: [a, b]
`;

function noscriptOf(html: string): string {
	// DOM parsers treat noscript content as text, so assert on the raw HTML.
	return html.match(/<noscript>.*?<\/noscript>/s)?.[0] ?? "";
}

describe("noscript warning and clear-selection label", () => {
	test("lang: ja localizes the noscript warning", async () => {
		const { html } = await loadDom(`title: T\nlang: ja\n${optionalChoiceYaml}`);
		const noscript = noscriptOf(html);
		expect(noscript).toContain("JavaScript を有効に");
		expect(noscript).not.toContain("requires JavaScript");
	});

	test("lang: ja localizes the clear-selection button", async () => {
		const { document } = await loadDom(
			`title: T\nlang: ja\n${optionalChoiceYaml}`,
		);
		expect(document.querySelector("button.choice-clear")?.textContent).toBe(
			"選択を解除",
		);
	});

	test("messages.noscript_warning override wins over the bundle", async () => {
		const { html } = await loadDom(`
title: T
lang: ja
messages:
  noscript_warning: JS を有効にしてください
${optionalChoiceYaml}`);
		expect(noscriptOf(html)).toContain("JS を有効にしてください");
	});

	test("messages.clear_selection override wins over the bundle", async () => {
		const { document } = await loadDom(`
title: T
messages:
  clear_selection: やり直す
${optionalChoiceYaml}`);
		expect(document.querySelector("button.choice-clear")?.textContent).toBe(
			"やり直す",
		);
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

describe("draft notice slot", () => {
	test("skeleton contains the hidden notice with message and discard button", async () => {
		const { document } = await loadDom(`title: T\n${requiredItem}`);
		const notice = document.querySelector("#yaml-form-draft-notice");
		expect(notice?.getAttribute("role")).toBe("status");
		expect(notice?.hasAttribute("hidden")).toBe(true);
		expect(notice?.querySelector(".draft-notice-message")?.textContent).toBe(
			"Restored your previous answers.",
		);
		expect(notice?.querySelector("button.draft-discard")?.textContent).toBe(
			"Discard draft",
		);
	});

	test("lang: ja localizes the notice and discard label", async () => {
		const { document } = await loadDom(`title: T\nlang: ja\n${requiredItem}`);
		const notice = document.querySelector("#yaml-form-draft-notice");
		expect(notice?.querySelector(".draft-notice-message")?.textContent).toBe(
			"前回の入力内容を復元しました。",
		);
		expect(notice?.querySelector("button.draft-discard")?.textContent).toBe(
			"下書きを破棄",
		);
	});

	test("messages overrides apply to both keys", async () => {
		const { document } = await loadDom(`
title: T
messages:
  draft_restored: Wiederhergestellt.
  draft_discard: Verwerfen
${requiredItem}`);
		const notice = document.querySelector("#yaml-form-draft-notice");
		expect(notice?.querySelector(".draft-notice-message")?.textContent).toBe(
			"Wiederhergestellt.",
		);
		expect(notice?.querySelector("button.draft-discard")?.textContent).toBe(
			"Verwerfen",
		);
	});
});
