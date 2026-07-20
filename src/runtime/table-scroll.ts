// Scroll-affordance helper for choice_table / rubric containers: keeps
// data-scroll-start / data-scroll-end on .table-scroll in sync with whether
// columns are hidden to the left/right. styles.ts renders the visual cues;
// CSS alone cannot detect the scroll position (the background-attachment
// scroll-shadow technique is defeated by the opaque sticky cells).

function updateScrollCues(el: HTMLElement): void {
	// 1px tolerance absorbs fractional scroll positions at non-integer zoom
	el.toggleAttribute("data-scroll-start", el.scrollLeft > 1);
	el.toggleAttribute(
		"data-scroll-end",
		el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
	);
}

export function initTableScroll(root: Element): void {
	const scrollers = Array.from(
		root.querySelectorAll<HTMLElement>(".table-scroll"),
	);
	if (scrollers.length === 0) return;
	for (const el of scrollers) {
		el.addEventListener("scroll", () => updateScrollCues(el), {
			passive: true,
		});
		updateScrollCues(el);
	}
	// One resize listener per root; each refreshes only its own scrollers.
	root.ownerDocument?.defaultView?.addEventListener("resize", () => {
		for (const el of scrollers) updateScrollCues(el);
	});
}
