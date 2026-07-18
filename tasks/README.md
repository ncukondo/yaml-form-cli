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

| Task | Depends on | Parallel group |
| ---- | ---------- | -------------- |
| [0001 Project setup](0001-project-setup.md) | — | — |
| [0002 Schema & validation](0002-schema-and-validation.md) | 0001 | — |
| [0003 HTML generator skeleton](0003-html-generator-skeleton.md) | 0002 | — |
| [0004 visible_when runtime](0004-visible-when-runtime.md) | 0003 | A |
| [0005 choice_table & rubric rendering](0005-tables-rendering.md) | 0003 | A |
| [0006 Submit actions runtime](0006-actions-runtime.md) | 0003 | A |
| [0007 Rule-key validation](0007-rule-key-validation.md) | 0002 | A |
| [0008 CLI](0008-cli.md) | 0003 | A |
| [0009 Distribution & upgrade](0009-distribution.md) | 0008 | — |
| [0010 Release docs verification](0010-release-docs.md) | 0009 | — |

Group A tasks touch disjoint areas (runtime modules / generator modules /
CLI entry) and can proceed in parallel worktrees once 0003 lands.
