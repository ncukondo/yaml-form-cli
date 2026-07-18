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
	padding: 0.15rem 0;
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
	max-height: 75vh;
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

/* Narrow screens: stack each table row as its own block.
   display: block would strip the implicit table/row/cell roles; the markup
   carries explicit ARIA roles (choice-table.ts) so AT still gets a table
   with visible row titles and inlined .cell-choice text — the hidden thead
   is not needed to interpret a stacked row. */
@media (max-width: 640px) {
	.table-scroll {
		overflow: visible;
		max-height: none;
		border: 0;
		border-radius: 0;
	}
	.choice-table,
	.choice-table tbody,
	.choice-table tr,
	.choice-table th,
	.choice-table td { display: block; width: 100%; }
	.choice-table thead { display: none; }
	.choice-table th, .choice-table td {
		position: static;
		border: 0;
		text-align: left;
		padding: 0.25rem 0.65rem;
	}
	.choice-table tr.table-row {
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		margin: 0 0 0.75rem;
		padding: 0.35rem 0;
	}
	.choice-table tr.table-comment-row {
		margin: -0.5rem 0 0.75rem;
		padding: 0.25rem 0 0.5rem;
		border: 1px solid var(--border);
		border-top: 0;
		border-radius: 0 0 0.375rem 0.375rem;
	}
	.choice-table tr.table-row:has(+ tr.table-comment-row) {
		margin-bottom: 0;
		border-bottom: 0;
		border-radius: 0.375rem 0.375rem 0 0;
	}
	.table-cell-label {
		flex-direction: row;
		align-items: baseline;
		gap: 0.5rem;
	}
	.cell-choice { display: inline; }
	.cell-descriptor { min-width: 0; }
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
	/* stacked rows lose cell borders; mark the whole row card instead */
	.choice-table tr.table-row:has([aria-invalid="true"]) {
		border-color: var(--error);
		border-width: 2px;
	}
	.choice-table tr.table-row:has([aria-invalid="true"]) > th,
	.choice-table tr.table-row:has([aria-invalid="true"]) > td {
		box-shadow: none;
	}
	.choice-table tr.table-row:has([aria-invalid="true"]) .row-label {
		box-shadow: none;
	}
}
`;
