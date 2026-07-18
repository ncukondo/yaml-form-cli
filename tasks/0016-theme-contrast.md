# Task 0016: Theme contrast fixes — borders, dark Submit button, control accent/size

Status: todo
Depends on: 0010
Parallel: yes — group B (owns `src/generate/styles.ts` theme tokens)

Issues: #8, #11, #13

## Goal

Interactive-element contrast meets WCAG (1.4.11 non-text 3:1, 1.4.3 text
4.5:1) in both themes, and radio/checkbox controls match the accent color at
a usable size.

## Context

- Issue #8: `--border` ≈ 1.6:1 light (`#ccc`/`#fff`), ≈ 1.9:1 dark
  (`#444`/`#171717`) — targets ~`#767676` light / ~`#8a8a8a` dark for
  inputs/buttons; decorative table rules may stay subtle.
- Issue #11: dark `--accent: #60a5fa` + white button text ≈ 2.5:1; hover
  `brightness(1.1)` worsens it. Fix via dark text on the button or a darker
  button background; consider splitting `--accent` (links/focus) from a
  button-background token (`--accent-contrast`).
- Issue #13: no `accent-color`; controls at UA default ~13px. Add
  `accent-color: var(--accent)` and `width/height: 1.1rem` for
  radio/checkbox.

## Scope

- `src/generate/styles.ts` only: theme variables, button rules, control
  rules. Verify each changed pair with a contrast calculation (record the
  ratios in the task/commit message).

## Out of scope

- `.choice-option` padding / touch-target size (Task 0017).
- Invalid-state border colors (Task 0012 — but it consumes the tokens
  chosen here, hence 0012 depends on this task).

## TDD plan

1. **Red** — style tests (string/regex over generated CSS): new border
   token values present in both themes; dark-mode button text is not
   `#fff` on `#60a5fa` (or background token changed); `accent-color` and
   control sizing rules emitted.
2. **Green** — adjust tokens/rules.
3. **Refactor** — name tokens for purpose (`--border-input` vs decorative)
   if the split clarifies.

## Acceptance criteria

- [ ] Input/button borders ≥ 3:1 against their backgrounds in both themes
- [ ] Dark-mode Submit button text ≥ 4.5:1, including hover state
- [ ] Radios/checkboxes use the theme accent and are ~1.1rem
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/generate` — CSS assertions
- Manual: generated form in light/dark; check ratios with a contrast
  checker (devtools or WebAIM).
