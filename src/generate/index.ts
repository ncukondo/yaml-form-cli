import pkg from "../../package.json";
import { resolveMessages } from "../messages.ts";
import type { Form, Link } from "../schema/form-schema.ts";
import { escapeAttr, escapeHtml, renderLink, renderText } from "./escape.ts";
import { formIdPrefix } from "./ids.ts";
import { renderItem } from "./render-item.ts";
import { getRuntimeBundle } from "./runtime-bundle.ts";
import { baseStyles, draftStyles, standaloneStyles } from "./styles.ts";

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

// The root element's inner markup — draft notice, header, form, success screen,
// and the embedded data/meta scripts — shared verbatim by standalone documents
// and fragments (decision 0019). The wrapping root element, the <style>
// placement, the runtime <script> placement, and the document envelope are the
// only differences and live in the two callers below.
function renderRootInner(form: Form, prefix: string): string {
	const messages = resolveMessages(form);
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
	return `${draftNotice}<header>
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
<script type="application/json" class="yaml-form-meta">${embedJson({ generator: `yaml-form/${pkg.version}` })}</script>`;
}

export async function generateHtml(form: Form): Promise<string> {
	const runtime = await getRuntimeBundle();
	// Per-form id prefix; also the root element's id, so the runtime recovers it
	// from root.id (decision 0019). Empty for an id-less standalone form.
	const prefix = formIdPrefix(form.id);
	const rootId = prefix ? ` id="${escapeAttr(prefix)}"` : "";
	// Scoped core (+ draft styles) is shared with fragment output; the page-level
	// reset is a standalone-document concern (decision 0020).
	const styles = `${baseStyles}${form.autosave ? draftStyles : ""}${standaloneStyles}`;
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
${renderRootInner(form, prefix)}
</main>
<script>${runtime}</script>
</body>
</html>
`;
}

/**
 * Fragment output (decision 0019): a self-contained `.yaml-form-root` subtree
 * with no document envelope, compositable into a host page at build time — and
 * safely more than once, because the runtime is root-scoped. The scoped
 * `<style>` (core + draft only, no standalone page reset) and the runtime
 * bundle `<script>` both live inside the root; the bundle's `document.
 * currentScript` bootstrap then initializes exactly this root. Requires
 * `form.id` so ids stay unique across fragments sharing a page.
 */
export async function generateFragment(form: Form): Promise<string> {
	if (form.id === undefined) {
		throw new Error("generate --fragment requires the form to define an `id`");
	}
	const runtime = await getRuntimeBundle();
	const prefix = formIdPrefix(form.id);
	// No standalone body/page reset: a fragment must never restyle its host, and
	// its width/placement is the host's concern (decision 0020).
	const styles = `${baseStyles}${form.autosave ? draftStyles : ""}`;
	return `<div class="yaml-form-root" id="${escapeAttr(prefix)}">
<style>${styles}</style>
${renderRootInner(form, prefix)}
<script>${runtime}</script>
</div>
`;
}
