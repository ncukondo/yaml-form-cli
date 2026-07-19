// Shared URL policy (decision 0018): a scheme allowlist plus relative/absolute
// classification. Used by structured `links`, autolink/link target derivation,
// and the `post` action URL validator. No DOM — safe in schema and generator.

export type UrlKind = "relative" | "absolute" | "mailto";

/** Classify a URL against the allowlist, or `null` when disallowed
 * (`javascript:`, `data:`, `tel:`, `file:`, a bare `c:\…`, …). Relative
 * references (no scheme) and protocol-relative `//host` URLs are allowed. */
export function classifyUrl(url: string): UrlKind | null {
	const u = url.trim();
	if (u === "") return null;
	// Protocol-relative (//host/path) inherits the page scheme → external.
	if (u.startsWith("//")) return "absolute";
	const scheme = u.match(/^([a-z][a-z0-9+.-]*):/i);
	// No scheme → a relative reference (path-absolute, dot-relative, query, or
	// fragment). Safe: it can only ever resolve within the serving origin.
	if (!scheme) return "relative";
	const name = (scheme[1] as string).toLowerCase();
	if (name === "http" || name === "https") return "absolute";
	if (name === "mailto") return "mailto";
	return null;
}

export function isAllowedUrl(url: string): boolean {
	return classifyUrl(url) !== null;
}

/** Absolute (incl. protocol-relative) URLs open in a new tab by default;
 * relative and `mailto:` stay in the same tab. */
export function isExternalUrl(url: string): boolean {
	return classifyUrl(url) === "absolute";
}

/** URLs valid as a `post` action fetch target (decision 0018): an absolute
 * http(s) URL or a relative reference. `mailto:` and disallowed schemes are
 * not fetchable. Relative targets resolve against the page at submit time. */
export function isFetchUrl(url: string): boolean {
	const kind = classifyUrl(url);
	return kind === "absolute" || kind === "relative";
}
