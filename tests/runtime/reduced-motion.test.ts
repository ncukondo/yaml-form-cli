import { describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { generateHtml } from "../../src/generate/index.ts";
import { initForm } from "../../src/runtime/form.ts";
import { parseForm } from "../../src/schema/index.ts";

function parseOk(source: string) {
	const result = parseForm(source);
	if (!result.ok) throw new Error("expected form to parse");
	return result.form;
}

const requiredFormYaml = `
title: T
items:
  - id: name
    title: Name
    required: true
`;

async function loadDom(reducedMotion: boolean) {
	const html = await generateHtml(parseOk(requiredFormYaml));
	const window = new Window();
	window.document.write(html);
	(window as unknown as { matchMedia: unknown }).matchMedia = (
		query: string,
	) => ({
		matches: reducedMotion && query.includes("prefers-reduced-motion"),
		media: query,
	});
	const document = window.document as unknown as Document;
	initForm(document.querySelector(".yaml-form-root") as Element);
	return document;
}

function submitForm(doc: Document) {
	const form = doc.querySelector(".yaml-form-root form") as HTMLFormElement;
	const EventCtor = (doc.defaultView as unknown as { Event: typeof Event })
		.Event;
	form.dispatchEvent(
		new EventCtor("submit", { bubbles: true, cancelable: true }),
	);
}

function spyScroll(doc: Document) {
	const item = doc.querySelector('[data-item-id="name"]') as HTMLElement;
	const spy = mock((_options?: { behavior: string; block: string }) => {});
	(item as unknown as { scrollIntoView: unknown }).scrollIntoView = spy;
	return spy;
}

describe("scroll-to-error respects prefers-reduced-motion", () => {
	test("scrolls smoothly when no reduction is requested", async () => {
		const document = await loadDom(false);
		const spy = spyScroll(document);
		submitForm(document);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]?.[0]).toEqual({
			behavior: "smooth",
			block: "center",
		});
	});

	test("falls back to auto under prefers-reduced-motion: reduce", async () => {
		const document = await loadDom(true);
		const spy = spyScroll(document);
		submitForm(document);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]?.[0]).toEqual({
			behavior: "auto",
			block: "center",
		});
	});
});
