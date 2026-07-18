export const baseStyles = `
:root {
	color-scheme: light dark;
	--fg: #1a1a1a;
	--bg: #ffffff;
	--muted: #555;
	--border: #ccc;
	--accent: #2563eb;
	--error: #b91c1c;
}
@media (prefers-color-scheme: dark) {
	:root {
		--fg: #e5e5e5;
		--bg: #171717;
		--muted: #a3a3a3;
		--border: #444;
		--accent: #60a5fa;
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
	border: 1px solid var(--border);
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
.item-error {
	color: var(--error);
	font-size: 0.9rem;
	margin: 0.35rem 0 0;
}
.placeholder {
	color: var(--muted);
	font-style: italic;
	border: 1px dashed var(--border);
	border-radius: 0.375rem;
	padding: 0.75rem;
}
button[type="submit"] {
	font: inherit;
	font-weight: 600;
	color: #fff;
	background: var(--accent);
	border: 0;
	border-radius: 0.375rem;
	padding: 0.6rem 1.5rem;
	cursor: pointer;
}
button[type="submit"]:hover { filter: brightness(1.1); }
.form-error {
	color: var(--error);
	font-weight: 600;
	margin: 1rem 0 0;
}
.form-success {
	font-size: 1.1rem;
	white-space: pre-line;
}
`;
