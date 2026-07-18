import { describe, expect, test } from "bun:test";
import {
	emitJsonSchema,
	renderJsonSchema,
} from "../../src/schema/json-schema.ts";

describe("JSON Schema emission", () => {
	test("emits a draft-07 schema for the form document", () => {
		const schema = emitJsonSchema() as Record<string, unknown>;
		expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
		const properties = schema.properties as Record<string, unknown>;
		expect(Object.keys(properties)).toEqual(
			expect.arrayContaining([
				"title",
				"id",
				"version",
				"description",
				"actions",
				"post_submit",
				"items",
			]),
		);
		expect(schema.required).toEqual(expect.arrayContaining(["title", "items"]));
	});

	test("checked-in schema/yaml-form.schema.json is up to date", async () => {
		const file = Bun.file(
			new URL("../../schema/yaml-form.schema.json", import.meta.url).pathname,
		);
		expect(await file.exists()).toBe(true);
		expect(await file.text()).toBe(renderJsonSchema());
	});

	test("examples/sample.yaml references the published schema", async () => {
		const sample = await Bun.file(
			new URL("../../examples/sample.yaml", import.meta.url).pathname,
		).text();
		expect(sample.split("\n")[0]).toMatch(
			/^# yaml-language-server: \$schema=.*yaml-form\.schema\.json/,
		);
	});
});
