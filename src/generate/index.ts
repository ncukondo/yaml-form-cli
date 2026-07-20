import pkg from "../../package.json";
import { resolveMessages } from "../messages.ts";
import type { Form, Link } from "../schema/form-schema.ts";
import { escapeAttr, escapeHtml, renderLink, renderText } from "./escape.ts";
import { formIdPrefix } from "./ids.ts";
import { renderItem } from "./render-item.ts";
import { getRuntimeBundle } from "./runtime-bundle.ts";
import { baseStyles, draftStyles } from "./styles.ts";

function embedJson(data: unknown): string {
	// <-escape so "</script>" can never terminate the data block
	return JSON.stringify(data).replaceAll("<", "\\u003c");
}

// Decision 0018: a structured navigation list. Empty/undefined → nothing.
function renderLinkList(
	links: readonly Link[] | undefined,
	className: string,
): string {
	if (!links || links.length === 0) return "";
	const items = links.map((link) => `<li>${renderLink(link)}</li>`).join("");
	return `<nav class="${className}"><ul>${items}</ul></nav>`;
}

export async function generateHtml(form: Form): Promise<string> {
	const runtime = await getRuntimeBundle();
	const messages = resolveMessages(form);
	// Per-form id prefix; also the root element's id, so the runtime recovers it
	// from root.id (decision 0019). Empty for an id-less standalone form.
	const prefix = formIdPrefix(form.id);
	const rootId = prefix ? ` id="${escapeAttr(prefix)}"` : "";
	const description = form.description
		? `<p class="form-description">${renderText(form.description)}</p>`
		: "";
	const items = form.items
		.map((item) => renderItem(item, messages, prefix))
		.join("\n");
	// {mark} is an HTML element, so the template is escaped around it instead
	// of going through formatMessage.
	const legendHtml = messages.required_legend
		.split("{mark}")
		.map(escapeHtml)
		.join('<span class="required-mark">*</span>');
	const requiredLegend = form.items.some((item) => item.required)
		? `<p class="required-legend">${legendHtml}</p>\n`
		: "";
	// Only autosaving forms carry the restore-notice slot (and its styles);
	// with autosave: false the runtime never shows it.
	const draftNotice = form.autosave
		? `<div class="draft-notice" role="status" hidden>
<span class="draft-notice-message">${escapeHtml(messages.draft_restored)}</span>
<button type="button" class="draft-discard">${escapeHtml(messages.draft_discard)}</button>
</div>
`
		: "";
	const styles = `${baseStyles}${form.autosave ? draftStyles : ""}`;
	// Decision 0017: emit a robots meta unless both directives are opted out.
	const robots = [
		form.noindex ? "noindex" : "",
		form.nofollow ? "nofollow" : "",
	]
		.filter(Boolean)
		.join(", ");
	const robotsMeta = robots ? `\n<meta name="robots" content="${robots}">` : "";
	return `<!doctype html>
<html lang="${escapeAttr(form.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${robotsMeta}
<title>${escapeHtml(form.title)}</title>
<style>${styles}</style>
</head>
<body>
<main class="container yaml-form-root"${rootId}>
${draftNotice}<header>
<h1>${escapeHtml(form.title)}</h1>
${description}
${renderLinkList(form.links, "form-links")}</header>
<noscript><p class="noscript-warning">${escapeHtml(messages.noscript_warning)}</p></noscript>
<form novalidate>
${requiredLegend}${items}
<button type="submit">${escapeHtml(messages.submit)}</button>
<p class="form-error" role="alert" hidden></p>
</form>
<section class="form-success" role="status" tabindex="-1" hidden>
<svg class="success-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
<p class="success-message"></p>
${renderLinkList(form.post_submit?.links, "success-links")}</section>
<script type="application/json" class="yaml-form-data">${embedJson(form)}</script>
<script type="application/json" class="yaml-form-meta">${embedJson({ generator: `yaml-form/${pkg.version}` })}</script>
</main>
<script>${runtime}</script>
</body>
</html>
`;
}
