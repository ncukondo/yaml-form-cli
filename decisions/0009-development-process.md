# 0009: Development process

Date: 2026-07-18
Status: accepted

## Context

A standalone SPEC document and the code would be two sources of truth and
drift apart. We also want to develop independent tasks in parallel.

## Decision

- **No living SPEC.** Decisions are recorded per-topic in `decisions/`;
  user-facing behavior is documented in `docs/` and `README.md`; the accepted
  format is enforced by the JSON Schema and generation-time validation. The
  original SPEC is archived at `decisions/archive/SPEC.md` once migrated.
- **Task files** in `tasks/`, one per unit of work, created from
  `tasks/_template.md`. Tasks are written TDD-first (red → green → refactor
  steps and acceptance criteria in the file). Completed task files move to
  `tasks/archive/`.
- **Parallel development** with `git worktree` + herdr for tasks marked as
  parallel-safe (disjoint file scopes); dependencies are declared in each task
  file.

## Consequences

- Docs updates are part of a task's definition of done, not an afterthought.
- Task files double as the work log; the archive preserves history.
