import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import {
	collectAnswers,
	initForm,
	validateRequired,
} from "../../src/runtime/form.ts";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

async function loadDom(source: string) {
	const html = await generateHtml(parseOk(source));
	const window = new Window();
	window.document.write(html);
	const document = window.document as unknown as Document;
	initForm(document);
	return document;
}

function submitForm(doc: Document) {
	const form = doc.querySelector("form#yaml-form") as HTMLFormElement;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

function checkCell(doc: Document, name: string, value: string) {
	const box = doc.querySelector(
		`[name="${name}"][value="${value}"]`,
	) as HTMLInputElement | null;
	if (!box) throw new Error(`no input ${name}=${value}`);
	box.checked = true;
}

const commentedRubricYaml = `
title: T
items:
  - type: rubric
    id: commented_rubric
    title: Commented Rubric
    comment_per_row: true
    choices:
      - { title: "Novice", value: "1" }
      - { title: "Expert", value: "2" }
    items:
      - id: clarity
        title: Clarity
        descriptors: ["unclear", "clear"]
      - id: evidence
        title: Evidence
        descriptors: ["weak", "strong"]
`;

let document: Document;

beforeEach(async () => {
	document = await loadDom(sampleYaml);
});

describe("choice_table DOM structure", () => {
	test("renders a real table instead of the placeholder", () => {
		const item = document.querySelector('[data-item-id="choice_table_sample"]');
		expect(item?.querySelector(".placeholder")).toBeNull();
		expect(item?.querySelector("table.choice-table")).not.toBeNull();
	});

	test("table scrolls inside a wrapper (sticky header/label support)", () => {
		const item = document.querySelector('[data-item-id="choice_table_sample"]');
		expect(
			item?.querySelector(".table-scroll > table.choice-table"),
		).not.toBeNull();
	});

	test("header row has one column per choice plus a corner cell", () => {
		const table = document.querySelector(
			'[data-item-id="choice_table_sample"] table',
		);
		const headers = Array.from(
			table?.querySelectorAll("thead th[scope=col]") ?? [],
		);
		expect(headers.map((h) => h.textContent?.trim())).toEqual([
			"scale1",
			"scale2",
			"scale3",
			"scale4",
			"scale5",
			"scale6",
			"scale7",
			"scale8",
			"scale9",
			"scale10",
		]);
		expect(table?.querySelector("thead th.table-corner")).not.toBeNull();
	});

	test("one body row per question with a row-label header cell", () => {
		const table = document.querySelector(
			'[data-item-id="choice_table_sample"] table',
		);
		const rows = Array.from(
			table?.querySelectorAll("tbody tr.table-row") ?? [],
		);
		expect(rows).toHaveLength(8);
		expect(
			rows[0]?.querySelector("th[scope=row].row-label")?.textContent,
		).toContain("sub_question1");
	});

	test("each row gets radios named <item_id>.<row_key>, honoring explicit row ids", () => {
		const radios = document.querySelectorAll(
			'[name="choice_table_sample.sub_question1"][type="radio"]',
		);
		expect(radios).toHaveLength(10);
		// row 8 declares id: sq8, which overrides the title as key
		expect(
			document.querySelectorAll(
				'[name="choice_table_sample.sq8"][type="radio"]',
			),
		).toHaveLength(10);
		expect(
			document.querySelector('[name="choice_table_sample.sub_question8"]'),
		).toBeNull();
	});

	test("multiple: true renders checkboxes per row", () => {
		const boxes = document.querySelectorAll(
			'[name="multiple_choice_table.sub_question1"][type="checkbox"]',
		);
		expect(boxes).toHaveLength(8);
		expect(
			document.querySelector(
				'[data-item-id="multiple_choice_table"] input[type="radio"]',
			),
		).toBeNull();
	});

	test("cells carry the choice title for stacked (narrow) rendering", () => {
		const cell = document.querySelector(
			'[data-item-id="choice_table_sample"] tbody td.table-cell',
		);
		expect(cell?.querySelector(".cell-choice")?.textContent).toBe("scale1");
	});

	test("each row has its own error placeholder for per-row messages", () => {
		expect(
			document.querySelector(
				'[data-error-for="choice_table_sample.sub_question1"]',
			),
		).not.toBeNull();
		expect(
			document.querySelector('[data-error-for="choice_table_sample.sq8"]'),
		).not.toBeNull();
	});

	test("styles include sticky table scrolling and a narrow-width stacking rule", async () => {
		const html = await generateHtml(parseOk(sampleYaml));
		const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
		expect(style).toContain(".table-scroll");
		expect(style).toContain("sticky");
		expect(style).toMatch(/@media[^{]*max-width[\s\S]*\.choice-table/);
	});
});

function choiceTableYaml(id: string, type: string, columns: number): string {
	const choices = Array.from(
		{ length: columns },
		(_, i) => `      - { title: "c${i + 1}", value: "${i + 1}" }`,
	).join("\n");
	const extra =
		type === "rubric"
			? `        descriptors: [${Array.from({ length: columns }, (_, i) => `"d${i + 1}"`).join(", ")}]\n`
			: "";
	return `
title: T
items:
  - type: ${type}
    id: ${id}
    title: ${id}
    choices:
${choices}
    items:
      - id: row1
        title: Row 1
${extra}`;
}

describe("mobile wide-table marker (decision 0012)", () => {
	test("wide choice_tables mark their scroll wrapper with table-wide", () => {
		// 10 and 8 columns in the sample — both at or above the threshold
		for (const id of ["choice_table_sample", "multiple_choice_table"]) {
			const wrapper = document.querySelector(
				`[data-item-id="${id}"] .table-scroll`,
			);
			expect(wrapper?.classList.contains("table-wide")).toBe(true);
		}
	});

	test("rubrics never get the wide marker (3 columns in the sample)", () => {
		const wrapper = document.querySelector(
			'[data-item-id="presentation_rubric"] .table-scroll',
		);
		expect(wrapper?.classList.contains("table-wide")).toBe(false);
	});

	test("a 5-column choice_table stays below the threshold", async () => {
		const doc = await loadDom(choiceTableYaml("narrow", "choice_table", 5));
		const wrapper = doc.querySelector('[data-item-id="narrow"] .table-scroll');
		expect(wrapper?.classList.contains("table-wide")).toBe(false);
	});

	test("a 6-column choice_table meets the threshold", async () => {
		const doc = await loadDom(choiceTableYaml("wide", "choice_table", 6));
		const wrapper = doc.querySelector('[data-item-id="wide"] .table-scroll');
		expect(wrapper?.classList.contains("table-wide")).toBe(true);
	});

	test("even a 6-column rubric stays card-stacked (no marker)", async () => {
		const doc = await loadDom(choiceTableYaml("wide_rubric", "rubric", 6));
		const wrapper = doc.querySelector(
			'[data-item-id="wide_rubric"] .table-scroll',
		);
		expect(wrapper?.classList.contains("table-wide")).toBe(false);
	});
});

describe("rubric DOM structure", () => {
	test("renders a table with radios (never checkboxes)", () => {
		const item = document.querySelector('[data-item-id="presentation_rubric"]');
		expect(item?.querySelector("table.choice-table")).not.toBeNull();
		expect(item?.querySelectorAll('input[type="radio"]')).toHaveLength(6);
		expect(item?.querySelector('input[type="checkbox"]')).toBeNull();
	});

	test("cells show the per-column descriptors in column order", () => {
		const rows = Array.from(
			document.querySelectorAll(
				'[data-item-id="presentation_rubric"] tbody tr.table-row',
			),
		);
		const clarityDescriptors = Array.from(
			rows[0]?.querySelectorAll(".cell-descriptor") ?? [],
		).map((el) => el.textContent);
		expect(clarityDescriptors).toEqual([
			"Hard to follow; main point unclear",
			"Mostly clear with minor gaps",
			"Consistently clear and well structured",
		]);
		const evidenceDescriptors = Array.from(
			rows[1]?.querySelectorAll(".cell-descriptor") ?? [],
		).map((el) => el.textContent);
		expect(evidenceDescriptors).toEqual([
			"Claims are unsupported",
			"Some claims supported by evidence",
			"All claims well supported and cited",
		]);
	});

	test("comment_per_row: true adds a free-text box under each row", async () => {
		const doc = await loadDom(commentedRubricYaml);
		expect(
			doc.querySelector('textarea[name="commented_rubric.clarity.comment"]'),
		).not.toBeNull();
		expect(
			doc.querySelector('textarea[name="commented_rubric.evidence.comment"]'),
		).not.toBeNull();
	});

	test("comment_per_row: false renders no comment boxes", () => {
		expect(
			document.querySelector('[name="presentation_rubric.clarity.comment"]'),
		).toBeNull();
	});
});

describe("table a11y", () => {
	test("choice_table cell inputs are named '{row}: {choice}'", () => {
		const radio = document.querySelector(
			'[name="choice_table_sample.sub_question1"][value="scale1"]',
		);
		expect(radio?.getAttribute("aria-label")).toBe("sub_question1: scale1");
	});

	test("rubric cell inputs reference their descriptor via aria-describedby", () => {
		const radio = document.querySelector(
			'[name="presentation_rubric.clarity"][value="1"]',
		);
		const descriptorId = radio?.getAttribute("aria-describedby") ?? "";
		expect(descriptorId).not.toBe("");
		const descriptor = document.getElementById(descriptorId);
		expect(descriptor?.classList.contains("cell-descriptor")).toBe(true);
		expect(descriptor?.textContent).toBe("Hard to follow; main point unclear");
	});

	test("each rubric cell points at its own column's descriptor", () => {
		const radio = document.querySelector(
			'[name="presentation_rubric.evidence"][value="3"]',
		);
		const descriptorId = radio?.getAttribute("aria-describedby") ?? "";
		expect(document.getElementById(descriptorId)?.textContent).toBe(
			"All claims well supported and cited",
		);
	});

	test("choice_table cells (no descriptors) carry no aria-describedby", () => {
		const radio = document.querySelector(
			'[name="choice_table_sample.sub_question1"][value="scale1"]',
		);
		expect(radio?.hasAttribute("aria-describedby")).toBe(false);
	});

	test("table markup carries explicit ARIA roles for the stacked layout", () => {
		const table = document.querySelector(
			'[data-item-id="presentation_rubric"] table',
		);
		expect(table?.getAttribute("role")).toBe("table");
		expect(table?.querySelector("thead")?.getAttribute("role")).toBe(
			"rowgroup",
		);
		expect(table?.querySelector("tbody")?.getAttribute("role")).toBe(
			"rowgroup",
		);
		for (const tr of Array.from(table?.querySelectorAll("tr") ?? [])) {
			expect(tr.getAttribute("role")).toBe("row");
		}
		for (const th of Array.from(table?.querySelectorAll("thead th") ?? [])) {
			expect(th.getAttribute("role")).toBe("columnheader");
		}
		const rowHeaders = table?.querySelectorAll("tbody th[scope=row]") ?? [];
		for (const th of Array.from(rowHeaders)) {
			expect(th.getAttribute("role")).toBe("rowheader");
		}
		for (const td of Array.from(table?.querySelectorAll("tbody td") ?? [])) {
			expect(td.getAttribute("role")).toBe("cell");
		}
	});

	test("comment rows carry row/cell roles too", async () => {
		const doc = await loadDom(commentedRubricYaml);
		const commentRow = doc.querySelector("tr.table-comment-row");
		expect(commentRow?.getAttribute("role")).toBe("row");
		expect(commentRow?.querySelector("td")?.getAttribute("role")).toBe("cell");
	});
});

describe("table answer collection", () => {
	test("choice_table answers are a per-row object keyed by row key", () => {
		checkCell(document, "choice_table_sample.sub_question1", "scale3");
		checkCell(document, "choice_table_sample.sq8", "scale1");
		const answers = collectAnswers(document);
		expect(answers.choice_table_sample).toEqual({
			sub_question1: "scale3",
			sq8: "scale1",
		});
	});

	test("a fully unanswered table is omitted from answers", () => {
		const answers = collectAnswers(document);
		expect(answers).not.toHaveProperty("choice_table_sample");
		expect(answers).not.toHaveProperty("multiple_choice_table");
	});

	test("multiple: true collects an array per row, even for one selection", () => {
		checkCell(document, "multiple_choice_table.sub_question1", "scale1");
		checkCell(document, "multiple_choice_table.sub_question1", "scale3");
		checkCell(document, "multiple_choice_table.sub_question2", "scale2");
		const answers = collectAnswers(document);
		expect(answers.multiple_choice_table).toEqual({
			sub_question1: ["scale1", "scale3"],
			sub_question2: ["scale2"],
		});
	});

	test("rubric answers are bare values when comment_per_row is false", () => {
		checkCell(document, "presentation_rubric.clarity", "2");
		checkCell(document, "presentation_rubric.evidence", "3");
		const answers = collectAnswers(document);
		expect(answers.presentation_rubric).toEqual({
			clarity: "2",
			evidence: "3",
		});
	});

	test("comment_per_row: true wraps each row answer as { value, comment }", async () => {
		const doc = await loadDom(commentedRubricYaml);
		checkCell(doc, "commented_rubric.clarity", "2");
		const comment = doc.querySelector(
			'[name="commented_rubric.clarity.comment"]',
		) as HTMLTextAreaElement;
		comment.value = "well argued";
		const answers = collectAnswers(doc);
		expect(answers.commented_rubric).toEqual({
			clarity: { value: "2", comment: "well argued" },
		});
	});

	test("empty comments are omitted from the { value, comment } shape", async () => {
		const doc = await loadDom(commentedRubricYaml);
		checkCell(doc, "commented_rubric.evidence", "1");
		const answers = collectAnswers(doc);
		expect(answers.commented_rubric).toEqual({
			evidence: { value: "1" },
		});
	});
});

describe("table required validation", () => {
	test("required table fails per row until every row is answered", () => {
		// presentation_rubric is required in the sample
		let failures = validateRequired(document).filter(
			(f) => f.itemId === "presentation_rubric",
		);
		expect(failures).toHaveLength(2);
		expect(failures.map((f) => f.rowKey)).toEqual(["clarity", "evidence"]);
		for (const failure of failures) {
			expect(failure.message).not.toBe("");
		}

		checkCell(document, "presentation_rubric.clarity", "2");
		failures = validateRequired(document).filter(
			(f) => f.itemId === "presentation_rubric",
		);
		expect(failures.map((f) => f.rowKey)).toEqual(["evidence"]);

		checkCell(document, "presentation_rubric.evidence", "3");
		failures = validateRequired(document).filter(
			(f) => f.itemId === "presentation_rubric",
		);
		expect(failures).toHaveLength(0);
	});

	test("per-row message names the unanswered row", () => {
		const failure = validateRequired(document).find(
			(f) => f.itemId === "presentation_rubric" && f.rowKey === "clarity",
		);
		expect(failure?.message).toContain("Clarity");
	});

	test("submit shows and clears per-row error messages", () => {
		submitForm(document);
		const error = document.querySelector(
			'[data-error-for="presentation_rubric.clarity"]',
		);
		expect(error?.hasAttribute("hidden")).toBe(false);
		expect(error?.textContent).not.toBe("");

		checkCell(document, "presentation_rubric.clarity", "1");
		submitForm(document);
		expect(error?.hasAttribute("hidden")).toBe(true);
		const evidenceError = document.querySelector(
			'[data-error-for="presentation_rubric.evidence"]',
		);
		expect(evidenceError?.hasAttribute("hidden")).toBe(false);
	});

	test("a comment alone does not satisfy required", async () => {
		const doc = await loadDom(`${commentedRubricYaml}    required: true\n`);
		const comment = doc.querySelector(
			'[name="commented_rubric.clarity.comment"]',
		) as HTMLTextAreaElement;
		comment.value = "note without a rating";
		const failures = validateRequired(doc).filter(
			(f) => f.itemId === "commented_rubric",
		);
		expect(failures.map((f) => f.rowKey)).toEqual(["clarity", "evidence"]);
	});

	test("an optional table produces no required failures", () => {
		const failures = validateRequired(document);
		expect(failures.map((f) => f.itemId)).not.toContain("choice_table_sample");
		expect(failures.map((f) => f.itemId)).not.toContain(
			"multiple_choice_table",
		);
	});
});

describe("tall-table scroll threshold marker", () => {
	function choiceTableYaml(rows: number): string {
		const items = Array.from({ length: rows }, (_, i) => `      - row_${i}`);
		return [
			"title: T",
			"items:",
			"  - type: choice_table",
			"    id: t",
			"    title: Table",
			'    choices: ["a", "b"]',
			"    items:",
			...items,
		].join("\n");
	}

	function commentedRubricYaml(rows: number): string {
		const items = Array.from(
			{ length: rows },
			(_, i) => `      - { id: c${i}, title: C${i}, descriptors: ["x", "y"] }`,
		);
		return [
			"title: T",
			"items:",
			"  - type: rubric",
			"    id: r",
			"    title: Rubric",
			"    comment_per_row: true",
			"    choices:",
			'      - { title: "A", value: "1" }',
			'      - { title: "B", value: "2" }',
			"    items:",
			...items,
		].join("\n");
	}

	test("a short table scrolls with the page: no tall marker", async () => {
		const doc = await loadDom(choiceTableYaml(10));
		const scroll = doc.querySelector(".table-scroll");
		expect(scroll).not.toBeNull();
		expect(scroll?.classList.contains("table-scroll-tall")).toBe(false);
	});

	test("a table above the row threshold is marked tall", async () => {
		const doc = await loadDom(choiceTableYaml(11));
		expect(doc.querySelector(".table-scroll.table-scroll-tall")).not.toBeNull();
	});

	test("per-row comment rows count toward the threshold", async () => {
		// 6 criteria x (row + comment row) = 12 rendered rows
		const doc = await loadDom(commentedRubricYaml(6));
		expect(doc.querySelector(".table-scroll.table-scroll-tall")).not.toBeNull();
	});
});
