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
| [0009 Distribution & upgrade](0009-distribution.md) | 0008 | — | todo |
| [0010 Release docs verification](0010-release-docs.md) | 0009 | — | todo |

Group A tasks touch disjoint areas (runtime modules / generator modules /
CLI entry) and can proceed in parallel worktrees once 0003 lands.
