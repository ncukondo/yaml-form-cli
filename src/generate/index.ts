import type { Form } from "../schema/form-schema.ts";
import { escapeHtml, renderText } from "./escape.ts";
import { renderItem } from "./render-item.ts";
import { getRuntimeBundle } from "./runtime-bundle.ts";
import { baseStyles } from "./styles.ts";

function embedFormData(form: Form): string {
	// <-escape so "</script>" can never terminate the data block
	return JSON.stringify(form).replaceAll("<", "\\u003c");
}

export async function generateHtml(form: Form): Promise<string> {
	const runtime = await getRuntimeBundle();
	const description = form.description
		? `<p class="form-description">${renderText(form.description)}</p>`
		: "";
	const items = form.items.map(renderItem).join("\n");
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(form.title)}</title>
<style>${baseStyles}</style>
</head>
<body>
<main class="container">
<header>
<h1>${escapeHtml(form.title)}</h1>
${description}
</header>
<form id="yaml-form" novalidate>
${items}
<button type="submit">Submit</button>
</form>
</main>
<script type="application/json" id="yaml-form-data">${embedFormData(form)}</script>
<script>${runtime}</script>
</body>
</html>
`;
}
