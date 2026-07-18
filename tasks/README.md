# Tasks

One file per unit of work, created from [`_template.md`](_template.md).
Completed task files move to [`archive/`](archive/) (keep the filename).

Rules:

- Work **TDD-first**: the task file lists the failing tests to write before
  implementation. A task is done when its acceptance criteria are checked and
  `bun test` / `bun run typecheck` pass.
- Each task declares `Depends on` and `Parallel`. Tasks marked parallel-safe
  have disjoint file scopes and can be developed concurrently in separate
  `git worktree`s (orchestrated with herdr).
- Don't restate decisions — link to `decisions/NNNN-*.md`. If work reveals a
  needed decision change, record a new decision first.
- Docs (`docs/`, `README.md`) updates affected by a task are part of that
  task's definition of done.

## Current plan

| Task | Depends on | Parallel group | Status |
| ---- | ---------- | -------------- | ------ |
| [0001 Project setup](archive/0001-project-setup.md) | — | — | done |
| [0002 Schema & validation](archive/0002-schema-and-validation.md) | 0001 | — | done |
| [0003 HTML generator skeleton](archive/0003-html-generator-skeleton.md) | 0002 | — | done |
| [0004 visible_when runtime](archive/0004-visible-when-runtime.md) | 0003 | A | done |
| [0005 choice_table & rubric rendering](archive/0005-tables-rendering.md) | 0003 | A | done |
| [0006 Submit actions runtime](archive/0006-actions-runtime.md) | 0003 | A | done |
| [0007 Rule-key validation](archive/0007-rule-key-validation.md) | 0002 | A | done |
| [0008 CLI](archive/0008-cli.md) | 0003 | A | done |
| [0009 Distribution & upgrade](archive/0009-distribution.md) | 0008 | — | done |
| [0010 Release docs verification](archive/0010-release-docs.md) | 0009 | — | done |
| [0011 a11y: field labels & required](0011-a11y-field-labels.md) (#1 #2 #3) | 0010 | B | todo |
| [0012 a11y: error announcement & invalid styling](0012-a11y-error-announcement.md) (#4 #12) | 0011, 0016 | — | todo |
| [0013 Submit flow a11y & double-submit guard](0013-submit-flow-a11y-ux.md) (#5 #9) | 0010 | B | todo |
| [0014 Table cell a11y & mobile semantics](0014-table-cell-a11y.md) (#6) | 0010 | B | todo |
| [0015 i18n: lang & messages](0015-i18n-lang-and-messages.md) (#7) | 0012, 0013, 0014 | — | todo |
| [0016 Theme contrast fixes](0016-theme-contrast.md) (#8 #11 #13) | 0010 | B | todo |
| [0017 UX/a11y batch](0017-ux-a11y-batch.md) (#10) | 0012, 0016 | — | todo |
| [0018 Table scroll affordance](0018-table-scroll-affordance.md) (#14) | 0016 | — | todo |
| [0019 Mobile wide-table layout](0019-mobile-wide-tables.md) (#15) | 0014, 0018 | — | todo |
| [0020 UI polish batch](0020-ui-polish-batch.md) (#16) | 0013, 0016, 0018 | — | todo |

Group A tasks touch disjoint areas (runtime modules / generator modules /
CLI entry) and can proceed in parallel worktrees once 0003 lands.

Group B (0011 / 0013 / 0014 / 0016) have disjoint file scopes —
`render-item.ts` / `submit.ts` + form shell / `items/*.ts` / `styles.ts`
tokens — and can run in parallel worktrees. The remaining tasks share
`styles.ts` or `form.ts` and run sequentially per their dependencies.
0015, 0017 (schema fields), and 0019 each require a new `decisions/` entry
before implementation. (#N = GitHub issue.)
