import { describe, expect, test } from "bun:test";
import { parseForm } from "../../src/schema/index.ts";

function parseErrors(source: string) {
	const result = parseForm(source);
	if (result.ok) throw new Error("expected parse to fail");
	return result.errors;
}

describe("parseForm error reporting", () => {
	test("YAML syntax error", () => {
		const errors = parseErrors("title: [unclosed");
		expect(errors[0]?.code).toBe("yaml_syntax");
	});

	test("non-mapping document", () => {
		const errors = parseErrors("- just\n- a list\n");
		expect(errors[0]?.code).toBe("invalid_schema");
	});

	test("missing top-level title and items", () => {
		const errors = parseErrors("description: no title here\n");
		const paths = errors.map((e) => e.path);
		expect(paths).toContain("title");
		expect(paths).toContain("items");
	});

	test("duplicate item id", () => {
		const errors = parseErrors(`
title: T
items:
  - { title: A, id: dup }
  - { title: B, id: dup }
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "duplicate_item_id",
				path: "items[1].id",
			}),
		]);
	});

	test("duplicate row key in choice_table (title vs explicit id)", () => {
		const errors = parseErrors(`
title: T
items:
  - type: choice_table
    title: CT
    id: ct
    choices: [s1, s2]
    items:
      - row1
      - { title: other, id: row1 }
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "duplicate_row_key",
				path: "items[0].items[1]",
			}),
		]);
	});

	test("constant without value", () => {
		const errors = parseErrors(`
title: T
items:
  - type: constant
    title: C
    id: c
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "constant_value_required",
				path: "items[0].value",
			}),
		]);
	});

	test("rubric descriptors count mismatch", () => {
		const errors = parseErrors(`
title: T
items:
  - type: rubric
    title: R
    id: r
    choices: [c1, c2, c3]
    items:
      - id: row1
        title: Row 1
        descriptors: [only, two]
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "descriptor_count_mismatch",
				path: "items[0].items[0].descriptors",
			}),
		]);
	});

	test("multiple is not allowed on rubric", () => {
		const errors = parseErrors(`
title: T
items:
  - type: rubric
    title: R
    id: r
    multiple: true
    choices: [c1]
    items:
      - id: row1
        title: Row 1
        descriptors: [d1]
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "rubric_multiple_not_allowed",
				path: "items[0].multiple",
			}),
		]);
	});

	test("from_url / hidden are rejected on non-constant items", () => {
		const errors = parseErrors(`
title: T
items:
  - { title: A, id: a, from_url: true }
  - { type: choice, title: B, id: b, choices: [x], hidden: true }
`);
		const paths = errors.map((e) => e.path);
		expect(paths).toContain("items[0].from_url");
		expect(paths).toContain("items[1].hidden");
	});

	test("hidden + visible_when on a constant is an error", () => {
		const errors = parseErrors(`
title: T
items:
  - { type: choice, title: G, id: gate, choices: ["yes", "no"] }
  - type: constant
    title: C
    id: c
    value: v
    hidden: true
    visible_when: 'gate = "yes"'
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "hidden_visible_when_conflict",
				path: "items[1].visible_when",
			}),
		]);
		expect(errors[0]?.message).toMatch(/hidden/);
	});

	test("missing title and id on an item", () => {
		const errors = parseErrors(`
title: T
items:
  - type: short_text
`);
		const paths = errors.map((e) => e.path);
		expect(paths).toContain("items[0].title");
		expect(paths).toContain("items[0].id");
	});

	test("unknown item type", () => {
		const errors = parseErrors(`
title: T
items:
  - type: dropdown
    title: A
    id: a
`);
		expect(errors).toEqual([
			expect.objectContaining({
				code: "unknown_item_type",
				path: "items[0].type",
			}),
		]);
	});

	test("unknown keys are rejected", () => {
		const errors = parseErrors(`
title: T
items:
  - title: A
    id: a
    requird: true
`);
		expect(errors[0]?.code).toBe("invalid_schema");
		expect(errors[0]?.path).toBe("items[0].requird");
	});

	test("all errors are reported at once, not first-only", () => {
		const errors = parseErrors(`
title: T
items:
  - { title: A, id: dup }
  - { title: B, id: dup }
  - type: rubric
    title: R
    id: r
    choices: [c1, c2]
    items:
      - id: row1
        title: Row 1
        descriptors: [one]
`);
		const codes = errors.map((e) => e.code);
		expect(codes).toContain("duplicate_item_id");
		expect(codes).toContain("descriptor_count_mismatch");
	});

	test("errors carry human-readable messages", () => {
		const errors = parseErrors(`
title: T
items:
  - { title: A, id: dup }
  - { title: B, id: dup }
`);
		expect(errors[0]?.message).toMatch(/dup/);
	});
});
