export const baseStyles = `
:root {
	color-scheme: light dark;
	--fg: #1a1a1a;
	--bg: #ffffff;
	--muted: #555;
	--border: #ccc;
	--border-input: #767676;
	--accent: #2563eb;
	--accent-contrast: #ffffff;
	--error: #b91c1c;
}
@media (prefers-color-scheme: dark) {
	:root {
		--fg: #e5e5e5;
		--bg: #171717;
		--muted: #a3a3a3;
		--border: #444;
		--border-input: #8a8a8a;
		--accent: #60a5fa;
		--accent-contrast: #171717;
		--error: #f87171;
	}
}
* { box-sizing: border-box; }
body {
	margin: 0;
	font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
	line-height: 1.6;
	color: var(--fg);
	background: var(--bg);
}
.container {
	max-width: 46rem;
	margin: 0 auto;
	padding: 1.5rem 1rem 4rem;
}
h1 { font-size: 1.6rem; margin: 0 0 0.5rem; }
.form-description {
	white-space: pre-line;
	color: var(--muted);
	margin: 0 0 1.5rem;
}
a { color: var(--accent); }
.form-item {
	margin: 0 0 1.5rem;
	padding: 0;
	border: 0;
}
.item-title {
	display: block;
	font-weight: 600;
	margin-bottom: 0.25rem;
}
.required-mark { color: var(--error); margin-left: 0.15rem; }
.item-description {
	white-space: pre-line;
	color: var(--muted);
	font-size: 0.9rem;
	margin: 0 0 0.5rem;
}
input[type="text"], textarea {
	width: 100%;
	font: inherit;
	color: inherit;
	background: transparent;
	padding: 0.5rem 0.65rem;
	border: 1px solid var(--border-input);
	border-radius: 0.375rem;
}
input[type="text"]:focus, textarea:focus {
	outline: 2px solid var(--accent);
	outline-offset: 1px;
	border-color: transparent;
}
textarea { min-height: 6rem; resize: vertical; }
.constant-value { color: var(--muted); }
.choice-option {
	display: flex;
	align-items: baseline;
	gap: 0.5rem;
	/* row height ≥ 24px (WCAG 2.5.8) even at line-height 1 */
	padding: 0.25rem 0;
	cursor: pointer;
}
input[type="radio"], input[type="checkbox"] {
	accent-color: var(--accent);
	width: 1.1rem;
	height: 1.1rem;
}
.item-error {
	color: var(--error);
	font-size: 0.9rem;
	margin: 0.35rem 0 0;
}
button[type="submit"] {
	font: inherit;
	font-weight: 600;
	color: var(--accent-contrast);
	background: var(--accent);
	border: 0;
	border-radius: 0.375rem;
	padding: 0.6rem 1.5rem;
	cursor: pointer;
}
button[type="submit"]:hover:not(:disabled) { filter: brightness(0.9); }
button[type="submit"]:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
.form-error {
	color: var(--error);
	font-weight: 600;
	margin: 1rem 0 0;
}
.form-success {
	font-size: 1.1rem;
	white-space: pre-line;
}

/* choice_table / rubric: scrolling table with sticky header + row labels */
.table-scroll {
	overflow: auto;
	border: 1px solid var(--border);
	border-radius: 0.375rem;
}
.choice-table {
	border-collapse: separate;
	border-spacing: 0;
	width: 100%;
}
.choice-table th, .choice-table td {
	padding: 0.5rem 0.65rem;
	border-bottom: 1px solid var(--border);
	background: var(--bg);
	text-align: center;
	vertical-align: top;
	font-weight: 400;
}
.choice-table tbody tr:last-child > th,
.choice-table tbody tr:last-child > td { border-bottom: 0; }
.choice-table thead th {
	position: sticky;
	top: 0;
	z-index: 2;
	font-weight: 600;
	border-bottom-width: 2px;
}
.choice-table .table-corner,
.choice-table .row-label {
	position: sticky;
	left: 0;
	z-index: 1;
	text-align: left;
	border-right: 1px solid var(--border);
}
.choice-table thead .table-corner { z-index: 3; }
.row-title { font-weight: 500; }
.table-cell-label {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
	cursor: pointer;
}
.cell-choice { display: none; }
.cell-descriptor {
	display: block;
	font-size: 0.85rem;
	color: var(--muted);
	text-align: left;
	min-width: 8rem;
}
.table-comment-row td { text-align: left; }
.row-comment-label { display: block; }
.row-comment-title {
	display: block;
	font-size: 0.85rem;
	color: var(--muted);
	margin-bottom: 0.25rem;
}
textarea.row-comment { min-height: 3rem; }
.row-error { font-weight: 400; }

/* Scroll affordance: table-scroll.ts toggles data-scroll-start/-end on
   .table-scroll while columns are hidden to the left/right. A pure-CSS
   background-attachment scroll shadow cannot work here — every cell paints
   an opaque background for the sticky header/row labels, which would cover
   anything drawn on the container's own background. */
.table-scroll[data-scroll-end] {
	-webkit-mask-image: linear-gradient(to right, #000 calc(100% - 2.25rem), transparent);
	mask-image: linear-gradient(to right, #000 calc(100% - 2.25rem), transparent);
}
/* Sticky cells stack above scrolled content, so their shadow paints over it. */
.table-scroll[data-scroll-start] .table-corner,
.table-scroll[data-scroll-start] .row-label {
	box-shadow: 0.4rem 0 0.5rem -0.25rem color-mix(in srgb, var(--fg) 30%, transparent);
}

/* Row tracking (zebra + hover), desktop widths only: the stacked mobile
   layout below renders rows as bordered cards and needs neither. Both rules
   tie for specificity, so hover must stay after zebra. */
@media (min-width: 641px) {
	.choice-table tbody tr:nth-child(even of .table-row) > th,
	.choice-table tbody tr:nth-child(even of .table-row) > td {
		background: color-mix(in srgb, var(--fg) 5%, var(--bg));
	}
	.choice-table tbody tr.table-row:hover > th,
	.choice-table tbody tr.table-row:hover > td {
		background: color-mix(in srgb, var(--fg) 12%, var(--bg));
	}
}

/* Narrow screens: stack each table row as its own block.
   display: block would strip the implicit table/row/cell roles; the markup
   carries explicit ARIA roles (choice-table.ts) so AT still gets a table
   with visible row titles and inlined .cell-choice text — the hidden thead
   is not needed to interpret a stacked row.
   Wide choice_tables (.table-wide on the wrapper, ≥ 6 columns — decision
   0012) are excluded: they keep the desktop scroll layout with sticky
   header/row labels instead of becoming an enormous vertical list. */
@media (max-width: 640px) {
	.table-scroll:not(.table-wide) {
		overflow: visible;
		max-height: none;
		border: 0;
		border-radius: 0;
	}
	.table-scroll:not(.table-wide) .choice-table,
	.table-scroll:not(.table-wide) .choice-table tbody,
	.table-scroll:not(.table-wide) .choice-table tr,
	.table-scroll:not(.table-wide) .choice-table th,
	.table-scroll:not(.table-wide) .choice-table td { display: block; width: 100%; }
	.table-scroll:not(.table-wide) .choice-table thead { display: none; }
	.table-scroll:not(.table-wide) .choice-table th,
	.table-scroll:not(.table-wide) .choice-table td {
		position: static;
		border: 0;
		text-align: left;
		padding: 0.25rem 0.65rem;
	}
	.table-scroll:not(.table-wide) .choice-table tr.table-row {
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		margin: 0 0 0.75rem;
		padding: 0.35rem 0;
	}
	.table-scroll:not(.table-wide) .choice-table tr.table-comment-row {
		margin: -0.5rem 0 0.75rem;
		padding: 0.25rem 0 0.5rem;
		border: 1px solid var(--border);
		border-top: 0;
		border-radius: 0 0 0.375rem 0.375rem;
	}
	.table-scroll:not(.table-wide) .choice-table tr.table-row:has(+ tr.table-comment-row) {
		margin-bottom: 0;
		border-bottom: 0;
		border-radius: 0.375rem 0.375rem 0 0;
	}
	.table-scroll:not(.table-wide) .table-cell-label {
		flex-direction: row;
		align-items: baseline;
		gap: 0.5rem;
	}
	.table-scroll:not(.table-wide) .cell-choice { display: inline; }
	.table-scroll:not(.table-wide) .cell-descriptor { min-width: 0; }
}

/* invalid state — aria-invalid is set by the runtime on failed validation */
input[type="text"][aria-invalid="true"],
textarea[aria-invalid="true"] {
	border-color: var(--error);
	/* thicken without shifting layout */
	box-shadow: inset 0 0 0 1px var(--error);
}
input[type="text"][aria-invalid="true"]:focus,
textarea[aria-invalid="true"]:focus {
	outline-color: var(--error);
}
.choice-options[aria-invalid="true"] {
	outline: 2px solid var(--error);
	outline-offset: 0.4rem;
	border-radius: 0.25rem;
}
.choice-table tr.table-row:has([aria-invalid="true"]) > th,
.choice-table tr.table-row:has([aria-invalid="true"]) > td {
	border-bottom-color: var(--error);
	box-shadow: inset 0 -1px 0 var(--error);
}
.choice-table tr.table-row:has([aria-invalid="true"]) .row-label {
	border-right-color: var(--error);
	box-shadow: inset 2px 0 0 var(--error), inset 0 -1px 0 var(--error);
}
@media (max-width: 640px) {
	/* stacked rows lose cell borders; mark the whole row card instead.
	   Wide tables (.table-wide) keep the desktop cell treatment above. */
	.table-scroll:not(.table-wide) .choice-table tr.table-row:has([aria-invalid="true"]) {
		border-color: var(--error);
		border-width: 2px;
	}
	.table-scroll:not(.table-wide) .choice-table tr.table-row:has([aria-invalid="true"]) > th,
	.table-scroll:not(.table-wide) .choice-table tr.table-row:has([aria-invalid="true"]) > td {
		box-shadow: none;
	}
	.table-scroll:not(.table-wide) .choice-table tr.table-row:has([aria-invalid="true"]) .row-label {
		box-shadow: none;
	}
}

/* short_text input_type variants (decision 0011) share the text-input
   styling. Kept as an appended block (instead of widening the selectors
   above) so parallel style work does not conflict. */
input:is([type="email"], [type="tel"], [type="url"], [type="number"]) {
	width: 100%;
	font: inherit;
	color: inherit;
	background: transparent;
	padding: 0.5rem 0.65rem;
	border: 1px solid var(--border-input);
	border-radius: 0.375rem;
}
input:is([type="email"], [type="tel"], [type="url"], [type="number"]):focus {
	outline: 2px solid var(--accent);
	outline-offset: 1px;
	border-color: transparent;
}
input:is([type="email"], [type="tel"], [type="url"], [type="number"])[aria-invalid="true"] {
	border-color: var(--error);
	box-shadow: inset 0 0 0 1px var(--error);
}
input:is([type="email"], [type="tel"], [type="url"], [type="number"])[aria-invalid="true"]:focus {
	outline-color: var(--error);
}

/* Nested scroll region only for tall tables — the renderer marks containers
   with more than 10 rendered rows (choice-table.ts); an unconditional
   max-height would trap wheel scrolling on short tables. Desktop widths
   only: the stacked mobile layout always flows with the page. Kept above
   the print block so the print reset wins on equal specificity. */
@media (min-width: 641px) {
	.table-scroll.table-scroll-tall {
		max-height: 75vh;
	}
}

/* Print: tables must paginate instead of scrolling, sticky cells must flow
   with the page, and screen-only chrome (submit button, scroll cues) is
   meaningless on paper. */
@media print {
	.table-scroll,
	.table-scroll.table-scroll-tall {
		max-height: none;
		overflow: visible;
	}
	.table-scroll[data-scroll-end] {
		-webkit-mask-image: none;
		mask-image: none;
	}
	.table-scroll[data-scroll-start] .table-corner,
	.table-scroll[data-scroll-start] .row-label { box-shadow: none; }
	.choice-table thead th,
	.choice-table .table-corner,
	.choice-table .row-label { position: static; }
	button[type="submit"] { display: none; }
}

/* Fallback for the mobile comment-row merge, which relies on
   tr.table-row:has(+ tr.table-comment-row) (stacked-layout block above).
   Browsers without :has() leave the row card its bottom border and full
   radius, so tucking the comment underneath would clash; render the comment
   as a complete card of its own right below the row instead. */
@supports not selector(:has(*)) {
	@media (max-width: 640px) {
		.table-scroll:not(.table-wide) .choice-table tr.table-comment-row {
			border-top: 1px solid var(--border);
			border-radius: 0.375rem;
			margin-top: 0;
		}
	}
}

/* Success screen: card with a checkmark badge (inline SVG in the document,
   no external assets). Complements the base .form-success text rule above. */
.form-success {
	border: 1px solid var(--border);
	border-radius: 0.5rem;
	background: color-mix(in srgb, var(--accent) 8%, var(--bg));
	padding: 2rem 1.5rem;
	text-align: center;
}
.success-icon {
	display: block;
	width: 3rem;
	height: 3rem;
	margin: 0 auto 0.75rem;
	padding: 0.6rem;
	color: var(--accent-contrast);
	background: var(--accent);
	border-radius: 50%;
}
.success-message { margin: 0; }

/* Submit button keyboard/pressed states: the same accent ring text inputs
   use, offset because the button background is the accent itself; :active
   darkens beyond the hover state. */
button[type="submit"]:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}
button[type="submit"]:active:not(:disabled) { filter: brightness(0.8); }

/* Constant items are read-only content, not disabled inputs: a neutral
   box. Deliberately no accent color — that would read as a notice/alert.
   Overrides the muted color set in the base rule above. */
.constant-value {
	color: var(--fg);
	background: color-mix(in srgb, var(--fg) 4%, var(--bg));
	border: 1px solid var(--border);
	border-radius: 0.375rem;
	padding: 0.5rem 0.75rem;
	margin: 0;
}
`;

// Appended only for autosaving forms (generate/index.ts): the restore-notice
// slot is the sole consumer of these rules.
export const draftStyles = `
.draft-notice {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	flex-wrap: wrap;
	background: color-mix(in srgb, var(--accent) 6%, var(--bg));
	border: 1px solid var(--border);
	border-left: 3px solid var(--accent);
	border-radius: 0.375rem;
	padding: 0.6rem 0.9rem;
	margin: 0 0 1rem;
}
.draft-discard {
	font: inherit;
	color: var(--fg);
	background: none;
	border: 1px solid var(--border-input);
	border-radius: 0.375rem;
	padding: 0.25rem 0.75rem;
	cursor: pointer;
}
`;
