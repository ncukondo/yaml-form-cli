import { describe, expect, test } from "bun:test";
import { parseForm } from "../../src/schema/index.ts";

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) {
		throw new Error(
			`expected parse to succeed, got errors:\n${result.errors
				.map((e) => `${e.code} at ${e.path}: ${e.message}`)
				.join("\n")}`,
		);
	}
	return result.form;
}

function parseFail(source: string) {
	const result = parseForm(source);
	if (result.ok) throw new Error("expected parse to fail");
	return result.errors;
}

describe("short_text input_type (decision 0011)", () => {
	test.each(["email", "tel", "url", "number"] as const)(
		"accepts input_type %s",
		(inputType) => {
			const form = parseOk(`
title: T
items:
  - id: a
    title: A
    input_type: ${inputType}
`);
			const item = form.items[0];
			if (item?.type !== "short_text") throw new Error("expected short_text");
			expect(item.input_type).toBe(inputType);
		},
	);

	test("input_type and autocomplete default to undefined", () => {
		const form = parseOk(`
title: T
items:
  - id: a
    title: A
`);
		const item = form.items[0];
		if (item?.type !== "short_text") throw new Error("expected short_text");
		expect(item.input_type).toBeUndefined();
		expect(item.autocomplete).toBeUndefined();
	});

	test.each(["password", "date", "text", "checkbox"])(
		"rejects input_type %s",
		(inputType) => {
			const errors = parseFail(`
title: T
items:
  - id: a
    title: A
    input_type: ${inputType}
`);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]?.path).toContain("input_type");
		},
	);

	test("rejects input_type on non-short_text items", () => {
		const errors = parseFail(`
title: T
items:
  - type: long_text
    id: a
    title: A
    input_type: email
`);
		expect(errors.length).toBeGreaterThan(0);
	});
});

describe("short_text autocomplete (decision 0011)", () => {
	test("accepts free-form tokens, including space-separated lists", () => {
		const form = parseOk(`
title: T
items:
  - id: a
    title: A
    autocomplete: email
  - id: b
    title: B
    autocomplete: "section-x shipping tel"
`);
		const [a, b] = form.items;
		if (a?.type !== "short_text" || b?.type !== "short_text")
			throw new Error("expected short_text items");
		expect(a.autocomplete).toBe("email");
		expect(b.autocomplete).toBe("section-x shipping tel");
	});

	test("rejects an empty autocomplete string", () => {
		const errors = parseFail(`
title: T
items:
  - id: a
    title: A
    autocomplete: ""
`);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.path).toContain("autocomplete");
	});

	test("is independent from input_type", () => {
		const form = parseOk(`
title: T
items:
  - id: a
    title: A
    input_type: tel
  - id: b
    title: B
    autocomplete: name
`);
		const [a, b] = form.items;
		if (a?.type !== "short_text" || b?.type !== "short_text")
			throw new Error("expected short_text items");
		expect(a.autocomplete).toBeUndefined();
		expect(b.input_type).toBeUndefined();
	});
});
