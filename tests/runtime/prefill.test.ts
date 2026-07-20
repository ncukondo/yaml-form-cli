import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { collectAnswers, initForm } from "../../src/runtime/form.ts";
import { parseForm } from "../../src/schema/index.ts";

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

async function loadDom(source: string, search = "") {
	const html = await generateHtml(parseOk(source));
	const window = new Window({ url: `https://example.com/form${search}` });
	window.document.write(html);
	const document = window.document as unknown as Document;
	initForm(document.querySelector(".yaml-form-root") as Element);
	return document;
}

function textValue(doc: Document, name: string): string | undefined {
	return doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(
		`[name="${name}"]`,
	)?.value;
}

function checkedValues(doc: Document, name: string): string[] {
	return Array.from(
		doc.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`),
	)
		.filter((el) => el.checked)
		.map((el) => el.value);
}

function isHidden(doc: Document, itemId: string): boolean {
	const el = doc.querySelector(`[data-item-id="${itemId}"]`);
	if (!el) throw new Error(`no item ${itemId}`);
	return el.hasAttribute("hidden");
}

const warnSpy = spyOn(console, "warn");
afterEach(() => {
	warnSpy.mockClear();
});

const textYaml = `
title: T
items:
  - { title: Name, id: name }
  - { type: long_text, title: Bio, id: bio }
`;

describe("text prefill", () => {
	test("short_text and long_text are set verbatim", async () => {
		const doc = await loadDom(textYaml, "?name=John&bio=hello");
		expect(textValue(doc, "name")).toBe("John");
		expect(textValue(doc, "bio")).toBe("hello");
	});

	test("plus and percent-encoding decode; comma stays untouched", async () => {
		const doc = await loadDom(textYaml, "?name=John+Doe&bio=a,b%2Cc");
		expect(textValue(doc, "name")).toBe("John Doe");
		expect(textValue(doc, "bio")).toBe("a,b,c");
	});

	test("repeated single-valued param: last one wins", async () => {
		const doc = await loadDom(textYaml, "?name=first&name=second");
		expect(textValue(doc, "name")).toBe("second");
	});

	test("no parameters leaves the form pristine", async () => {
		const doc = await loadDom(textYaml);
		expect(textValue(doc, "name")).toBe("");
		expect(warnSpy).not.toHaveBeenCalled();
	});
});

const choiceYaml = `
title: T
items:
  - type: choice
    id: role
    title: Role
    choices: [student, teacher]
  - type: choice
    id: tags
    title: Tags
    multiple: true
    choices: ["a", "b", "c", "with,comma"]
`;

describe("choice prefill", () => {
	test("single choice checked by value", async () => {
		const doc = await loadDom(choiceYaml, "?role=teacher");
		expect(checkedValues(doc, "role")).toEqual(["teacher"]);
	});

	test("unknown choice value is ignored with a warning", async () => {
		const doc = await loadDom(choiceYaml, "?role=admin");
		expect(checkedValues(doc, "role")).toEqual([]);
		expect(warnSpy).toHaveBeenCalled();
	});

	test("repeated single-choice param: last one wins", async () => {
		const doc = await loadDom(choiceYaml, "?role=student&role=teacher");
		expect(checkedValues(doc, "role")).toEqual(["teacher"]);
	});

	test("multiple: union of repeated params", async () => {
		const doc = await loadDom(choiceYaml, "?tags=a&tags=b");
		expect(checkedValues(doc, "tags").sort()).toEqual(["a", "b"]);
	});

	test("multiple: comma shorthand splits", async () => {
		const doc = await loadDom(choiceYaml, "?tags=a,b");
		expect(checkedValues(doc, "tags").sort()).toEqual(["a", "b"]);
	});

	test("a choice value containing a comma matches whole and is not split", async () => {
		const doc = await loadDom(choiceYaml, "?tags=with%2Ccomma");
		expect(checkedValues(doc, "tags")).toEqual(["with,comma"]);
	});

	test("unmatched comma-shorthand tokens warn, matched ones apply", async () => {
		const doc = await loadDom(choiceYaml, "?tags=a,nope");
		expect(checkedValues(doc, "tags")).toEqual(["a"]);
		expect(warnSpy).toHaveBeenCalled();
	});

	test("no comma splitting for single-select targets", async () => {
		const doc = await loadDom(choiceYaml, "?role=student,teacher");
		expect(checkedValues(doc, "role")).toEqual([]);
		expect(warnSpy).toHaveBeenCalled();
	});
});

const tableYaml = `
title: T
items:
  - type: choice_table
    id: ct
    title: CT
    choices: [s1, s2]
    items: [q1, q2]
  - type: choice_table
    id: mt
    title: MT
    multiple: true
    choices: [s1, s2, s3]
    items: [q1]
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

describe("table prefill", () => {
	test("choice_table row via <id>.<rowKey>", async () => {
		const doc = await loadDom(tableYaml, "?ct.q1=s2");
		expect(checkedValues(doc, "ct.q1")).toEqual(["s2"]);
		expect(checkedValues(doc, "ct.q2")).toEqual([]);
	});

	test("multiple choice_table row takes the comma-shorthand union", async () => {
		const doc = await loadDom(tableYaml, "?mt.q1=s1,s3");
		expect(checkedValues(doc, "mt.q1").sort()).toEqual(["s1", "s3"]);
	});

	test("rubric row and per-row comment", async () => {
		const doc = await loadDom(
			tableYaml,
			"?rub.clarity=2&rub.clarity.comment=Nice+work",
		);
		expect(checkedValues(doc, "rub.clarity")).toEqual(["2"]);
		expect(textValue(doc, "rub.clarity.comment")).toBe("Nice work");
	});
});

const constantYaml = `
title: T
items:
  - { type: constant, title: Role, id: role, value: student, from_url: true }
  - { type: constant, title: Fixed, id: fixed, value: locked }
  - { type: constant, title: Respondent, id: respondent, value: anonymous, from_url: true, hidden: true }
  - { title: Detail, id: detail, visible_when: 'role = "teacher"' }
`;

describe("constant override", () => {
	test("from_url constant: embedded JSON, rendered text, and answers see the override", async () => {
		const doc = await loadDom(constantYaml, "?role=teacher");
		const data = doc.querySelector(".yaml-form-data")?.textContent ?? "";
		expect(data).toContain('"teacher"');
		const section = doc.querySelector('[data-item-id="role"]');
		expect(section?.querySelector(".constant-value")?.textContent).toBe(
			"teacher",
		);
		expect(collectAnswers(doc).role).toBe("teacher");
	});

	test("visible_when sees the override on first render", async () => {
		const withOverride = await loadDom(constantYaml, "?role=teacher");
		expect(isHidden(withOverride, "detail")).toBe(false);
		const without = await loadDom(constantYaml);
		expect(isHidden(without, "detail")).toBe(true);
	});

	test("without from_url the parameter is ignored", async () => {
		const doc = await loadDom(constantYaml, "?fixed=hacked");
		expect(collectAnswers(doc).fixed).toBe("locked");
		const data = doc.querySelector(".yaml-form-data")?.textContent ?? "";
		expect(data).not.toContain("hacked");
		expect(warnSpy).toHaveBeenCalled();
	});

	test("hidden + from_url constant lands in answers without a section", async () => {
		const doc = await loadDom(constantYaml, "?respondent=r042");
		expect(doc.querySelectorAll('[data-item-id="respondent"]').length).toBe(0);
		expect(collectAnswers(doc).respondent).toBe("r042");
	});
});

describe("robustness", () => {
	test("unknown parameter names are ignored with a warning, rendering intact", async () => {
		const doc = await loadDom(textYaml, "?nope=1&name=John");
		expect(textValue(doc, "name")).toBe("John");
		expect(warnSpy).toHaveBeenCalled();
		expect(doc.querySelectorAll(".form-item").length).toBe(2);
	});

	test("prefill shows no error slots", async () => {
		const doc = await loadDom(
			`
title: T
items:
  - { title: Name, id: name, required: true }
  - { type: choice, id: role, title: Role, required: true, choices: [student, teacher] }
`,
			"?role=student",
		);
		const slots = Array.from(doc.querySelectorAll("[data-error-for]"));
		expect(slots.length).toBeGreaterThan(0);
		expect(slots.every((el) => el.hasAttribute("hidden"))).toBe(true);
	});

	test("initial visibility reflects prefilled answers", async () => {
		const doc = await loadDom(
			`
title: T
items:
  - { type: choice, id: has_other, title: Other?, choices: ["yes", "no"] }
  - { type: long_text, id: other, title: Other, visible_when: 'has_other = "yes"' }
`,
			"?has_other=yes",
		);
		expect(isHidden(doc, "other")).toBe(false);
	});
});
