import { describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { BUILTIN_MESSAGES } from "../../src/messages.ts";
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

function submitButton(doc: Document): HTMLButtonElement {
	const button = doc.querySelector(
		'.yaml-form-root form button[type="submit"]',
	) as HTMLButtonElement | null;
	if (!button) throw new Error("no submit button");
	return button;
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const postFormYaml = `
title: T
actions:
  - type: post
    url: "https://example.com/api/submit"
items:
  - id: name
    title: Name
`;

describe("a11y markup for submit outcomes", () => {
	test("success section has role=status and is focusable; error has role=alert", async () => {
		const { document } = await loadDom(postFormYaml);
		const success = document.querySelector(".form-success");
		expect(success?.getAttribute("role")).toBe("status");
		expect(success?.getAttribute("tabindex")).toBe("-1");
		const error = document.querySelector(".form-error");
		expect(error?.getAttribute("role")).toBe("alert");
	});
});

describe("double-submit guard and pending state", () => {
	test("disables the button and swaps its label while a request is in flight", async () => {
		const { document, window } = await loadDom(postFormYaml);
		const pending = deferred<{ ok: boolean; status: number }>();
		(window as unknown as { fetch: unknown }).fetch = mock(
			() => pending.promise,
		);
		const button = submitButton(document);
		expect(button.disabled).toBe(false);

		submitForm(document);
		await flush();
		expect(button.disabled).toBe(true);
		expect(button.textContent).toBe(BUILTIN_MESSAGES.en.submitting);

		pending.resolve({ ok: true, status: 200 });
		await flush();
	});

	test("a second submit during flight sends no second POST", async () => {
		const { document, window } = await loadDom(postFormYaml);
		const pending = deferred<{ ok: boolean; status: number }>();
		const fetchSpy = mock(() => pending.promise);
		(window as unknown as { fetch: unknown }).fetch = fetchSpy;

		submitForm(document);
		await flush();
		submitForm(document);
		submitForm(document);
		await flush();
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		pending.resolve({ ok: true, status: 200 });
		await flush();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
});

describe("failure state", () => {
	test("re-enables the button, restores its label, and shows the alert", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => {
			throw new Error("network down");
		});
		const button = submitButton(document);
		const idleLabel = button.textContent;

		submitForm(document);
		await flush();
		expect(button.disabled).toBe(false);
		expect(button.textContent).toBe(idleLabel);
		const error = document.querySelector(".form-error");
		expect(error?.hasAttribute("hidden")).toBe(false);
		expect(error?.textContent).toBe(BUILTIN_MESSAGES.en.submit_failed);
		// Form stays usable for a retry.
		expect(
			document.querySelector(".yaml-form-root form")?.hasAttribute("hidden"),
		).toBe(false);
	});

	test("a retry after failure can succeed and submits exactly once more", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => {
			throw new Error("network down");
		});
		submitForm(document);
		await flush();

		const okFetch = mock(async () => ({ ok: true, status: 200 }));
		(window as unknown as { fetch: unknown }).fetch = okFetch;
		submitForm(document);
		await flush();
		expect(okFetch).toHaveBeenCalledTimes(1);
		expect(document.querySelector(".form-error")?.hasAttribute("hidden")).toBe(
			true,
		);
		expect(
			document.querySelector(".form-success")?.hasAttribute("hidden"),
		).toBe(false);
	});
});

describe("success state", () => {
	test("moves focus to the success section", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => ({
			ok: true,
			status: 200,
		}));
		submitForm(document);
		await flush();
		const success = document.querySelector(".form-success");
		expect(success?.hasAttribute("hidden")).toBe(false);
		expect(document.activeElement).toBe(success as Element);
	});
});
