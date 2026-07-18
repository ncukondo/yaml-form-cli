import { describe, expect, test } from "bun:test";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

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

describe("parseForm on examples/sample.yaml", () => {
	test("parses into typed form data", () => {
		const form = parseOk(sampleYaml);
		expect(form.title).toBe("Test Form");
		expect(form.items).toHaveLength(11);
		expect(form.actions).toEqual([{ type: "log" }]);
		expect(form.post_submit?.message).toBe("Thank you for your submission.");
	});

	test("normalizes choices to { title, value } objects", () => {
		const form = parseOk(sampleYaml);
		const multi = form.items.find((i) => i.id === "multiple_choice");
		if (multi?.type !== "choice") throw new Error("expected choice item");
		expect(multi.multiple).toBe(true);
		expect(multi.choices[0]).toEqual({ title: "option1", value: "option1" });
		expect(multi.choices[3]).toEqual({ title: "option4", value: "value4" });
	});

	test("normalizes choice_table rows to { key, title }", () => {
		const form = parseOk(sampleYaml);
		const table = form.items.find((i) => i.id === "choice_table_sample");
		if (table?.type !== "choice_table")
			throw new Error("expected choice_table");
		expect(table.items[0]).toEqual({
			key: "sub_question1",
			title: "sub_question1",
		});
		expect(table.items[7]).toEqual({ key: "sq8", title: "sub_question8" });
		expect(table.choices).toHaveLength(10);
	});

	test("normalizes rubric rows keeping descriptors", () => {
		const form = parseOk(sampleYaml);
		const rubric = form.items.find((i) => i.id === "presentation_rubric");
		if (rubric?.type !== "rubric") throw new Error("expected rubric");
		expect(rubric.required).toBe(true);
		expect(rubric.comment_per_row).toBe(false);
		expect(rubric.choices).toEqual([
			{ title: "Novice", value: "1" },
			{ title: "Competent", value: "2" },
			{ title: "Expert", value: "3" },
		]);
		expect(rubric.items[0]?.key).toBe("clarity");
		expect(rubric.items[0]?.descriptors).toHaveLength(3);
	});
});

describe("parseForm defaults and normalization", () => {
	test("type defaults to short_text; required/multiple default to false", () => {
		const form = parseOk(`
title: T
items:
  - title: A
    id: a
  - type: choice
    title: B
    id: b
    choices: [x]
`);
		expect(form.items[0]?.type).toBe("short_text");
		expect(form.items[0]?.required).toBe(false);
		const b = form.items[1];
		if (b?.type !== "choice") throw new Error("expected choice");
		expect(b.multiple).toBe(false);
	});

	test("a single action mapping is treated as a one-element array", () => {
		const form = parseOk(`
title: T
actions:
  type: post
  url: "https://example.com/api"
items:
  - title: A
    id: a
`);
		expect(form.actions).toEqual([
			{ type: "post", url: "https://example.com/api" },
		]);
	});

	test("actions default to an empty array when omitted", () => {
		const form = parseOk(`
title: T
items:
  - title: A
    id: a
`);
		expect(form.actions).toEqual([]);
	});
});
