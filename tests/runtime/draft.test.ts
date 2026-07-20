import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { DRAFT_PREFIX, draftKey } from "../../src/runtime/draft.ts";
import { initForm } from "../../src/runtime/form.ts";
import { parseForm } from "../../src/schema/index.ts";

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

interface LoadOptions {
	search?: string;
	seed?: Record<string, string>;
	beforeInit?: (window: Window) => void;
}

async function loadDom(source: string, options: LoadOptions = {}) {
	const html = await generateHtml(parseOk(source));
	const window = new Window({
		url: `https://example.com/form${options.search ?? ""}`,
	});
	for (const [key, value] of Object.entries(options.seed ?? {})) {
		window.localStorage.setItem(key, value);
	}
	window.document.write(html);
	options.beforeInit?.(window);
	const document = window.document as unknown as Document;
	initForm(document.querySelector(".yaml-form-root") as Element);
	return { window, document };
}

function fireChange(doc: Document, el: Element) {
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	el.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

function setText(doc: Document, name: string, value: string) {
	const input = doc.querySelector<HTMLInputElement>(`[name="${name}"]`);
	if (!input) throw new Error(`no input named ${name}`);
	input.value = value;
	fireChange(doc, input);
}

function selectChoice(doc: Document, name: string, value: string) {
	const inputs = Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
	);
	const chosen = inputs.find((el) => el.value === value);
	if (!chosen) throw new Error(`no input ${name}=${value}`);
	if (chosen.type === "radio") {
		for (const el of inputs) el.checked = el === chosen;
	} else {
		chosen.checked = true;
	}
	fireChange(doc, chosen);
}

function checkedValues(doc: Document, name: string): string[] {
	return Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
	)
		.filter((el) => el.checked)
		.map((el) => el.value);
}

function textValue(doc: Document, name: string): string | undefined {
	return doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(
		`[name="${name}"]`,
	)?.value;
}

function draftEntries(window: Window): [string, string][] {
	const out: [string, string][] = [];
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i);
		if (key?.startsWith(DRAFT_PREFIX))
			out.push([key, window.localStorage.getItem(key) ?? ""]);
	}
	return out;
}

function firePagehide(window: Window) {
	window.dispatchEvent(new window.Event("pagehide"));
}

function noticeHidden(doc: Document): boolean {
	const el = doc.querySelector(".draft-notice");
	if (!el) throw new Error("no draft notice slot");
	return el.hasAttribute("hidden");
}

const basicYaml = `
title: T
id: form1
version: "2"
items:
  - { title: Name, id: name }
  - { type: constant, title: C, id: c, value: fixed }
  - { type: choice, id: role, title: Role, choices: [student, teacher] }
`;

const fullYaml = `
title: T
id: form2
items:
  - { title: Name, id: name }
  - { type: long_text, title: Bio, id: bio }
  - { type: choice, id: tags, title: Tags, multiple: true, choices: [a, b, c] }
  - type: choice_table
    id: ct
    title: CT
    choices: [s1, s2]
    items: [q1, q2]
  - type: rubric
    id: rub
    title: Rubric
    comment_per_row: true
    choices:
      - { title: Novice, value: "1" }
      - { title: Expert, value: "2" }
    items:
      - { id: clarity, title: Clarity, descriptors: [d1, d2] }
`;

function makeDraft(answers: unknown, savedAt = new Date().toISOString()) {
	return JSON.stringify({ saved_at: savedAt, answers });
}

describe("draftKey", () => {
	test("includes id, version, and the canonical param signature", () => {
		const form = parseOk(basicYaml);
		expect(draftKey(form, "?role=student")).toBe(
			"yaml-form:draft:form1:2:role=student",
		);
	});

	test("falls back to title and empty version", () => {
		const form = parseOk("title: My Form\nitems:\n  - { title: A, id: a }\n");
		expect(draftKey(form, "")).toBe("yaml-form:draft:My Form::");
	});

	test("signature sorts keys, keeps repeated values in order, drops unknown params", () => {
		const form = parseOk(fullYaml);
		expect(draftKey(form, "?tags=b&name=x&tags=a&nope=1")).toBe(
			"yaml-form:draft:form2::name=x&tags=b&tags=a",
		);
	});
});

describe("saving", () => {
	test("no write before the first edit", async () => {
		const { window } = await loadDom(basicYaml);
		await Bun.sleep(400);
		expect(draftEntries(window).length).toBe(0);
	});

	test("debounced write after edits; constants not stored", async () => {
		const { window, document } = await loadDom(basicYaml);
		setText(document, "name", "Jane");
		selectChoice(document, "role", "teacher");
		expect(draftEntries(window).length).toBe(0); // not yet flushed
		await Bun.sleep(400);
		const entries = draftEntries(window);
		expect(entries.length).toBe(1);
		expect(entries[0]?.[0]).toBe(draftKey(parseOk(basicYaml), ""));
		const stored = JSON.parse(entries[0]?.[1] ?? "");
		expect(typeof stored.saved_at).toBe("string");
		expect(stored.answers.name).toBe("Jane");
		expect(stored.answers.role).toBe("teacher");
		expect(stored.answers).not.toHaveProperty("c");
	});

	test("pagehide flushes immediately", async () => {
		const { window, document } = await loadDom(basicYaml);
		setText(document, "name", "Jane");
		firePagehide(window);
		const entries = draftEntries(window);
		expect(entries.length).toBe(1);
		expect(JSON.parse(entries[0]?.[1] ?? "").answers.name).toBe("Jane");
	});
});

describe("restoring", () => {
	test("applies text, choice, table, and comment values", async () => {
		const key = draftKey(parseOk(fullYaml), "");
		const { document } = await loadDom(fullYaml, {
			seed: {
				[key]: makeDraft({
					name: "Jane",
					bio: "hello",
					tags: ["a", "c"],
					ct: { q1: "s2" },
					rub: { clarity: { value: "1", comment: "good" } },
				}),
			},
		});
		expect(textValue(document, "name")).toBe("Jane");
		expect(textValue(document, "bio")).toBe("hello");
		expect(checkedValues(document, "tags").sort()).toEqual(["a", "c"]);
		expect(checkedValues(document, "ct.q1")).toEqual(["s2"]);
		expect(checkedValues(document, "rub.clarity")).toEqual(["1"]);
		expect(textValue(document, "rub.clarity.comment")).toBe("good");
	});

	test("malformed JSON is skipped without breaking", async () => {
		const key = draftKey(parseOk(basicYaml), "");
		const { document } = await loadDom(basicYaml, {
			seed: { [key]: "{not json" },
		});
		expect(document.querySelectorAll(".form-item").length).toBeGreaterThan(0);
		expect(textValue(document, "name")).toBe("");
		expect(noticeHidden(document)).toBe(true);
	});

	test("unknown ids and out-of-set values are skipped, valid ones apply", async () => {
		const key = draftKey(parseOk(basicYaml), "");
		const { document } = await loadDom(basicYaml, {
			seed: {
				[key]: makeDraft({
					name: "kept",
					ghost: "x",
					role: "not-a-choice",
					c: "hacked",
				}),
			},
		});
		expect(textValue(document, "name")).toBe("kept");
		expect(checkedValues(document, "role")).toEqual([]);
		const data = document.querySelector(".yaml-form-data")?.textContent ?? "";
		expect(data).toContain('"fixed"');
		expect(data).not.toContain("hacked");
	});

	test("restores deselection: choices cleared by the user stay cleared over prefill", async () => {
		const yaml = `
title: T
id: desel
items:
  - { type: choice, id: role, title: Role, choices: [student, teacher] }
  - { type: choice, id: tags, title: Tags, multiple: true, choices: [a, b] }
`;
		const form = parseOk(yaml);
		const search = "?role=student&tags=a,b";
		// The user opened the prefilled URL, cleared everything, and left:
		// the snapshot has an empty multi-choice and no single-choice key.
		const { document } = await loadDom(yaml, {
			search,
			seed: { [draftKey(form, search)]: makeDraft({ tags: [] }) },
		});
		expect(checkedValues(document, "role")).toEqual([]);
		expect(checkedValues(document, "tags")).toEqual([]);
	});

	test("restores only on an exact key hit", async () => {
		const form = parseOk(basicYaml);
		const { document } = await loadDom(basicYaml, {
			search: "?role=teacher",
			seed: { [draftKey(form, "?role=student")]: makeDraft({ name: "Jane" }) },
		});
		expect(textValue(document, "name")).toBe("");
		expect(noticeHidden(document)).toBe(true);
	});

	test("draft overlays prefill for overlapping fields", async () => {
		const form = parseOk(basicYaml);
		const { document } = await loadDom(basicYaml, {
			search: "?name=FromUrl",
			seed: { [draftKey(form, "?name=FromUrl")]: makeDraft({ name: "Draft" }) },
		});
		expect(textValue(document, "name")).toBe("Draft");
	});

	test("visibility reflects restored answers on first render", async () => {
		const yaml = `
title: T
id: vis
items:
  - { type: choice, id: gate, title: Gate, choices: ["yes", "no"] }
  - { type: long_text, id: dep, title: Dep, visible_when: 'gate = "yes"' }
`;
		const key = draftKey(parseOk(yaml), "");
		const { document } = await loadDom(yaml, {
			seed: { [key]: makeDraft({ gate: "yes" }) },
		});
		const dep = document.querySelector('[data-item-id="dep"]');
		expect(dep?.hasAttribute("hidden")).toBe(false);
	});
});

describe("restore notice", () => {
	test("shown with role=status on restore, absent otherwise", async () => {
		const key = draftKey(parseOk(basicYaml), "");
		const { document } = await loadDom(basicYaml, {
			seed: { [key]: makeDraft({ name: "Jane" }) },
		});
		expect(noticeHidden(document)).toBe(false);
		expect(document.querySelector(".draft-notice")?.getAttribute("role")).toBe(
			"status",
		);

		const pristine = await loadDom(basicYaml);
		expect(noticeHidden(pristine.document)).toBe(true);
	});

	test("no notice when the draft matches nothing in the form", async () => {
		const key = draftKey(parseOk(basicYaml), "");
		const { document } = await loadDom(basicYaml, {
			seed: { [key]: makeDraft({ ghost: "x", other: ["y"] }) },
		});
		expect(noticeHidden(document)).toBe(true);
		expect(textValue(document, "name")).toBe("");
	});

	test("discard removes the draft, resets the fields, and confirms in place", async () => {
		const key = draftKey(parseOk(basicYaml), "");
		const { window, document } = await loadDom(basicYaml, {
			seed: { [key]: makeDraft({ name: "Jane" }) },
		});
		expect(textValue(document, "name")).toBe("Jane");
		const button = document.querySelector<HTMLElement>(".draft-discard");
		if (!button) throw new Error("no discard button");
		button.click();
		expect(window.localStorage.getItem(key)).toBeNull();
		// No reload (file:// may refuse it): fields reset in place, and the
		// notice becomes the confirmation instead of vanishing silently.
		expect(textValue(document, "name")).toBe("");
		expect(noticeHidden(document)).toBe(false);
		expect(document.querySelector(".draft-notice-message")?.textContent).toBe(
			"Draft discarded.",
		);
		expect(document.querySelector(".draft-discard")).toBeNull();
	});

	test("discard returns to the pristine URL-prefilled state", async () => {
		const key = draftKey(parseOk(basicYaml), "?role=student");
		const { window, document } = await loadDom(basicYaml, {
			search: "?role=student",
			seed: { [key]: makeDraft({ name: "Jane", role: "teacher" }) },
		});
		expect(checkedValues(document, "role")).toEqual(["teacher"]);
		document.querySelector<HTMLElement>(".draft-discard")?.click();
		expect(window.localStorage.getItem(key)).toBeNull();
		expect(checkedValues(document, "role")).toEqual(["student"]);
		expect(textValue(document, "name")).toBe("");
	});

	test("autosave keeps working after a discard", async () => {
		const key = draftKey(parseOk(basicYaml), "");
		const { window, document } = await loadDom(basicYaml, {
			seed: { [key]: makeDraft({ name: "Jane" }) },
		});
		document.querySelector<HTMLElement>(".draft-discard")?.click();
		expect(window.localStorage.getItem(key)).toBeNull();
		setText(document, "name", "typed after discard");
		firePagehide(window);
		const stored = window.localStorage.getItem(key);
		expect(stored).not.toBeNull();
		expect(JSON.parse(stored ?? "{}").answers.name).toBe("typed after discard");
	});
});

describe("draft lifecycle after submit", () => {
	const logYaml = `
title: T
id: lifecycle
actions:
  - type: log
items:
  - { title: Name, id: name }
`;

	test("pagehide after a successful submit does not resurrect the draft", async () => {
		const { window, document } = await loadDom(logYaml);
		setText(document, "name", "Jane");
		firePagehide(window); // draft persisted
		const key = draftKey(parseOk(logYaml), "");
		expect(window.localStorage.getItem(key)).not.toBeNull();
		submitForm(document);
		await flushMicrotasks();
		expect(window.localStorage.getItem(key)).toBeNull();
		firePagehide(window); // leaving the success screen
		expect(window.localStorage.getItem(key)).toBeNull();
	});

	test("a pending debounce timer does not resurrect the draft", async () => {
		const { window, document } = await loadDom(logYaml);
		setText(document, "name", "Jane"); // schedules a debounced save
		submitForm(document); // succeeds before the timer fires
		await flushMicrotasks();
		await Bun.sleep(400);
		const key = draftKey(parseOk(logYaml), "");
		expect(window.localStorage.getItem(key)).toBeNull();
	});

	test("the restore notice is hidden on the success screen", async () => {
		const key = draftKey(parseOk(logYaml), "");
		const { document } = await loadDom(logYaml, {
			seed: { [key]: makeDraft({ name: "Jane" }) },
		});
		expect(noticeHidden(document)).toBe(false);
		submitForm(document);
		await flushMicrotasks();
		expect(noticeHidden(document)).toBe(true);
	});
});

describe("pruning", () => {
	test("entries older than 30 days are pruned at init; fresh ones stay", async () => {
		const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
		const { window } = await loadDom(basicYaml, {
			seed: {
				[`${DRAFT_PREFIX}other-form::`]: makeDraft({ a: "1" }, old),
				[`${DRAFT_PREFIX}fresh-form::`]: makeDraft({ a: "1" }),
			},
		});
		expect(
			window.localStorage.getItem(`${DRAFT_PREFIX}other-form::`),
		).toBeNull();
		expect(
			window.localStorage.getItem(`${DRAFT_PREFIX}fresh-form::`),
		).not.toBeNull();
	});
});

describe("autosave: false", () => {
	const offYaml = `
title: T
id: off
autosave: false
items:
  - { title: Name, id: name }
`;

	test("no reads, no writes, no notice", async () => {
		const key = draftKey(parseOk(offYaml), "");
		const oldKey = `${DRAFT_PREFIX}stale::`;
		const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
		const seeded = makeDraft({ name: "Jane" });
		const { window, document } = await loadDom(offYaml, {
			seed: {
				[key]: seeded,
				[oldKey]: makeDraft({ a: "1" }, old),
			},
		});
		expect(textValue(document, "name")).toBe(""); // not restored
		// the notice slot is not even generated for autosave: false
		expect(document.querySelectorAll(".draft-notice").length).toBe(0);
		setText(document, "name", "typed");
		firePagehide(window);
		await Bun.sleep(400);
		expect(window.localStorage.getItem(key)).toBe(seeded);
		expect(window.localStorage.getItem(oldKey)).not.toBeNull(); // no pruning either
	});
});

function submitForm(doc: Document) {
	const form = doc.querySelector(".yaml-form-root form") as HTMLFormElement;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

const flushMicrotasks = () =>
	new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("submit clears the draft", () => {
	const withActions = (actions: string) => `
title: T
id: submit-form
${actions}
items:
  - { title: Name, id: name }
`;

	async function editedDom(source: string) {
		const loaded = await loadDom(source);
		setText(loaded.document, "name", "Jane");
		firePagehide(loaded.window); // persist immediately
		const key = draftKey(parseOk(source), "");
		expect(loaded.window.localStorage.getItem(key)).not.toBeNull();
		return { ...loaded, key };
	}

	test("log action success removes the draft", async () => {
		const source = withActions("actions:\n  - type: log");
		const { window, document, key } = await editedDom(source);
		submitForm(document);
		await flushMicrotasks();
		expect(window.localStorage.getItem(key)).toBeNull();
	});

	test("post action success removes the draft", async () => {
		const source = withActions(
			'actions:\n  - type: post\n    url: "https://example.com/api"',
		);
		const { window, document, key } = await editedDom(source);
		(window as unknown as { fetch: unknown }).fetch = () =>
			Promise.resolve({ ok: true, status: 200 });
		submitForm(document);
		await flushMicrotasks();
		expect(window.localStorage.getItem(key)).toBeNull();
	});

	test("post action failure keeps the draft", async () => {
		const source = withActions(
			'actions:\n  - type: post\n    url: "https://example.com/api"',
		);
		const { window, document, key } = await editedDom(source);
		(window as unknown as { fetch: unknown }).fetch = () =>
			Promise.reject(new Error("network down"));
		submitForm(document);
		await flushMicrotasks();
		expect(window.localStorage.getItem(key)).not.toBeNull();
	});

	test("mailto success keeps the draft", async () => {
		const source = withActions(
			'actions:\n  - type: mailto\n    to: "a@example.com"',
		);
		const { window, document, key } = await editedDom(source);
		submitForm(document);
		await flushMicrotasks();
		expect(window.localStorage.getItem(key)).not.toBeNull();
	});
});

describe("storage failure", () => {
	test("throwing storage disables autosave silently", async () => {
		const { window, document } = await loadDom(basicYaml, {
			beforeInit: (win) => {
				win.localStorage.setItem = () => {
					throw new Error("quota exceeded");
				};
				win.localStorage.getItem = () => {
					throw new Error("disabled");
				};
			},
		});
		setText(document, "name", "Jane");
		firePagehide(window);
		await Bun.sleep(400);
		// The form itself keeps working.
		expect(textValue(document, "name")).toBe("Jane");
		expect(noticeHidden(document)).toBe(true);
	});
});
