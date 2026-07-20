import { describe, expect, test } from "bun:test";
import { generateHtml } from "../../src/generate/index.ts";
import {
	baseStyles,
	draftStyles,
	standaloneStyles,
} from "../../src/generate/styles.ts";
import { parseForm } from "../../src/schema/index.ts";

const ROOT = ".yaml-form-root";

function lightBlock(css: string): string {
	const match = css.match(/\.yaml-form-root\s*\{[^}]*\}/);
	if (!match) throw new Error("light .yaml-form-root block not found");
	return match[0];
}

function darkBlock(css: string): string {
	const match = css.match(
		/@media \(prefers-color-scheme: dark\)\s*\{\s*\.yaml-form-root\s*\{[^}]*\}/,
	);
	if (!match) throw new Error("dark .yaml-form-root block not found");
	return match[0];
}

// Minimal CSS walk for the scoping tests: collect every selector list that
// opens a declaration block, descending into grouping at-rules (@media,
// @supports) and skipping comments and declaration bodies.
function matchingBrace(css: string, open: number): number {
	let depth = 0;
	for (let i = open; i < css.length; i++) {
		if (css.startsWith("/*", i)) {
			i = css.indexOf("*/", i) + 1;
			continue;
		}
		if (css[i] === "{") depth++;
		else if (css[i] === "}") {
			depth--;
			if (depth === 0) return i;
		}
	}
	throw new Error("unbalanced braces in stylesheet");
}

function splitSelectorList(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of list) {
		if (ch === "(") depth++;
		else if (ch === ")") depth--;
		if (ch === "," && depth === 0) {
			parts.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function topLevelSelectors(css: string): string[] {
	const selectors: string[] = [];
	let prelude = "";
	let i = 0;
	while (i < css.length) {
		if (css.startsWith("/*", i)) {
			i = css.indexOf("*/", i) + 2;
			continue;
		}
		if (css[i] === "{") {
			const end = matchingBrace(css, i);
			if (prelude.trim().startsWith("@")) {
				selectors.push(...topLevelSelectors(css.slice(i + 1, end)));
			} else {
				selectors.push(...splitSelectorList(prelude));
			}
			prelude = "";
			i = end + 1;
		} else {
			prelude += css[i];
			i++;
		}
	}
	return selectors;
}

describe("scoping under .yaml-form-root (decision 0020)", () => {
	test("every rule in the core sheet is anchored on the root", () => {
		const selectors = topLevelSelectors(baseStyles);
		// sanity: the walk actually saw the sheet, not an empty parse
		expect(selectors.length).toBeGreaterThan(40);
		for (const selector of selectors) {
			expect(selector.startsWith(ROOT)).toBe(true);
		}
	});

	test("draft styles are anchored on the root too", () => {
		const selectors = topLevelSelectors(draftStyles);
		expect(selectors.length).toBeGreaterThan(0);
		for (const selector of selectors) {
			expect(selector.startsWith(ROOT)).toBe(true);
		}
	});

	test("no :root or body rule remains in the scoped core", () => {
		expect(baseStyles).not.toContain(":root");
		// \b keeps tbody/.row-... matches out; nothing page-global may remain
		expect(baseStyles).not.toMatch(/\bbody\b/);
	});

	test("box-sizing covers the root and its subtree, not the page", () => {
		expect(baseStyles).toContain(
			".yaml-form-root, .yaml-form-root * { box-sizing: border-box; }",
		);
		expect(baseStyles).not.toMatch(/^\s*\* \{/m);
	});

	test("color-scheme is declared on the root, not the page", () => {
		expect(lightBlock(baseStyles)).toContain("color-scheme: light dark;");
	});
});

describe("--yf-* theme knobs (decision 0020)", () => {
	test("public knobs front the internal tokens with today's light defaults", () => {
		const light = lightBlock(baseStyles);
		expect(light).toContain("--fg: var(--yf-fg, #1a1a1a);");
		expect(light).toContain("--bg: var(--yf-bg, #ffffff);");
		expect(light).toContain("--accent: var(--yf-accent, #2563eb);");
		expect(light).toContain(
			"--accent-contrast: var(--yf-accent-contrast, #ffffff);",
		);
		expect(light).toContain("font-size: var(--yf-font-size, 1rem);");
	});

	test("dark scheme keeps the knobs, falling back to today's dark palette", () => {
		const dark = darkBlock(baseStyles);
		expect(dark).toContain("--fg: var(--yf-fg, #e5e5e5);");
		expect(dark).toContain("--bg: var(--yf-bg, #171717);");
		expect(dark).toContain("--accent: var(--yf-accent, #60a5fa);");
		expect(dark).toContain(
			"--accent-contrast: var(--yf-accent-contrast, #171717);",
		);
	});

	test("internal tokens stay private (no --yf- fronting)", () => {
		const light = lightBlock(baseStyles);
		expect(light).toContain("--muted: #555;");
		expect(light).toContain("--border: #ccc;");
		expect(light).toContain("--error: #b91c1c;");
	});
});

describe("standalone-only page reset (decision 0020)", () => {
	test("the body reset lives in the standalone block, not the core", () => {
		expect(standaloneStyles).toMatch(/body \{[^}]*margin: 0;/);
		expect(standaloneStyles).toContain("font-family: system-ui");
	});

	test("the core never sets font-family, so host fonts inherit", () => {
		expect(baseStyles).not.toContain("font-family");
		expect(draftStyles).not.toContain("font-family");
	});

	test("the container layout targets the root, so it lives unscoped in standalone", () => {
		// The root <main> carries both `container` and `yaml-form-root`. Scoping
		// `.container` in the core would produce `.yaml-form-root .container` — a
		// descendant selector that can never match the root against itself,
		// silently dropping the 46rem max-width, centering, and padding.
		expect(standaloneStyles).toMatch(
			/\.container \{[^}]*max-width: 46rem;[^}]*margin: 0 auto;/,
		);
		expect(baseStyles).not.toContain(".container");
		expect(baseStyles).not.toContain("max-width: 46rem");
	});

	test("the root pins color and line-height against host resets", () => {
		const light = lightBlock(baseStyles);
		expect(light).toContain("line-height: 1.6;");
		expect(light).toContain("color: var(--fg);");
	});

	test("standalone body keeps today's colors in both schemes", () => {
		expect(standaloneStyles).toContain("color: var(--yf-fg, #1a1a1a);");
		expect(standaloneStyles).toContain("background: var(--yf-bg, #ffffff);");
		expect(standaloneStyles).toMatch(
			/@media \(prefers-color-scheme: dark\)\s*\{\s*body \{[^}]*var\(--yf-bg, #171717\)/,
		);
	});

	test("standalone documents append the reset after the scoped core", async () => {
		const result = parseForm(
			"title: T\nitems:\n  - type: short_text\n    id: a\n    title: A\n",
		);
		if (!result.ok) throw new Error("form must parse");
		const html = await generateHtml(result.form);
		const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
		expect(style).toContain(standaloneStyles);
		expect(style.indexOf(standaloneStyles)).toBeGreaterThan(
			style.indexOf(baseStyles),
		);
	});
});

describe("theme contrast tokens", () => {
	test("input border token meets 3:1 in both themes", () => {
		// #767676 vs #ffffff = 4.54:1, #8a8a8a vs #171717 = 5.19:1
		expect(lightBlock(baseStyles)).toContain("--border-input: #767676;");
		expect(darkBlock(baseStyles)).toContain("--border-input: #8a8a8a;");
	});

	test("text inputs and textareas use the input border token", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root input\[type="text"\], \.yaml-form-root textarea \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--border-input)");
	});

	test("accent-contrast token pairs readable text with the accent", () => {
		// light: #ffffff on #2563eb = 5.17:1, dark: #171717 on #60a5fa = 7.05:1
		expect(lightBlock(baseStyles)).toContain(
			"--accent-contrast: var(--yf-accent-contrast, #ffffff);",
		);
		expect(darkBlock(baseStyles)).toContain(
			"--accent-contrast: var(--yf-accent-contrast, #171717);",
		);
	});

	test("submit button text uses the accent-contrast token, not #fff", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root button\[type="submit"\] \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("color: var(--accent-contrast);");
		expect(rule).not.toContain("#fff");
	});

	test("submit button hover darkens instead of brightening", () => {
		// brightness(1.1) drops light-mode hover to 4.44:1; 0.9 gives
		// 6.10:1 light / 5.79:1 dark
		const rule = baseStyles.match(
			/\.yaml-form-root button\[type="submit"\]:hover[^{]*\{[^}]*\}/,
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
		expect(rule).toContain(".yaml-form-root .choice-table");
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

describe("choice_table column tracking (hover)", () => {
	function columnBlock(css: string): string {
		// the second min-width:641px block: row tracking is first, column second
		const blocks = css.match(/@media \(min-width: 641px\)\s*\{[\s\S]*?\n\}/g);
		const block = blocks?.find((b) => b.includes(":has("));
		if (!block) throw new Error("column-tracking media block not found");
		return block;
	}

	test("hovering a cell tints its whole column via :has() + :nth-child()", () => {
		const block = columnBlock(baseStyles);
		expect(block).toContain(
			".yaml-form-root .choice-table:has(td.table-cell:nth-child(2):hover, th.table-col-header:nth-child(2):hover) tbody tr > :nth-child(2)",
		);
		// same 12% tint as the row hover so the crossing cell stays uniform
		expect(block).toContain("color-mix(in srgb, var(--fg) 12%, var(--bg))");
	});

	test("hovering a cell lights up its column header with the accent", () => {
		const block = columnBlock(baseStyles);
		expect(block).toContain(") thead th:nth-child(2)");
		expect(block).toContain("var(--accent)");
		expect(block).toContain("box-shadow: inset 0 -2px 0 var(--accent);");
	});

	test("hovering the column header itself also highlights the column", () => {
		const block = columnBlock(baseStyles);
		expect(block).toContain("th.table-col-header:nth-child(2):hover");
	});

	test("column tracking stays out of the stacked mobile layout", () => {
		// strip both min-width:641px blocks; the :has() column rules must be gone
		const outside = baseStyles.replace(
			/@media \(min-width: 641px\)\s*\{[\s\S]*?\n\}/g,
			"",
		);
		expect(outside).not.toContain(":has(td.table-cell:nth-child(2):hover)");
	});

	test("the focal cell gets an accent ring so it stands out from the tints", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root \.choice-table td\.table-cell:hover,[^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		// keyboard focus is marked too, so arrowing across a row is legible
		expect(rule).toContain(".table-cell:has(input:focus-visible)");
		expect(rule).toContain("outline: 2px solid var(--accent);");
		// negative offset keeps the ring inside the cell borders
		expect(rule).toContain("outline-offset: -2px;");
	});

	test("the focal-cell ring works at every width, unlike the tints", () => {
		// the focus branch must survive stripping the desktop-only media blocks
		const outside = baseStyles.replace(
			/@media \(min-width: 641px\)\s*\{[\s\S]*?\n\}/g,
			"",
		);
		expect(outside).toContain(".table-cell:has(input:focus-visible)");
	});
});

describe("choice_table scroll affordance", () => {
	test("right-edge fade cue while columns are hidden to the right", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root \.table-scroll\[data-scroll-end\]\s*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("mask-image");
		expect(rule).toContain("linear-gradient(to right");
	});

	test("sticky corner and row labels cast a shadow once scrolled right", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root \.table-scroll\[data-scroll-start\][^{]*\{[^}]*\}/,
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

describe("mobile wide-table branch (decision 0012)", () => {
	function mobileBlocks(css: string): string[] {
		const blocks = css.match(/@media \(max-width: 640px\)\s*\{[\s\S]*?\n\}/g);
		if (!blocks || blocks.length === 0)
			throw new Error("mobile media blocks not found");
		return blocks;
	}

	test("stacking rules are scoped to non-wide wrappers", () => {
		const blocks = mobileBlocks(baseStyles);
		expect(blocks.join("\n")).toContain(".table-scroll:not(.table-wide)");
		// every selector line touching the table must carry the :not() guard,
		// so wide tables keep the desktop scroll layout below 640px
		for (const block of blocks) {
			const selectors = block.match(/^\s*[^@\s/][^{}]*(?=,|\s*\{)/gm) ?? [];
			for (const selector of selectors) {
				if (
					!/\.choice-table|\.table-scroll|\.table-cell-label|\.cell-/.test(
						selector,
					)
				)
					continue;
				expect(selector).toContain(".table-scroll:not(.table-wide)");
			}
		}
	});

	test("row-card error treatment is also scoped to non-wide wrappers", () => {
		const errorBlock = mobileBlocks(baseStyles).find((block) =>
			block.includes('aria-invalid="true"'),
		);
		expect(errorBlock).toBeDefined();
		expect(errorBlock).toContain(".table-scroll:not(.table-wide)");
	});
});

describe("radio/checkbox controls", () => {
	test("controls take the theme accent and a ~1.1rem size", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root input\[type="radio"\], \.yaml-form-root input\[type="checkbox"\] \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("accent-color: var(--accent);");
		expect(rule).toContain("width: 1.1rem;");
		expect(rule).toContain("height: 1.1rem;");
	});
});

describe("choice option touch targets (WCAG 2.5.8)", () => {
	test("rows carry enough vertical padding to reach a 24px target", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root \.choice-option \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		// 2 × 0.25rem padding + 1rem line box ≥ 24px even at line-height 1
		expect(rule).toContain("padding: 0.25rem 0;");
	});
});

describe("constant item styling", () => {
	test("constant value reads as an info box, not a disabled field", () => {
		// the base sheet greys .constant-value out; a later rule must restore
		// foreground color and add the box treatment
		const rules = [
			...baseStyles.matchAll(/\.yaml-form-root \.constant-value \{[^}]*\}/g),
		].map((m) => m[0]);
		const box = rules.at(-1);
		expect(box).toBeDefined();
		expect(box).toContain("color: var(--fg);");
		expect(box).toContain("background:");
		expect(box).toContain("border:");
		expect(box).toContain("border-radius:");
		expect(box).toContain("padding:");
	});
});

describe("print styles", () => {
	function printBlock(css: string): string {
		const match = css.match(/@media print\s*\{[\s\S]*?\n\}/);
		if (!match) throw new Error("@media print block not found");
		return match[0];
	}

	test("tables paginate: scroll container loses max-height and overflow", () => {
		const block = printBlock(baseStyles);
		const rule = block.match(/\.table-scroll[^[{,]*\{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("max-height: none;");
		expect(rule).toContain("overflow: visible;");
	});

	test("scroll cues (fade mask, sticky shadows) are dropped on paper", () => {
		const block = printBlock(baseStyles);
		const mask = block.match(
			/\.table-scroll\[data-scroll-end\]\s*\{[^}]*\}/,
		)?.[0];
		expect(mask).toBeDefined();
		expect(mask).toContain("mask-image: none;");
		const shadow = block.match(
			/\.table-scroll\[data-scroll-start\][^{]*\{[^}]*\}/,
		)?.[0];
		expect(shadow).toBeDefined();
		expect(shadow).toContain("box-shadow: none;");
	});

	test("sticky header and row labels flow with the page", () => {
		const block = printBlock(baseStyles);
		const rule = block.match(/[^{}]*thead th[^{]*\{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("position: static;");
		expect(rule).toContain(".row-label");
		expect(rule).toContain(".table-corner");
	});

	test("interactive-only chrome is hidden", () => {
		const block = printBlock(baseStyles);
		const rule = block.match(/button\[type="submit"\][^{]*\{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("display: none;");
	});
});

describe(":has() fallback for the mobile comment-row merge", () => {
	test("non-supporting browsers render the comment as its own card", () => {
		// the merged look relies on tr.table-row:has(+ tr.table-comment-row);
		// without :has() the row keeps its bottom border and radius, so the
		// fallback must give the trailing comment row a complete card of its own
		const block = baseStyles.match(
			/@supports not selector\(:has\(\*\)\)\s*\{[\s\S]*?\n\}/,
		)?.[0];
		expect(block).toBeDefined();
		expect(block).toContain("@media (max-width: 640px)");
		const rule = block?.match(/tr\.table-comment-row\s*\{[^}]*\}/)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("border-top: 1px solid var(--border);");
		expect(rule).toContain("border-radius: 0.375rem;");
		expect(rule).toContain("margin-top: 0;");
	});
});

describe("success screen styling", () => {
	test("success section gets card treatment", () => {
		const rules = [
			...baseStyles.matchAll(/\.yaml-form-root \.form-success \{[^}]*\}/g),
		].map((m) => m[0]);
		const card = rules.at(-1);
		expect(card).toBeDefined();
		expect(card).toContain("border:");
		expect(card).toContain("border-radius:");
		expect(card).toContain("background:");
		expect(card).toContain("padding:");
	});

	test("checkmark icon renders as an accent badge", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root \.success-icon \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--accent)");
		expect(rule).toContain("var(--accent-contrast)");
		expect(rule).toContain("border-radius: 50%;");
	});
});

describe("submit button focus and pressed states", () => {
	test("keyboard focus draws the accent ring used by text inputs", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root button\[type="submit"\]:focus-visible\s*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("outline: 2px solid var(--accent);");
		// the button background is the accent itself, so the ring needs a gap
		expect(rule).toContain("outline-offset:");
	});

	test("pressing the button darkens it beyond hover", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root button\[type="submit"\]:active:not\(:disabled\)\s*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("brightness(0.8)");
	});
});

describe("nested table scroll threshold", () => {
	test("the scroll container itself no longer caps height", () => {
		// an unconditional max-height traps wheel scrolling on short tables
		const rule = baseStyles.match(
			/\.yaml-form-root \.table-scroll \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).not.toContain("max-height");
		expect(rule).toContain("overflow: auto;");
	});

	test("only renderer-marked tall tables get the 75vh scroll region", () => {
		// desktop-only: the stacked mobile layout always flows with the page
		const block = baseStyles.match(
			/@media \(min-width: 641px\)\s*\{\s*\.yaml-form-root \.table-scroll\.table-scroll-tall\s*\{[^}]*\}\s*\}/,
		)?.[0];
		expect(block).toBeDefined();
		expect(block).toContain("max-height: 75vh;");
	});

	test("print resets the tall variant too", () => {
		const print = baseStyles.match(/@media print\s*\{[\s\S]*?\n\}/)?.[0];
		expect(print).toBeDefined();
		expect(print).toContain(".table-scroll.table-scroll-tall");
	});
});

describe("draft notice hidden state", () => {
	test("the [hidden] notice stays hidden despite display: flex", () => {
		// .draft-notice { display: flex } outranks the UA's [hidden] rule, so
		// the sheet needs an explicit higher-specificity guard or the notice
		// shows on every load, draft or not
		const rule = draftStyles.match(
			/\.yaml-form-root \.draft-notice\[hidden\]\s*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("display: none;");
	});
});

describe("invalid state styling", () => {
	test("invalid text inputs and textareas take the error border", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root input\[type="text"\]\[aria-invalid="true"\][^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain('.yaml-form-root textarea[aria-invalid="true"]');
		expect(rule).toContain("border-color: var(--error);");
	});

	test("invalid choice groups get a visible error outline", () => {
		const rule = baseStyles.match(
			/\.yaml-form-root \.choice-options\[aria-invalid="true"\] \{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--error)");
	});

	test("invalid table rows get row-level error treatment", () => {
		expect(baseStyles).toContain('tr.table-row:has([aria-invalid="true"])');
		const rule = baseStyles.match(
			/\.yaml-form-root \.choice-table tr\.table-row:has\(\[aria-invalid="true"\]\)[^{]*\{[^}]*\}/,
		)?.[0];
		expect(rule).toBeDefined();
		expect(rule).toContain("var(--error)");
	});
});
