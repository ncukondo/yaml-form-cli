import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { initForm } from "../../src/runtime/form.ts";
import { initTableScroll } from "../../src/runtime/table-scroll.ts";
import { parseForm } from "../../src/schema/index.ts";

const sampleYaml = await Bun.file(
	new URL("../../examples/sample.yaml", import.meta.url).pathname,
).text();

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

async function loadDom() {
	const html = await generateHtml(parseOk(sampleYaml));
	const window = new Window();
	window.document.write(html);
	return window.document as unknown as Document;
}

// happy-dom has no layout, so the scroll metrics are stubbed per element.
function stubMetrics(
	el: Element,
	metrics: { scrollWidth: number; clientWidth: number; scrollLeft?: number },
) {
	Object.defineProperty(el, "scrollWidth", {
		configurable: true,
		get: () => metrics.scrollWidth,
	});
	Object.defineProperty(el, "clientWidth", {
		configurable: true,
		get: () => metrics.clientWidth,
	});
	let scrollLeft = metrics.scrollLeft ?? 0;
	Object.defineProperty(el, "scrollLeft", {
		configurable: true,
		get: () => scrollLeft,
		set: (value: number) => {
			scrollLeft = value;
		},
	});
}

function scroller(doc: Document): HTMLElement {
	const el = doc.querySelector<HTMLElement>(".table-scroll");
	if (!el) throw new Error("no .table-scroll in document");
	return el;
}

function dispatch(doc: Document, target: EventTarget, type: string) {
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	target.dispatchEvent(new EventCtor(type));
}

describe("table scroll affordance runtime", () => {
	test("wide table starts with only the end cue", async () => {
		const doc = await loadDom();
		const el = scroller(doc);
		stubMetrics(el, { scrollWidth: 900, clientWidth: 400 });
		initTableScroll(doc.querySelector(".yaml-form-root") as Element);
		expect(el.hasAttribute("data-scroll-start")).toBe(false);
		expect(el.hasAttribute("data-scroll-end")).toBe(true);
	});

	test("mid-scroll shows both cues; far right shows only the start cue", async () => {
		const doc = await loadDom();
		const el = scroller(doc);
		stubMetrics(el, { scrollWidth: 900, clientWidth: 400 });
		initTableScroll(doc.querySelector(".yaml-form-root") as Element);
		el.scrollLeft = 250;
		dispatch(doc, el, "scroll");
		expect(el.hasAttribute("data-scroll-start")).toBe(true);
		expect(el.hasAttribute("data-scroll-end")).toBe(true);
		el.scrollLeft = 500;
		dispatch(doc, el, "scroll");
		expect(el.hasAttribute("data-scroll-start")).toBe(true);
		expect(el.hasAttribute("data-scroll-end")).toBe(false);
	});

	test("a table that fits shows no cues", async () => {
		const doc = await loadDom();
		const el = scroller(doc);
		stubMetrics(el, { scrollWidth: 400, clientWidth: 400 });
		initTableScroll(doc.querySelector(".yaml-form-root") as Element);
		expect(el.hasAttribute("data-scroll-start")).toBe(false);
		expect(el.hasAttribute("data-scroll-end")).toBe(false);
	});

	test("cues refresh when the window resizes", async () => {
		const doc = await loadDom();
		const el = scroller(doc);
		const metrics = { scrollWidth: 400, clientWidth: 400 };
		stubMetrics(el, metrics);
		initTableScroll(doc.querySelector(".yaml-form-root") as Element);
		expect(el.hasAttribute("data-scroll-end")).toBe(false);
		metrics.clientWidth = 200;
		const win = doc.defaultView;
		if (!win) throw new Error("no defaultView");
		dispatch(doc, win as unknown as EventTarget, "resize");
		expect(el.hasAttribute("data-scroll-end")).toBe(true);
	});

	test("initForm wires the scroll cue updates", async () => {
		const doc = await loadDom();
		const el = scroller(doc);
		initForm(doc.querySelector(".yaml-form-root") as Element);
		stubMetrics(el, { scrollWidth: 900, clientWidth: 400, scrollLeft: 250 });
		dispatch(doc, el, "scroll");
		expect(el.hasAttribute("data-scroll-start")).toBe(true);
		expect(el.hasAttribute("data-scroll-end")).toBe(true);
	});
});
