// Submit-completion CustomEvents (decision 0021): yaml-form:submit-success /
// yaml-form:submit-error dispatched on the root element, bubbling to document.
import { describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { initForm } from "../../src/runtime/form.ts";
import type { SubmitPayload } from "../../src/runtime/submit.ts";
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

function setText(doc: Document, name: string, value: string) {
	const input = doc.querySelector<HTMLInputElement>(`[name="${name}"]`);
	if (!input) throw new Error(`no input named ${name}`);
	input.value = value;
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

// Collects events of the given type arriving at document — proving bubbling.
function listen(doc: Document, type: string): CustomEvent[] {
	const events: CustomEvent[] = [];
	doc.addEventListener(type, (event) => {
		events.push(event as CustomEvent);
	});
	return events;
}

const postFormYaml = `
title: T
id: test_form
version: "2.0"
actions:
  - type: post
    url: "https://example.com/api/submit"
items:
  - id: name
    title: Name
`;

describe("yaml-form:submit-success", () => {
	test("post success dispatches once on the root and bubbles to document", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => ({
			ok: true,
			status: 200,
		}));
		const successes = listen(document, "yaml-form:submit-success");
		const errors = listen(document, "yaml-form:submit-error");
		setText(document, "name", "Jane");

		submitForm(document);
		await flush();

		expect(successes).toHaveLength(1);
		expect(errors).toHaveLength(0);
		const event = successes[0] as CustomEvent;
		expect(event.bubbles).toBe(true);
		expect(event.composed).toBe(false);
		expect(event.target).toBe(
			document.querySelector(".yaml-form-root") as Element,
		);
		const detail = event.detail as {
			form: { id?: string; version?: string };
			payload: SubmitPayload;
		};
		expect(detail.form).toEqual({ id: "test_form", version: "2.0" });
		expect(detail.payload.payload_version).toBe(1);
		expect(detail.payload.form).toEqual({
			title: "T",
			id: "test_form",
			version: "2.0",
		});
		expect(detail.payload.answers).toEqual({ name: "Jane" });
	});

	test("fires after the success UI is applied", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => ({
			ok: true,
			status: 200,
		}));
		const successVisibleAtDispatch: boolean[] = [];
		document.addEventListener("yaml-form:submit-success", () => {
			successVisibleAtDispatch.push(
				!document.querySelector(".form-success")?.hasAttribute("hidden"),
			);
		});
		submitForm(document);
		await flush();
		expect(successVisibleAtDispatch).toEqual([true]);
	});

	test("standalone form without id/version fires with undefined fields (log action)", async () => {
		const { document } = await loadDom(`
title: T
actions:
  - type: log
items:
  - id: name
    title: Name
`);
		const successes = listen(document, "yaml-form:submit-success");
		submitForm(document);
		await flush();
		expect(successes).toHaveLength(1);
		const detail = (successes[0] as CustomEvent).detail as {
			form: { id?: string; version?: string };
		};
		expect(detail.form.id).toBeUndefined();
		expect(detail.form.version).toBeUndefined();
	});

	test("mailto counts as success", async () => {
		const { document } = await loadDom(`
title: T
id: mail_form
actions:
  - type: mailto
    to: "a@example.com"
items:
  - id: name
    title: Name
`);
		const successes = listen(document, "yaml-form:submit-success");
		const errors = listen(document, "yaml-form:submit-error");
		submitForm(document);
		await flush();
		expect(successes).toHaveLength(1);
		expect(errors).toHaveLength(0);
	});
});

describe("yaml-form:submit-error", () => {
	test("a failing post dispatches once with the action failure reason", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => {
			throw new Error("network down");
		});
		const successes = listen(document, "yaml-form:submit-success");
		const errors = listen(document, "yaml-form:submit-error");

		submitForm(document);
		await flush();

		expect(errors).toHaveLength(1);
		expect(successes).toHaveLength(0);
		const event = errors[0] as CustomEvent;
		expect(event.bubbles).toBe(true);
		expect(event.composed).toBe(false);
		expect(event.target).toBe(
			document.querySelector(".yaml-form-root") as Element,
		);
		const detail = event.detail as {
			form: { id?: string; version?: string };
			message: string;
		};
		expect(detail.form).toEqual({ id: "test_form", version: "2.0" });
		expect(detail.message).toBe("network down");
	});

	test("a non-2xx response reports the status line message", async () => {
		const { document, window } = await loadDom(postFormYaml);
		(window as unknown as { fetch: unknown }).fetch = mock(async () => ({
			ok: false,
			status: 500,
		}));
		const errors = listen(document, "yaml-form:submit-error");
		submitForm(document);
		await flush();
		expect(errors).toHaveLength(1);
		expect((errors[0] as CustomEvent).detail.message).toBe(
			"POST https://example.com/api/submit responded with status 500",
		);
	});
});

describe("double-submit guard", () => {
	test("submits blocked while in flight dispatch no events", async () => {
		const { document, window } = await loadDom(postFormYaml);
		const pending = deferred<{ ok: boolean; status: number }>();
		(window as unknown as { fetch: unknown }).fetch = mock(
			() => pending.promise,
		);
		const successes = listen(document, "yaml-form:submit-success");
		const errors = listen(document, "yaml-form:submit-error");

		submitForm(document);
		await flush();
		submitForm(document);
		submitForm(document);
		await flush();
		expect(successes).toHaveLength(0);
		expect(errors).toHaveLength(0);

		pending.resolve({ ok: true, status: 200 });
		await flush();
		expect(successes).toHaveLength(1);
		expect(errors).toHaveLength(0);
	});
});
