import { describe, expect, test } from "bun:test";
import { classifyUrl, isExternalUrl } from "../../src/schema/url.ts";

describe("URL policy (decision 0018)", () => {
	test("absolute http(s) and protocol-relative are external", () => {
		expect(classifyUrl("http://example.com/a")).toBe("absolute");
		expect(classifyUrl("https://example.com/a")).toBe("absolute");
		expect(classifyUrl("//cdn.example.com/a")).toBe("absolute");
		expect(isExternalUrl("https://example.com")).toBe(true);
	});

	test("relative references are allowed and internal", () => {
		for (const u of [
			"/api/submit",
			"./next.html",
			"../a",
			"next.html",
			"#top",
			"?q=1",
		]) {
			expect(classifyUrl(u)).toBe("relative");
			expect(isExternalUrl(u)).toBe(false);
		}
	});

	test("mailto is allowed and internal", () => {
		expect(classifyUrl("mailto:a@b.com")).toBe("mailto");
		expect(isExternalUrl("mailto:a@b.com")).toBe(false);
	});

	test("dangerous and unknown schemes are disallowed", () => {
		for (const u of [
			"javascript:alert(1)",
			"JavaScript:alert(1)",
			"data:text/html,x",
			"tel:123",
			"file:///etc/passwd",
			"",
		]) {
			expect(classifyUrl(u)).toBeNull();
		}
	});
});
