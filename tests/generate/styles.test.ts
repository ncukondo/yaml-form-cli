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

describe("choice_table row tracking (zebra + hover)", () => {
	function desktopTableBlock(css: string): string {
		const match = css.match(/@media \(min-width: 641px\)\s*\{[\s\S]*?\n\}/);
		if (!match) throw new Error("desktop-width table media block not found");
		return match[0];
	}

	test("zebra striping colors even rows in both themes via tokens", () => {
		const block = desktopTableBlock(baseStyles);
		const rule = block.match(
			/[^{}]*:nth-child\(even of \.table-row\)[^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		// color-mix over --fg/--bg adapts to both themes without new tokens
		expect(rule).toContain("color-mix");
		expect(rule).toContain("var(--fg)");
		expect(rule).toContain("var(--bg)");
	});

	test("hovering a body row highlights it, overriding zebra", () => {
		const block = desktopTableBlock(baseStyles);
		const rule = block.match(/[^{}]*tr\.table-row:hover[^{]*\{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("color-mix");
		// equal specificity with the zebra rule: source order must let hover win
		expect(block.indexOf("tr.table-row:hover")).toBeGreaterThan(
			block.indexOf(":nth-child(even of .table-row)"),
		);
	});

	test("zebra and hover stay out of the stacked mobile layout", () => {
		const outsideDesktopBlock = baseStyles.replace(
			/@media \(min-width: 641px\)\s*\{[\s\S]*?\n\}/,
			"",
		);
		expect(outsideDesktopBlock).not.toContain(":nth-child(even of .table-row)");
		expect(outsideDesktopBlock).not.toContain("tr.table-row:hover");
	});
});

describe("choice_table scroll affordance", () => {
	test("right-edge fade cue while columns are hidden to the right", () => {
		const rule = baseStyles.match(
			/\.table-scroll\[data-scroll-end\]\s*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("mask-image");
		expect(rule).toContain("linear-gradient(to right");
	});

	test("sticky corner and row labels cast a shadow once scrolled right", () => {
		const rule = baseStyles.match(
			/\.table-scroll\[data-scroll-start\][^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain(".table-corner");
		expect(rule).toContain(".row-label");
		expect(rule).toContain("box-shadow");
		// theme-adaptive shadow color derived from the foreground token
		expect(rule).toContain("color-mix");
		expect(rule).toContain("var(--fg)");
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

describe("choice option touch targets (WCAG 2.5.8)", () => {
	test("rows carry enough vertical padding to reach a 24px target", () => {
		const rule = baseStyles.match(/\.choice-option \{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		// 2 × 0.25rem padding + 1rem line box ≥ 24px even at line-height 1
		expect(rule).toContain("padding: 0.25rem 0;");
	});
});

describe("invalid state styling", () => {
	test("invalid text inputs and textareas take the error border", () => {
		const rule = baseStyles.match(
			/input\[type="text"\]\[aria-invalid="true"\][^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain('textarea[aria-invalid="true"]');
		expect(rule).toContain("border-color: var(--error);");
	});

	test("invalid choice groups get a visible error outline", () => {
		const rule = baseStyles.match(
			/\.choice-options\[aria-invalid="true"\] \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--error)");
	});

	test("invalid table rows get row-level error treatment", () => {
		expect(baseStyles).toContain('tr.table-row:has([aria-invalid="true"])');
		const rule = baseStyles.match(
			/\.choice-table tr\.table-row:has\(\[aria-invalid="true"\]\)[^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--error)");
	});
});
