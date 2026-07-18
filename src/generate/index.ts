import pkg from "../../package.json";
import { resolveMessages } from "../messages.ts";
import type { Form } from "../schema/form-schema.ts";
import { escapeAttr, escapeHtml, renderText } from "./escape.ts";
import { renderItem } from "./render-item.ts";
import { getRuntimeBundle } from "./runtime-bundle.ts";
import { baseStyles } from "./styles.ts";

function embedJson(data: unknown): string {
	// <-escape so "</script>" can never terminate the data block
	return JSON.stringify(data).replaceAll("<", "\\u003c");
}

export async function generateHtml(form: Form): Promise<string> {
	const runtime = await getRuntimeBundle();
	const messages = resolveMessages(form);
	const description = form.description
		? `<p class="form-description">${renderText(form.description)}</p>`
		: "";
	const items = form.items.map((item) => renderItem(item, messages)).join("\n");
	// {mark} is an HTML element, so the template is escaped around it instead
	// of going through formatMessage.
	const legendHtml = messages.required_legend
		.split("{mark}")
		.map(escapeHtml)
		.join('<span class="required-mark">*</span>');
	const requiredLegend = form.items.some((item) => item.required)
		? `<p class="required-legend">${legendHtml}</p>\n`
		: "";
	return `<!doctype html>
<html lang="${escapeAttr(form.lang)}">
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
${requiredLegend}${items}
<button type="submit">${escapeHtml(messages.submit)}</button>
<p class="form-error" id="yaml-form-error" role="alert" hidden></p>
</form>
<section class="form-success" id="yaml-form-success" role="status" tabindex="-1" hidden></section>
</main>
<script type="application/json" id="yaml-form-data">${embedJson(form)}</script>
<script type="application/json" id="yaml-form-meta">${embedJson({ generator: `yaml-form/${pkg.version}` })}</script>
<script>${runtime}</script>
</body>
</html>
`;
}
