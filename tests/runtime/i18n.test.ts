import { describe, expect, mock, test } from "bun:test";
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

async function loadDom(source: string) {
	const html = await generateHtml(parseOk(source));
	const window = new Window();
	window.document.write(html);
	const document = window.document as unknown as Document;
	initForm(document.querySelector(".yaml-form-root") as Element);
	return { document, window };
}

function submitForm(doc: Document) {
	const form = doc.querySelector(".yaml-form-root form") as HTMLFormElement;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

const jaPostForm = `
title: アンケート
lang: ja
actions:
  - type: post
    url: "https://example.com/api/submit"
items:
  - id: name
    title: 名前
`;

describe("required validation messages", () => {
	test("ja bundle interpolates the item title", async () => {
		const { document } = await loadDom(`
title: アンケート
lang: ja
items:
  - id: name
    title: 名前
    required: true
`);
		submitForm(document);
		const error = document.querySelector('[data-error-for="name"]');
		expect(error?.textContent).toBe("「名前」は必須です。");
	});

	test("ja bundle interpolates row and item titles for tables", async () => {
		const { document } = await loadDom(`
title: アンケート
lang: ja
items:
  - type: choice_table
    id: t
    title: 評価
    required: true
    items: [{ id: r1, title: 項目1 }]
    choices: [はい, いいえ]
`);
		submitForm(document);
		const error = document.querySelector('[data-error-for="t.r1"]');
		expect(error?.textContent).toBe("「評価」の「項目1」は必須です。");
	});

	test("messages.required override wins over the bundle", async () => {
		const { document } = await loadDom(`
title: アンケート
lang: ja
messages:
  required: "{title} を入力してください"
items:
  - id: name
    title: 名前
    required: true
`);
		submitForm(document);
		expect(document.querySelector('[data-error-for="name"]')?.textContent).toBe(
			"名前 を入力してください",
		);
	});
});

describe("submit flow messages", () => {
	test("ja pending label and failure message", async () => {
		const { document, window } = await loadDom(jaPostForm);
		let rejectFetch!: (reason: unknown) => void;
		(window as unknown as { fetch: unknown }).fetch = mock(
			() =>
				new Promise((_resolve, reject) => {
					rejectFetch = reject;
				}),
		);
		const button = document.querySelector(
			'.yaml-form-root form button[type="submit"]',
		) as HTMLButtonElement;
		expect(button.textContent).toBe("送信");

		submitForm(document);
		await flush();
		expect(button.textContent).toBe("送信中…");

		rejectFetch(new Error("network down"));
		await flush();
		expect(button.textContent).toBe("送信");
		expect(document.querySelector(".form-error")?.textContent).toBe(
			"送信に失敗しました。もう一度お試しください。",
		);
	});

	test("ja success message", async () => {
		const { document, window } = await loadDom(jaPostForm);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => ({
			ok: true,
			status: 200,
		}));
		submitForm(document);
		await flush();
		expect(
			document.querySelector(".form-success .success-message")?.textContent,
		).toBe("回答を送信しました。");
	});

	test("post_submit.message wins over messages.submit_success", async () => {
		const { document, window } = await loadDom(`${jaPostForm}post_submit:
  message: ありがとうございました。
messages:
  submit_success: 送信済み
`);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => ({
			ok: true,
			status: 200,
		}));
		submitForm(document);
		await flush();
		expect(
			document.querySelector(".form-success .success-message")?.textContent,
		).toBe("ありがとうございました。");
	});
});
