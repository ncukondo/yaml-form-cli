import { describe, expect, test } from "bun:test";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

function parseErrors(source: string) {
	const result = parseForm(source);
	if (result.ok) throw new Error("expected parse to fail");
	return result.errors;
}

const baseForm = `
title: "Rule Key Test"
items:
  - type: "choice"
    id: "has_other"
    title: "Do you have other comments?"
    choices: ["yes", "no"]
`;

function rubricForm(commentPerRow: boolean, visibleWhen: string): string {
	return `
title: "Rubric Rule Test"
items:
  - type: "rubric"
    id: "rubric"
    title: "Rubric"
    comment_per_row: ${commentPerRow}
    choices:
      - { title: "Novice", value: "1" }
      - { title: "Expert", value: "2" }
    items:
      - id: "clarity"
        title: "Clarity"
        descriptors: ["bad", "good"]
  - type: "long_text"
    id: "feedback"
    title: "Feedback"
    visible_when: '${visibleWhen}'
`;
}

describe("rule-key validation", () => {
	test("valid sample.yaml passes", () => {
		const result = parseForm(sampleYaml);
		expect(result.ok).toBe(true);
	});

	test("typo in a rule key fails with the item's path and the key name", () => {
		const errors = parseErrors(`${baseForm}
  - type: "long_text"
    id: "other_comments"
    title: "Other Comments"
    visible_when: 'has_othr = "yes"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("unknown_rule_key");
		expect(errors[0]?.path).toBe("items[1].visible_when");
		expect(errors[0]?.message).toContain("has_othr");
		expect(errors[0]?.message).toContain("other_comments");
	});

	test("dotted choice_table row keys are valid, including id overrides", () => {
		const result = parseForm(`
title: "Table Rule Test"
items:
  - type: "choice_table"
    id: "table"
    title: "Table"
    items:
      - "row1"
      - { title: "row2", id: "r2" }
    choices: ["a", "b"]
  - type: "long_text"
    id: "follow_up"
    title: "Follow up"
    visible_when: 'table.row1 = "a" and table.r2 = "b"'
`);
		expect(result.ok).toBe(true);
	});

	test("bare choice_table item id is not a valid rule key", () => {
		const errors = parseErrors(`
title: "Table Rule Test"
items:
  - type: "choice_table"
    id: "table"
    title: "Table"
    items: ["row1"]
    choices: ["a", "b"]
  - type: "long_text"
    id: "follow_up"
    title: "Follow up"
    visible_when: 'table = "a"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("unknown_rule_key");
		expect(errors[0]?.message).toContain('"table"');
	});

	test("with comment_per_row: false, bare row key is valid and .value is not", () => {
		expect(parseForm(rubricForm(false, 'rubric.clarity = "1"')).ok).toBe(true);

		const errors = parseErrors(rubricForm(false, 'rubric.clarity.value = "1"'));
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("unknown_rule_key");
		expect(errors[0]?.path).toBe("items[1].visible_when");
		expect(errors[0]?.message).toContain("rubric.clarity.value");
	});

	test("with comment_per_row: true, bare row key is invalid and .value/.comment are valid", () => {
		const errors = parseErrors(rubricForm(true, 'rubric.clarity = "1"'));
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("unknown_rule_key");
		expect(errors[0]?.path).toBe("items[1].visible_when");
		expect(errors[0]?.message).toContain("rubric.clarity");

		expect(parseForm(rubricForm(true, 'rubric.clarity.value = "1"')).ok).toBe(
			true,
		);
		expect(
			parseForm(rubricForm(true, 'rubric.clarity.comment includes "x"')).ok,
		).toBe(true);
	});

	test("unknown keys inside anyOf/allOf/noneOf lists are reported", () => {
		const errors = parseErrors(`${baseForm}
  - type: "choice"
    id: "second"
    title: "Second"
    choices: ["yes", "no"]
  - type: "long_text"
    id: "other_comments"
    title: "Other Comments"
    visible_when: 'anyOf(has_other,secnd) = "yes"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("unknown_rule_key");
		expect(errors[0]?.path).toBe("items[2].visible_when");
		expect(errors[0]?.message).toContain("secnd");
	});

	test("each unknown key is reported separately", () => {
		const errors = parseErrors(`${baseForm}
  - type: "long_text"
    id: "other_comments"
    title: "Other Comments"
    visible_when: 'oops = "1" or allOf(has_other,typo2) = "yes"'
`);
		expect(errors).toHaveLength(2);
		const keys = errors.map((e) => e.message);
		expect(keys.some((m) => m.includes("oops"))).toBe(true);
		expect(keys.some((m) => m.includes("typo2"))).toBe(true);
		for (const e of errors) {
			expect(e.code).toBe("unknown_rule_key");
			expect(e.path).toBe("items[1].visible_when");
		}
	});

	test("a syntax error in an expression is a generation error with the item's path", () => {
		const errors = parseErrors(`${baseForm}
  - type: "long_text"
    id: "other_comments"
    title: "Other Comments"
    visible_when: 'has_other == "yes"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_syntax_error");
		expect(errors[0]?.path).toBe("items[1].visible_when");
		expect(errors[0]?.message).toContain("other_comments");
	});

	test("trailing garbage after a valid expression is a syntax error", () => {
		const errors = parseErrors(`${baseForm}
  - type: "long_text"
    id: "other_comments"
    title: "Other Comments"
    visible_when: 'has_other = "yes" garbage'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_syntax_error");
		expect(errors[0]?.path).toBe("items[1].visible_when");
	});
});

const roleForm = `
title: "Role Form"
items:
  - type: "choice"
    id: "role"
    title: "Your role"
    choices: ["student", "resident", "faculty"]
`;

describe("rule value-domain validation", () => {
	test("a literal outside the choice values fails, naming the choices", () => {
		const errors = parseErrors(`${roleForm}
  - type: "long_text"
    id: "detail"
    title: "Detail"
    visible_when: 'role = "Student"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_value_unreachable");
		expect(errors[0]?.path).toBe("items[1].visible_when");
		expect(errors[0]?.message).toContain('"Student"');
		expect(errors[0]?.message).toContain("student, resident, faculty");
		expect(errors[0]?.message).toContain("yaml-form eval");
	});

	test("a valid literal passes", () => {
		expect(
			parseForm(`${roleForm}
  - type: "long_text"
    id: "detail"
    title: "Detail"
    visible_when: 'role = "student"'
`).ok,
		).toBe(true);
	});

	test("one bad member of an in [...] list is flagged and named", () => {
		const errors = parseErrors(`${roleForm}
  - type: "long_text"
    id: "detail"
    title: "Detail"
    visible_when: 'role in ["student", "teacher"]'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_value_unreachable");
		expect(errors[0]?.message).toContain('"teacher"');
	});

	test("free-text keys are never flagged", () => {
		expect(
			parseForm(`
title: "Free text"
items:
  - type: "short_text"
    id: "name"
    title: "Name"
  - type: "long_text"
    id: "detail"
    title: "Detail"
    visible_when: 'name = "anything at all"'
`).ok,
		).toBe(true);
	});

	test("choices given as {title, value} check against value, not title", () => {
		const valueForm = `
title: "Value form"
items:
  - type: "choice"
    id: "grade"
    title: "Grade"
    choices:
      - { title: "Beginner", value: "b" }
      - { title: "Advanced", value: "a" }
`;
		// comparing against the title "Beginner" is unreachable
		const errors = parseErrors(`${valueForm}
  - type: "long_text"
    id: "detail"
    title: "Detail"
    visible_when: 'grade = "Beginner"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_value_unreachable");

		// comparing against the value "b" is reachable
		expect(
			parseForm(`${valueForm}
  - type: "long_text"
    id: "detail"
    title: "Detail"
    visible_when: 'grade = "b"'
`).ok,
		).toBe(true);
	});

	test("choice_table row keys resolve to the shared scale values", () => {
		const tableForm = `
title: "Table"
items:
  - type: "choice_table"
    id: "table"
    title: "Table"
    items: ["row1"]
    choices: ["a", "b"]
  - type: "long_text"
    id: "detail"
    title: "Detail"
`;
		expect(
			parseForm(`${tableForm}
    visible_when: 'table.row1 = "a"'
`).ok,
		).toBe(true);
		const errors = parseErrors(`${tableForm}
    visible_when: 'table.row1 = "c"'
`);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_value_unreachable");
	});

	test("rubric .value is domain-checked while .comment is free text", () => {
		// comment_per_row: true → .value closed against the scale, .comment open
		const badValue = parseErrors(
			rubricForm(true, 'rubric.clarity.value = "9"'),
		);
		expect(badValue).toHaveLength(1);
		expect(badValue[0]?.code).toBe("rule_value_unreachable");

		expect(
			parseForm(rubricForm(true, 'rubric.clarity.comment includes "9"')).ok,
		).toBe(true);
		expect(parseForm(rubricForm(true, 'rubric.clarity.value = "1"')).ok).toBe(
			true,
		);
	});

	test("bare rubric row key (comment_per_row: false) is domain-checked", () => {
		const errors = parseErrors(rubricForm(false, 'rubric.clarity = "9"'));
		expect(errors).toHaveLength(1);
		expect(errors[0]?.code).toBe("rule_value_unreachable");
	});
});
