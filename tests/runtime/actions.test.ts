import { describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import {
	type ActionEnv,
	buildMailtoBody,
	buildMailtoUrl,
	runActions,
} from "../../src/runtime/actions.ts";
import { initForm } from "../../src/runtime/form.ts";
import { buildPayload, type SubmitPayload } from "../../src/runtime/submit.ts";
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

function setText(doc: Document, id: string, value: string) {
	const input = doc.querySelector(`[name="${id}"]`) as HTMLInputElement | null;
	if (!input) throw new Error(`no input named ${id}`);
	input.value = value;
}

function testEnv(overrides: Partial<ActionEnv> = {}): ActionEnv {
	return {
		log: mock(() => {}),
		fetch: mock(async () => ({ ok: true, status: 200 })),
		openUrl: mock(() => {}),
		...overrides,
	};
}

const simpleFormYaml = `
title: Test Form
items:
  - id: a
    title: A
`;

describe("payload builder", () => {
	test("builds the documented snake_case payload shape", () => {
		const form = parseOk(`
title: Test Form
id: test_form
version: "2.0"
items:
  - id: a
    title: A
`);
		const payload = buildPayload(
			form,
			{ a: "x" },
			{ generator: "yaml-form/1.2.3" },
		);
		expect(payload).toEqual({
			payload_version: 1,
			generator: "yaml-form/1.2.3",
			form: { title: "Test Form", id: "test_form", version: "2.0" },
			submitted_at: expect.stringMatching(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
			) as unknown as string,
			answers: { a: "x" },
		});
	});

	test("omits form.id and form.version when unset in the YAML", () => {
		const form = parseOk(simpleFormYaml);
		const payload = buildPayload(form, {}, { generator: "g" });
		expect(payload.form).toEqual({ title: "Test Form" });
		expect(payload.form).not.toHaveProperty("id");
		expect(payload.form).not.toHaveProperty("version");
	});

	test("submitted_at keeps the client's local UTC offset", () => {
		const form = parseOk(simpleFormYaml);
		const now = new Date(2026, 6, 18, 21, 34, 56);
		const payload = buildPayload(form, {}, { generator: "g", now });
		const offsetMin = -now.getTimezoneOffset();
		const sign = offsetMin >= 0 ? "+" : "-";
		const abs = Math.abs(offsetMin);
		const pad = (n: number) => String(n).padStart(2, "0");
		expect(payload.submitted_at).toBe(
			`2026-07-18T21:34:56${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`,
		);
	});
});

describe("individual actions", () => {
	const logForm = parseOk(`
title: Test Form
actions:
  - type: log
items:
  - id: a
    title: A
`);
	const postForm = parseOk(`
title: Test Form
actions:
  - type: post
    url: "https://example.com/api/submit"
items:
  - id: a
    title: A
`);
	const payloadOf = (form: ReturnType<typeof parseOk>) =>
		buildPayload(form, { a: "x" }, { generator: "yaml-form/0.0.0" });

	test("log passes the payload to the console and succeeds", async () => {
		const logSpy = mock((..._args: unknown[]) => {});
		const env = testEnv({ log: logSpy });
		const payload = payloadOf(logForm);
		const result = await runActions(logForm.actions, payload, logForm, env);
		expect(result.ok).toBe(true);
		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy.mock.calls[0]?.[0]).toEqual(payload);
	});

	test("post sends the payload as JSON and succeeds on 2xx", async () => {
		const fetchSpy = mock(
			async (
				_url: string,
				_init: {
					method: string;
					headers: Record<string, string>;
					body: string;
				},
			) => ({ ok: true, status: 200 }),
		);
		const env = testEnv({ fetch: fetchSpy });
		const payload = payloadOf(postForm);
		const result = await runActions(postForm.actions, payload, postForm, env);
		expect(result.ok).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0] ?? [];
		expect(url).toBe("https://example.com/api/submit");
		expect(init?.method).toBe("POST");
		expect(init?.headers["Content-Type"]).toBe("application/json");
		expect(JSON.parse(init?.body ?? "")).toEqual(payload);
	});

	test("post accepts a relative url (resolved by the browser at fetch)", async () => {
		const relForm = parseOk(`
title: Test Form
actions:
  - type: post
    url: "/api/submit"
items:
  - id: a
    title: A
`);
		const fetchSpy = mock(
			async (
				_url: string,
				_init: {
					method: string;
					headers: Record<string, string>;
					body: string;
				},
			) => ({ ok: true, status: 200 }),
		);
		const env = testEnv({ fetch: fetchSpy });
		const result = await runActions(
			relForm.actions,
			payloadOf(relForm),
			relForm,
			env,
		);
		expect(result.ok).toBe(true);
		expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/submit");
	});

	test("post fails on a non-2xx response", async () => {
		const env = testEnv({
			fetch: mock(async () => ({ ok: false, status: 500 })),
		});
		const result = await runActions(
			postForm.actions,
			payloadOf(postForm),
			postForm,
			env,
		);
		expect(result.ok).toBe(false);
	});

	test("post fails on a network error", async () => {
		const env = testEnv({
			fetch: mock(async () => {
				throw new Error("network down");
			}),
		});
		const result = await runActions(
			postForm.actions,
			payloadOf(postForm),
			postForm,
			env,
		);
		expect(result.ok).toBe(false);
	});

	test("mailto opens a mailto URL (default subject = form title) and succeeds", async () => {
		const form = parseOk(`
title: Test Form
actions:
  - type: mailto
    to: "example@example.com"
items:
  - id: a
    title: A
`);
		const openSpy = mock((..._args: unknown[]) => {});
		const env = testEnv({ openUrl: openSpy });
		const payload = payloadOf(form);
		const result = await runActions(form.actions, payload, form, env);
		expect(result.ok).toBe(true);
		expect(openSpy).toHaveBeenCalledTimes(1);
		const url = openSpy.mock.calls[0]?.[0] as unknown as string;
		expect(url.startsWith("mailto:example@example.com?")).toBe(true);
		expect(url).toContain(`subject=${encodeURIComponent("Test Form")}`);
		expect(url).toContain(
			`body=${encodeURIComponent(buildMailtoBody(form, payload.answers))}`,
		);
	});

	test("mailto uses an explicit subject when given", () => {
		const form = parseOk(`
title: Test Form
actions:
  - type: mailto
    to: "example@example.com"
    subject: "Custom subject"
items:
  - id: a
    title: A
`);
		const action = form.actions[0];
		if (action?.type !== "mailto") throw new Error("expected mailto action");
		const url = buildMailtoUrl(action, form, { a: "x" });
		expect(url).toContain(`subject=${encodeURIComponent("Custom subject")}`);
	});

	test("mailto fails when opening the URL throws", async () => {
		const form = parseOk(`
title: Test Form
actions:
  - type: mailto
    to: "example@example.com"
items:
  - id: a
    title: A
`);
		const env = testEnv({
			openUrl: () => {
				throw new Error("blocked");
			},
		});
		const result = await runActions(form.actions, payloadOf(form), form, env);
		expect(result.ok).toBe(false);
	});
});

describe("sequential execution", () => {
	const form = parseOk(`
title: Test Form
actions:
  - type: log
  - type: post
    url: "https://example.com/api/submit"
  - type: mailto
    to: "example@example.com"
items:
  - id: a
    title: A
`);
	const payload = buildPayload(form, { a: "x" }, { generator: "g" });

	test("runs actions in order when all succeed", async () => {
		const calls: string[] = [];
		const env: ActionEnv = {
			log: () => {
				calls.push("log");
			},
			fetch: async () => {
				calls.push("post");
				return { ok: true, status: 200 };
			},
			openUrl: () => {
				calls.push("mailto");
			},
		};
		const result = await runActions(form.actions, payload, form, env);
		expect(result.ok).toBe(true);
		expect(calls).toEqual(["log", "post", "mailto"]);
	});

	test("stops at the first failure", async () => {
		const calls: string[] = [];
		const env: ActionEnv = {
			log: () => {
				calls.push("log");
			},
			fetch: async () => {
				calls.push("post");
				return { ok: false, status: 500 };
			},
			openUrl: () => {
				calls.push("mailto");
			},
		};
		const result = await runActions(form.actions, payload, form, env);
		expect(result.ok).toBe(false);
		expect(calls).toEqual(["log", "post"]);
	});
});

describe("mailto body", () => {
	const form = parseOk(`
title: Test Form
actions:
  - type: mailto
    to: "example@example.com"
items:
  - type: short_text
    id: short_text_item
    title: Short Text
  - type: short_text
    id: empty_item
    title: Left Empty
  - type: choice
    id: multiple_choice
    title: Multiple Choice
    multiple: true
    choices:
      - option1
      - option2
      - { title: option4, value: value4 }
  - type: choice_table
    id: choice_table_item
    title: Choice Table
    items: [sub_question1, sub_question2]
    choices: [scale1, scale2, scale3]
  - type: rubric
    id: rubric_item
    title: Presentation Rubric
    choices:
      - { title: Novice, value: "1" }
      - { title: Competent, value: "2" }
      - { title: Expert, value: "3" }
    items:
      - { id: clarity, title: Clarity, descriptors: [a, b, c] }
      - { id: evidence, title: Use of evidence, descriptors: [a, b, c] }
`);

	test("matches the documented plain-text format", () => {
		const body = buildMailtoBody(form, {
			short_text_item: "free text",
			multiple_choice: ["option1", "value4"],
			choice_table_item: { sub_question1: "scale3" },
			rubric_item: { clarity: "2", evidence: "3" },
		});
		expect(body).toBe(
			[
				"Test Form",
				"=========",
				"Short Text: free text",
				"Multiple Choice: option1, value4",
				"Choice Table:",
				"  sub_question1: scale3",
				"Presentation Rubric:",
				"  Clarity: Competent (2)",
				"  Use of evidence: Expert (3)",
			].join("\n"),
		);
	});

	test("renders multiple selections per table row and per-row comments", () => {
		const body = buildMailtoBody(form, {
			choice_table_item: { sub_question1: ["scale1", "scale3"] },
			rubric_item: { clarity: { value: "2", comment: "well done" } },
		});
		expect(body).toBe(
			[
				"Test Form",
				"=========",
				"Choice Table:",
				"  sub_question1: scale1, scale3",
				"Presentation Rubric:",
				"  Clarity: Competent (2) — well done",
			].join("\n"),
		);
	});

	test("omits unanswered items entirely", () => {
		const body = buildMailtoBody(form, {
			short_text_item: "hello",
			empty_item: "",
			multiple_choice: [],
			choice_table_item: {},
		});
		expect(body).toBe(
			["Test Form", "=========", "Short Text: hello"].join("\n"),
		);
	});
});

describe("submit flow in the generated page", () => {
	test("shows the success screen with post_submit.message and logs the payload", async () => {
		const { document, window } = await loadDom(`
title: T
description: "How to fill in this form"
actions:
  - type: log
post_submit:
  message: "Custom thanks"
items:
  - id: name
    title: Name
`);
		const logSpy = mock((..._args: unknown[]) => {});
		(window as unknown as { console: { log: unknown } }).console.log = logSpy;
		setText(document, "name", "Alice");
		submitForm(document);
		await flush();
		expect(
			document.querySelector(".yaml-form-root form")?.hasAttribute("hidden"),
		).toBe(true);
		const success = document.querySelector(".form-success");
		expect(success?.hasAttribute("hidden")).toBe(false);
		// the message lands in the dedicated slot, next to the checkmark icon
		expect(success?.querySelector(".success-message")?.textContent).toBe(
			"Custom thanks",
		);
		expect(success?.querySelector(".success-icon")).not.toBeNull();
		// Success screen keeps the form title but hides the description
		expect(document.querySelector("h1")?.textContent).toBe("T");
		expect(
			document.querySelector(".form-description")?.hasAttribute("hidden"),
		).toBe(true);
		const payload = logSpy.mock.calls[0]?.[0] as unknown as SubmitPayload;
		expect(payload.payload_version).toBe(1);
		expect(payload.generator).toMatch(/^yaml-form\/\d+\.\d+\.\d+$/);
		expect(payload.form).toEqual({ title: "T" });
		expect(payload.answers).toEqual({ name: "Alice" });
	});

	test("shows a default success message when post_submit.message is unset", async () => {
		const { document } = await loadDom(`
title: T
actions:
  - type: log
items:
  - id: name
    title: Name
`);
		submitForm(document);
		await flush();
		const success = document.querySelector(".form-success");
		expect(success?.hasAttribute("hidden")).toBe(false);
		expect(success?.querySelector(".success-message")?.textContent).toBe(
			"Your response has been submitted.",
		);
	});

	test("a failed action keeps the form with a retry-able error; retry re-runs all actions", async () => {
		const { document, window } = await loadDom(`
title: T
actions:
  - type: log
  - type: post
    url: "https://example.com/api/submit"
items:
  - id: name
    title: Name
`);
		const logSpy = mock(() => {});
		(window as unknown as { console: { log: unknown } }).console.log = logSpy;
		const failingFetch = mock(async () => {
			throw new Error("network down");
		});
		(window as unknown as { fetch: unknown }).fetch = failingFetch;
		setText(document, "name", "keep me");
		submitForm(document);
		await flush();

		// Form stays with input preserved and a visible error message.
		expect(
			document.querySelector(".yaml-form-root form")?.hasAttribute("hidden"),
		).toBe(false);
		const error = document.querySelector(".form-error");
		expect(error?.hasAttribute("hidden")).toBe(false);
		expect(error?.textContent).not.toBe("");
		expect(
			(document.querySelector('[name="name"]') as HTMLInputElement).value,
		).toBe("keep me");
		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(failingFetch).toHaveBeenCalledTimes(1);
		expect(
			document.querySelector(".form-success")?.hasAttribute("hidden"),
		).toBe(true);

		// Retry re-runs all actions from the start.
		const okFetch = mock(async () => ({ ok: true, status: 200 }));
		(window as unknown as { fetch: unknown }).fetch = okFetch;
		submitForm(document);
		await flush();
		expect(logSpy).toHaveBeenCalledTimes(2);
		expect(okFetch).toHaveBeenCalledTimes(1);
		expect(error?.hasAttribute("hidden")).toBe(true);
		expect(
			document.querySelector(".yaml-form-root form")?.hasAttribute("hidden"),
		).toBe(true);
		expect(
			document.querySelector(".form-success")?.hasAttribute("hidden"),
		).toBe(false);
	});
});
