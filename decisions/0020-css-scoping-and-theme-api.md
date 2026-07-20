# 0020: CSS scoping and theme API — `.yaml-form-root`-scoped rules, host-CSS `--yf-*` knobs

Date: 2026-07-20
Status: accepted

## Context

When a form fragment (#36, decision 0019) is composited into a host page, the
generated CSS must not leak into the host, and the host's own styles should not
break the form. Today `styles.ts` emits document-global rules: a `:root` custom-
property block, `* { box-sizing }`, a `body { margin/font-family/… }` reset, and
bare element selectors (`h1`, `a`, `input[type=text]`, `button[type=submit]`, …).
Dropped into a host page verbatim these would restyle the host's `body`, every
`h1`, every `a`, and every input.

Two directions need different handling:

- **form → host leakage** must be prevented (the goal).
- **host → form inheritance** of fonts is desirable and should be allowed;
  only what must be pinned for the form to render correctly is reset.

Authors also want a small, stable set of theme knobs to match the form to the
host shell (accent color, font size). Shadow-DOM isolation is rejected for v1:
font inheritance, autofill, and form-control quirks make it more trouble than
selector scoping here.

## Decision

**1. Every generated rule is scoped under `.yaml-form-root`.** All selectors in
the emitted stylesheet are prefixed with `.yaml-form-root` (e.g.
`.yaml-form-root .form-item`, `.yaml-form-root input[type="text"]`). The custom-
property block moves from `:root` to `.yaml-form-root { … }`, including the
`@media (prefers-color-scheme: dark)` override (`.yaml-form-root` inside the
media query). `color-scheme: light dark` is set on `.yaml-form-root` and
inherits to its controls. `* { box-sizing }` becomes
`.yaml-form-root, .yaml-form-root * { box-sizing: border-box }`. Because a
`<style>` element carries no intrinsic scope, scoping is by **selector prefix**,
which works identically whether the stylesheet sits in `<head>` (standalone) or
inside the root `<div>` (fragment) — one code path.

**2. The `body` reset is a standalone-only block.** The page-level reset
(`body { margin; line-height; color; background; font-family }`) is a host
concern that must not be emitted into a fragment. It is factored into a separate
block appended **only in standalone output** — the same conditional-append
pattern `draftStyles` already uses. In fragment mode the form inherits
`font-family` from the host (allowed inheritance) and pins the minimum it needs
(`color`, `line-height`, `background` where a surface is required) on
`.yaml-form-root` itself.

**3. Host → form inheritance: inherit fonts, reset the minimum.** Inside
`.yaml-form-root` the form does **not** hard-reset `font-family` (host fonts flow
in). It does set `line-height` and text `color` on the root so host values can't
render the form unreadable, and form controls keep `font: inherit` as today.

**4. Theme knobs are public `--yf-*` custom properties, set via host CSS only.**
A small, documented set of `--yf-*` properties is the public theming contract.
Internal variables consume them with fallbacks, so unset knobs keep today's
look:

```css
.yaml-form-root {
  --accent: var(--yf-accent, #2563eb);
  --fg:     var(--yf-fg, #1a1a1a);
  font-size: var(--yf-font-size, 1rem);
}
```

Initial public set (stability contract): `--yf-accent`, `--yf-accent-contrast`,
`--yf-fg`, `--yf-bg`, `--yf-font-size`. Authors theme by declaring these on
`.yaml-form-root` (or an ancestor) in **host page CSS**. There is **no YAML
`theme` block in v1** — exposing knobs through host CSS keeps the scope small
and avoids new schema/validation surface; a YAML-driven theme can layer on later
without breaking this contract. Internal, unprefixed variables (`--border`,
`--muted`, …) remain private and may change.

## Consequences

- `styles.ts` is restructured: a `.yaml-form-root`-prefixed core stylesheet
  (shared by both modes), a standalone-only `body`/page-reset block, and the
  `--yf-*`-fronted variable declarations. `draftStyles` and the appended
  short-text/success/print blocks are prefixed the same way.
- The generated `<style>` grows slightly (a prefix per selector). Output is
  byte-duplicated per fragment (decision 0019) — accepted.
- A documented, minimal `--yf-*` theming API that host shells set in their own
  CSS; unset knobs reproduce the current default and dark-mode appearance, so
  existing standalone forms are visually unchanged.
- Shadow DOM and a YAML `theme` block are explicitly out of scope for v1.
- Snapshot/DOM tests that assert on generated CSS selectors are updated for the
  `.yaml-form-root` prefix; the standalone visual result is unchanged.
