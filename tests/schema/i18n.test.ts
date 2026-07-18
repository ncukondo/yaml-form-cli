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

const minimalItems = `
items:
  - title: A
    id: a
`;

describe("lang field", () => {
	test("defaults to en when omitted", () => {
		const form = parseOk(`title: T\n${minimalItems}`);
		expect(form.lang).toBe("en");
	});

	test("accepts a plain language tag and a region subtag", () => {
		expect(parseOk(`title: T\nlang: ja\n${minimalItems}`).lang).toBe("ja");
		expect(parseOk(`title: T\nlang: ja-JP\n${minimalItems}`).lang).toBe(
			"ja-JP",
		);
	});

	test("rejects malformed tags", () => {
		for (const bad of ["''", '"not a lang"', "a", "en_US", "123"]) {
			const errors = parseFail(`title: T\nlang: ${bad}\n${minimalItems}`);
			expect(errors.some((e) => e.path === "lang")).toBe(true);
		}
	});
});

describe("messages field", () => {
	test("accepts known keys and keeps them on the form", () => {
		const form = parseOk(`
title: T
messages:
  required: '"{title}" fehlt.'
  submit: Absenden
${minimalItems}`);
		expect(form.messages?.required).toBe('"{title}" fehlt.');
		expect(form.messages?.submit).toBe("Absenden");
	});

	test("is optional", () => {
		expect(parseOk(`title: T\n${minimalItems}`).messages).toBeUndefined();
	});

	test("rejects unknown message keys", () => {
		const errors = parseFail(`
title: T
messages:
  submit_faild: oops
${minimalItems}`);
		expect(errors.some((e) => e.path.includes("submit_faild"))).toBe(true);
	});

	test("rejects non-string and empty values", () => {
		expect(
			parseFail(`
title: T
messages:
  submit: 3
${minimalItems}`).some((e) => e.path.includes("submit")),
		).toBe(true);
		expect(
			parseFail(`
title: T
messages:
  submit: ""
${minimalItems}`).some((e) => e.path.includes("submit")),
		).toBe(true);
	});
});

describe("JSON Schema surface", () => {
	test("emitted schema documents lang and messages", async () => {
		const { emitJsonSchema } = await import("../../src/schema/json-schema.ts");
		const schema = emitJsonSchema() as {
			properties: Record<string, unknown>;
		};
		expect(Object.keys(schema.properties)).toEqual(
			expect.arrayContaining(["lang", "messages"]),
		);
	});
});
