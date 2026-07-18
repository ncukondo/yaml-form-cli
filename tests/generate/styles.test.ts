import { describe, expect, test } from "bun:test";
import { baseStyles } from "../../src/generate/styles.ts";

function lightBlock(css: string): string {
	const match = css.match(/:root\s*\{[^}]*\}/);
	if (!match) throw new Error("light :root block not found");
	return match[0];
}

function darkBlock(css: string): string {
	const match = css.match(
		/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*\}/,
	);
	if (!match) throw new Error("dark :root block not found");
	return match[0];
}

describe("theme contrast tokens", () => {
	test("input border token meets 3:1 in both themes", () => {
		// #767676 vs #ffffff = 4.54:1, #8a8a8a vs #171717 = 5.19:1
		expect(lightBlock(baseStyles)).toContain("--border-input: #767676;");
		expect(darkBlock(baseStyles)).toContain("--border-input: #8a8a8a;");
	});

	test("text inputs and textareas use the input border token", () => {
		const rule = baseStyles.match(
			/input\[type="text"\], textarea \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--border-input)");
	});

	test("accent-contrast token pairs readable text with the accent", () => {
		// light: #ffffff on #2563eb = 5.17:1, dark: #171717 on #60a5fa = 7.05:1
		expect(lightBlock(baseStyles)).toContain("--accent-contrast: #ffffff;");
		expect(darkBlock(baseStyles)).toContain("--accent-contrast: #171717;");
	});

	test("submit button text uses the accent-contrast token, not #fff", () => {
		const rule = baseStyles.match(/button\[type="submit"\] \{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("color: var(--accent-contrast);");
		expect(rule).not.toContain("#fff");
	});

	test("submit button hover darkens instead of brightening", () => {
		// brightness(1.1) drops light-mode hover to 4.44:1; 0.9 gives
		// 6.10:1 light / 5.79:1 dark
		const rule = baseStyles.match(
			/button\[type="submit"\]:hover[^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("brightness(0.9)");
		expect(baseStyles).not.toContain("brightness(1.1)");
	});
});

describe("radio/checkbox controls", () => {
	test("controls take the theme accent and a ~1.1rem size", () => {
		const rule = baseStyles.match(
			/input\[type="radio"\], input\[type="checkbox"\] \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("accent-color: var(--accent);");
		expect(rule).toContain("width: 1.1rem;");
		expect(rule).toContain("height: 1.1rem;");
	});
});
