import { describe, expect, test } from "bun:test";
import { name } from "../src/index.ts";

describe("project scaffold", () => {
	test("entry module exports the package name", () => {
		expect(name).toBe("yaml-form-cli");
	});
});
