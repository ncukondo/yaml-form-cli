# Decisions

Records of design and process decisions for yaml-form-cli, one file per
decision, numbered in the order they were made. These are the source of truth
for *why* things are the way they are; the user-facing *what* lives in
[`docs/`](../docs/) and the code.

Format per file: `Date`, `Status` (accepted / superseded by NNNN), `Context`,
`Decision`, `Consequences`. Keep records short; link to them from task files
instead of restating them.

## Index

| # | Decision |
| - | -------- |
| [0001](0001-distribution.md) | Distribution: npm package + single-file executable with `upgrade` |
| [0002](0002-actions.md) | Typed submit actions (`log` / `post` / `mailto`) and result handling |
| [0003](0003-item-ids-required.md) | `id` is required on every item |
| [0004](0004-choice-table.md) | `choice_table` structure: rows = questions, columns = scale |
| [0005](0005-rubric.md) | `rubric` = `choice_table` + per-cell descriptors |
| [0006](0006-visible-when.md) | `visible_when` rule engine, answer flattening, rule-key validation |
| [0007](0007-submit-payload.md) | Submit payload shape |
| [0008](0008-json-schema.md) | Publish a JSON Schema for the YAML format |
| [0009](0009-development-process.md) | Development process: decisions/tasks dirs, TDD, parallel worktrees |
| [0010](0010-i18n.md) | i18n: `lang` + built-in bundles (`en`/`ja`) + `messages` overrides |
| [0011](0011-input-types.md) | `input_type` / `autocomplete` fields on short_text |
| [0012](0012-mobile-wide-tables.md) | Mobile layout for many-column choice_tables |
| [0013](0013-url-prefill.md) | URL-parameter prefill and constant overrides |
| [0014](0014-draft-autosave.md) | Draft autosave to localStorage |
| [0015](0015-agent-cli-commands.md) | Agent-oriented CLI: subcommands, `--json`, exit codes, help/docs split |
| [0016](0016-rule-semantics-feedback.md) | `visible_when` semantics: value-domain check + headless `eval` |
| [0017](0017-robots-meta.md) | `robots` meta: `noindex, nofollow` by default, per-directive opt-out |
| [0018](0018-links-and-url-policy.md) | Links & URL policy: structured `links`, relative autolink, `post` relative URLs |
| [0019](0019-runtime-scoping-model.md) | Runtime scoping: root-element-scoped runtime, `--fragment` requires `id` |
| [0020](0020-css-scoping-and-theme-api.md) | CSS scoping under `.yaml-form-root`, host-CSS `--yf-*` theme knobs |
| [0021](0021-submit-events.md) | Submit-completion `CustomEvent`s on the root element |

## Archive

[`archive/SPEC.md`](archive/SPEC.md) — the original specification document,
archived once its content was migrated to `docs/` and this directory.
