# 0015: Agent-oriented CLI command system

Date: 2026-07-19
Status: accepted

## Context

The primary operator of this CLI is increasingly an AI agent, not a human at a
terminal. An agent's loop is "write YAML → check → fix → generate": it repairs
mistakes from error output alone (it does not open a browser), it parses
stdout, and it usually runs via `npx`/binary without the repository — so
`docs/reference.md` is not on hand. The single-command CLI
(`yaml-form <input> [-o out]`) gives no way to check without generating, no
machine-readable output, and no offline access to format knowledge.

## Decision

Restructure the CLI around subcommands:

- `yaml-form generate <input.yaml|-> [-o <out>] [--json]` — current behavior,
  named. The bare `yaml-form <input.yaml>` form is **dropped** (pre-1.0, no
  users yet — no compatibility constraint); it exits with a usage error
  hinting at `generate`, keeping dispatch unambiguous.
- `yaml-form validate <input.yaml|-> [--json]` — parse + all cross-checks,
  no HTML output.
- `yaml-form eval <input.yaml|-> --answers <json>` — headless `visible_when`
  evaluation (see decision 0016).
- `yaml-form schema` — print the JSON Schema to stdout (embedded at build
  time).
- `yaml-form docs [<topic>]` — print reference documentation to stdout,
  embedded at build time from `docs/reference.md` (single source; no
  hand-maintained copy).
- `yaml-form example [<name>]` — print a runnable example YAML.
- `yaml-form upgrade [--dry-run]` — unchanged.

Cross-cutting conventions:

- **`--json`** on commands that report success/failure emits one structured
  JSON object on stdout: `{"ok":true,...}` or
  `{"ok":false,"errors":[FormError,...]}` reusing the existing
  `{code, path, message}` shape. Validation reports **all** errors in one run,
  not just the first (already the parser's behavior — preserve it).
- **Exit codes**: `0` success, `1` operation failed (validation, generation,
  eval, upgrade), `2` usage error. Documented in `--help`.
- **help vs docs split**: `--help` is complete for *CLI operation* (every
  subcommand, flag, exit code, stdin/stdout conventions) and fits one screen;
  *YAML format knowledge* lives behind `yaml-form docs` with a one-line
  pointer from `--help`. Format knowledge is never duplicated into help text.
- **Non-interactive**: no prompts, ever; `-` reads stdin; omitted `-o` writes
  stdout (unchanged).

## Consequences

- Agents can validate cheaply before generating, self-correct from structured
  errors, and retrieve schema/docs/examples offline instead of guessing the
  format.
- `docs/reference.md` becomes a build input (embedded like the runtime bundle
  via a `scripts/build-*.ts` step); doc edits require a rebuild to reach the
  embedded copy — acceptable, `bun run check` already runs build steps.
- Deferred, not rejected: an `inspect` command (normalized form / payload
  shape / rule dependency graph as JSON), YAML line/column numbers in errors
  (needs source-position tracking through parsing), and agent-detection
  defaults for `--json`.
