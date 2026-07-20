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
| [0011 a11y: field labels & required](archive/0011-a11y-field-labels.md) (#1 #2 #3) | 0010 | B | done |
| [0012 a11y: error announcement & invalid styling](archive/0012-a11y-error-announcement.md) (#4 #12) | 0011, 0016 | — | done |
| [0013 Submit flow a11y & double-submit guard](archive/0013-submit-flow-a11y-ux.md) (#5 #9) | 0010 | B | done |
| [0014 Table cell a11y & mobile semantics](archive/0014-table-cell-a11y.md) (#6) | 0010 | B | done |
| [0015 i18n: lang & messages](archive/0015-i18n-lang-and-messages.md) (#7) | 0012, 0013, 0014 | — | done |
| [0016 Theme contrast fixes](archive/0016-theme-contrast.md) (#8 #11 #13) | 0010 | B | done |
| [0017 UX/a11y batch](archive/0017-ux-a11y-batch.md) (#10) | 0012, 0016 | — | done |
| [0018 Table scroll affordance](archive/0018-table-scroll-affordance.md) (#14) | 0016 | — | done |
| [0019 Mobile wide-table layout](archive/0019-mobile-wide-tables.md) (#15) | 0014, 0018 | — | done |
| [0020 UI polish batch](archive/0020-ui-polish-batch.md) (#16) | 0013, 0016, 0018 | — | done |
| [0021 i18n: noscript & clear-selection labels](archive/0021-i18n-noscript-clear-labels.md) (#28) | 0015, 0017 | — | done |
| [0022 URL-parameter prefill, constant `from_url` / `hidden`](archive/0022-url-prefill.md) | — | — | done |
| [0023 Draft autosave to localStorage](archive/0023-draft-autosave.md) | 0022 | — | done |
| [0024 CLI subcommands, `validate`, `--json`, exit codes](archive/0024-cli-subcommands.md) | — | C | done |
| [0025 `docs` / `schema` / `example` subcommands](archive/0025-embedded-docs-commands.md) | 0024 | D | done |
| [0026 `visible_when` value-domain check](archive/0026-rule-value-domain-check.md) | — | C | done |
| [0027 `eval` headless rule evaluation](archive/0027-eval-command.md) | 0024 | D | done |
| [0028 `robots` meta output](archive/0028-robots-meta.md) (#33) | — | E | done |
| [0029 Link policy: structured `links`, autolink, target, allowlist](archive/0029-links-and-autolink-policy.md) (#32 #34) | — | E | done |
| [0030 `post` action relative URL](archive/0030-post-relative-url.md) (#35) | 0029 | — | done |
| [0031 Root-element-scoped runtime](0031-root-scoped-runtime.md) | — | — | done |
| [0032 CSS scoping + `--yf-*` theme](archive/0032-css-scoping-and-theme.md) (#37) | 0031 | F | done |
| [0033 Submit-completion events](archive/0033-submit-events.md) (#38) | 0031 | F | done |
| [0034 `generate --fragment` output](0034-fragment-output-mode.md) (#36) | 0031, 0032, 0033 | — | todo |

Group A tasks touch disjoint areas (runtime modules / generator modules /
CLI entry) and can proceed in parallel worktrees once 0003 lands.

Group B (0011 / 0013 / 0014 / 0016) have disjoint file scopes —
`render-item.ts` / `submit.ts` + form shell / `items/*.ts` / `styles.ts`
tokens — and can run in parallel worktrees. The remaining tasks share
`styles.ts` or `form.ts` and run sequentially per their dependencies.
0015, 0017 (schema fields), and 0019 each require a new `decisions/` entry
before implementation. (#N = GitHub issue.)

Group C (0024 / 0026) have disjoint scopes — CLI entry (`src/cli.ts`) vs
schema layer (`src/schema/`) — and can run in parallel worktrees. Group D
(0025 / 0027) both depend on 0024's dispatch but are disjoint — docs embed
pipeline vs `eval` — and can then run in parallel. Decisions
`0015-agent-cli-commands.md` and `0016-rule-semantics-feedback.md` cover this
batch.

Group E (0028 / 0029) address issues #32–#35. They share `form-schema.ts`,
the JSON Schema regen, and embedded docs, so they merge sequentially rather
than in isolated worktrees, but carry no logical dependency (order is free).
0030 depends on 0029's shared URL-policy helper. Decisions
`0017-robots-meta.md` and `0018-links-and-url-policy.md` cover this batch.

Fragment/host-integration batch (#36–#38): 0031 is the foundation — it makes
the runtime root-element-scoped (`initForm(root)`), the prerequisite for all
three. Group F (0032 / 0033) then run in parallel worktrees — disjoint scopes
(`styles.ts` vs `submit.ts`). 0034 (`--fragment`) integrates all three and
shares `generate/index.ts` + CLI + schema, so it lands last, sequentially.
Decisions `0019-runtime-scoping-model.md`, `0020-css-scoping-and-theme-api.md`,
and `0021-submit-events.md` cover this batch.
