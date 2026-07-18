export function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function escapeAttr(text: string): string {
	return escapeHtml(text);
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/** Escape text for HTML, turning bare http(s) URLs into links.
 * Newlines are preserved via `white-space: pre-line` on the container. */
export function renderText(text: string): string {
	let out = "";
	let last = 0;
	for (const match of text.matchAll(URL_PATTERN)) {
		const url = match[0];
		out += escapeHtml(text.slice(last, match.index));
		out += `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
		last = match.index + url.length;
	}
	out += escapeHtml(text.slice(last));
	return out;
}
