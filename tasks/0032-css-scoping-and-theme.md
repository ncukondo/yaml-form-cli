# Task 0032: CSS scoping under `.yaml-form-root` + `--yf-*` theme knobs

Status: todo
Depends on: 0031 (needs the `.yaml-form-root` wrapper)
Parallel: yes — disjoint from task 0033 (styles.ts vs submit.ts); both land after 0031

## Goal

All generated CSS is scoped under `.yaml-form-root` so a form fragment cannot
leak styles into a host page, host fonts flow in by inheritance, and a small
documented set of `--yf-*` custom properties (set in host CSS) themes the form.
Standalone output looks identical to today.

## Context

- Relevant decisions: `decisions/0020-css-scoping-and-theme-api.md`
  (scoping mechanism, standalone-only `body` reset, host-CSS `--yf-*` knobs,
  Shadow-DOM / YAML-theme deferral).
- Builds on the `.yaml-form-root` wrapper from task 0031.
- `src/generate/styles.ts` — current global stylesheet: `:root` variable block
  (+ dark `@media`), `* { box-sizing }`, `body { … }` reset, bare element
  selectors, `draftStyles`, `columnHighlight()`, appended short-text/success/
  print blocks.
- `src/generate/index.ts` — assembles `<style>` from `baseStyles` (+
  `draftStyles`); standalone puts it in `<head>`.
- `tests/generate/styles.test.ts` asserts on **exact selector strings**
  (~40 cases) and matches the `:root {…}` / `@media(dark){ :root {…} }` blocks
  via `lightBlock`/`darkBlock` helpers. Prefixing every selector and moving the
  variable block off `:root` breaks nearly all of them — this test migration is
  the bulk of the task, not an afterthought.

## Scope

- `src/generate/styles.ts`:
  - Prefix every rule with `.yaml-form-root` by **string prefixing, not native
    CSS nesting** (keeps broad browser support — the sheet already ships
    `@supports not selector(:has())` fallbacks — and keeps the tests'
    selector-string matching viable). Distinguish the two prefix forms: the
    root **itself** (`.yaml-form-root { --fg…; color-scheme; line-height }`) vs
    **descendants** (`.yaml-form-root .container`, `.yaml-form-root input[…]`).
    Cover `columnHighlight()`'s generated selectors and every appended block.
  - Move the `:root` variable block and its dark `@media` override onto
    `.yaml-form-root`; set `color-scheme: light dark` on the root; `* { box-sizing }`
    → `.yaml-form-root, .yaml-form-root *`.
  - Factor the page/`body` reset into a **standalone-only** exported block
    (same conditional-append pattern as `draftStyles`), not emitted for
    fragments. Inside the root, do not reset `font-family` (inherit host
    fonts); pin `color`/`line-height` and a surface `background` where needed.
  - Front the public knobs with `--yf-*` fallbacks:
    `--accent: var(--yf-accent, …)`, `--accent-contrast`, `--fg`, `--bg`, and
    `font-size: var(--yf-font-size, 1rem)`. Internal vars stay private.
- `src/generate/index.ts` — append the standalone `body` block only in
  standalone assembly; scoped core + `draftStyles` shared by both modes.
- Docs: `docs/reference.md` (a "theming with `--yf-*`" note) — the public knob
  list and that they are set in host page CSS.
- Tests: `tests/generate/styles.test.ts` — rework `lightBlock`/`darkBlock` to
  match the variable block on `.yaml-form-root` (light) and inside the dark
  `@media`; update the ~40 selector assertions to the prefixed form; add cases:
  no rule escapes `.yaml-form-root`, the standalone `body` block is present only
  in standalone output and absent from the scoped core, and unset `--yf-*`
  fallbacks resolve to the current default tokens.

## Out of scope

- Shadow DOM isolation and a YAML `theme` block (deferred, decision 0020).
- The `--fragment` CLI mode itself (task 0034) — this task keeps standalone
  emission working and makes the stylesheet fragment-ready.
- Runtime/JS changes (tasks 0031/0033).

## TDD plan

1. **Red** — `styles.test.ts`: assert no top-level `:root`/`body`/bare-element
   selector escapes `.yaml-form-root`; assert the standalone `body` block is
   present in standalone output and absent from the scoped core; assert
   `--yf-accent` (etc.) unset reproduces the current accent color.
2. **Green** — prefix rules, relocate variables, split the `body` reset,
   add `--yf-*` fallbacks.
3. **Refactor** — one prefixing approach shared across `baseStyles`,
   `draftStyles`, `columnHighlight()`, and appended blocks; keep the dark-mode
   and print media queries intact. Rebuild any embedded/runtime CSS.

## Acceptance criteria

- [ ] Every generated CSS rule is scoped under `.yaml-form-root`
- [ ] Standalone output is visually unchanged (variables, dark mode, print all
      still apply); the `body`/page reset is present only in standalone
- [ ] `--yf-accent` / `--yf-accent-contrast` / `--yf-fg` / `--yf-bg` /
      `--yf-font-size` override the form when set on `.yaml-form-root` in host
      CSS; unset knobs keep today's look
- [ ] Host fonts inherit into the form (no `font-family` hard reset in root)
- [ ] `bun run check` passes
- [ ] `docs/reference.md` documents the `--yf-*` theming knobs

## Verification

- `bun test tests/generate/styles.test.ts tests/generate`
- Manual: generate `examples/sample.yaml` standalone → unchanged in light/dark
  and print preview; embed the scoped `<style>` + root subtree in a page that
  sets `--yf-accent` and confirm only the form restyles, host `h1`/`a`/inputs
  untouched.
