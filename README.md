# yaml-form

Generate a **single self-contained HTML form** from a YAML definition. The
generated HTML inlines all CSS/JS, works offline (including `file://`), and
handles rendering, required validation, conditional visibility, and submit
actions entirely client-side — no server needed to host the form.

```sh
bunx @ncukondo/yaml-form generate form.yaml -o form.html
# or
npx @ncukondo/yaml-form generate form.yaml -o form.html
```

## Install

- **No install** — `bunx @ncukondo/yaml-form` / `npx @ncukondo/yaml-form`
- **Global** — `npm install -g @ncukondo/yaml-form` (upgrade via npm)
- **Single-file binary** (linux/macOS x64 & arm64, windows x64; no runtime
  needed; upgrade later with `yaml-form upgrade`):

  ```sh
  # Linux / macOS
  curl -fsSL https://raw.githubusercontent.com/ncukondo/yaml-form-cli/main/install.sh | bash
  ```

  ```powershell
  # Windows (PowerShell)
  irm https://raw.githubusercontent.com/ncukondo/yaml-form-cli/main/install.ps1 | iex
  ```

  The installer downloads the binary for your platform from
  [GitHub Releases](https://github.com/ncukondo/yaml-form-cli/releases),
  verifies its SHA-256 checksum, and adds it to your PATH. Set
  `YAML_FORM_VERSION=v0.x.x` to pin a version or `YAML_FORM_INSTALL_DIR`
  to change the destination (default: `~/.local/bin`, Windows:
  `%LOCALAPPDATA%\yaml-form`).

## Usage

```
yaml-form generate <input.yaml|-> [-o <out.html>] [--json]
yaml-form validate <input.yaml|-> [--json]
yaml-form eval <input.yaml|-> --answers <json|@file|->
yaml-form schema
yaml-form docs [<topic>]
yaml-form example [<name>]
yaml-form upgrade [--dry-run]
```

- `generate` writes the HTML form (stdout by default, `-o` to a file).
- `validate` parses and cross-checks only, reporting every problem at once.
- `eval` prints each item's `visible_when` result for a set of answers,
  computed by the same code the generated form runs — a browser-free way to
  test conditional visibility.
- `schema` / `docs` / `example` print the format's JSON Schema, field
  reference, and a runnable sample; they work offline so an `npx` or binary
  install is self-documenting.
- Input `-` reads YAML from stdin; `--json` makes a command emit a single
  `{"ok":...}` object. Exit codes: `0` success, `1` operation failed, `2`
  usage error. See `yaml-form --help` for the full contract.

## YAML definition

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/ncukondo/yaml-form-cli/main/schema/yaml-form.schema.json
title: "Session feedback"
actions:
  - type: post
    url: "https://example.com/api/submit"
post_submit:
  message: "Thank you!"
items:
  - type: short_text
    id: name
    title: "Your name"
    required: true

  - type: choice
    id: role
    title: "Your role"
    choices: [student, resident, faculty]

  - type: rubric
    id: talk_rubric
    title: "Rate the talk"
    choices:
      - { title: "Novice", value: "1" }
      - { title: "Expert", value: "2" }
    items:
      - id: clarity
        title: "Clarity"
        descriptors: ["Hard to follow", "Consistently clear"]

  - type: long_text
    id: clarity_advice
    title: "How could clarity improve?"
    visible_when: 'talk_rubric.clarity = "1"'
```

Item types: `constant`, `short_text`, `long_text`, `choice`, `choice_table`
(questions as rows sharing one scale), `rubric` (a choice_table with per-cell
descriptor text). Conditional visibility uses
[@ncukondo/dynamic-form-rules](https://github.com/ncukondo/dynamic-form-rules)
expressions; rule keys are validated at generation time, so typos fail fast.
Submit actions: `log` (console), `post` (JSON POST), `mailto`.

Opening a form with query parameters prefills matching fields
(`form.html?name=John&tags=a,b`). A `constant` item with `from_url: true`
(optionally `hidden: true`) turns that into per-respondent distribution
URLs whose identifier lands in the submit payload — if such URLs identify
respondents, disclose it to them.

Answers are autosaved to the browser's localStorage and restored when the
same URL is reopened (announced, discardable); a successful submit clears
the draft. Opt out with `autosave: false` — recommended for shared or kiosk
devices.

**Full reference:** [docs/reference.md](docs/reference.md) — every field,
answer shapes, the submit payload, and rule syntax.
**Complete example:** [examples/sample.yaml](examples/sample.yaml).
A JSON Schema ([schema/yaml-form.schema.json](schema/yaml-form.schema.json))
provides editor completion/validation via yaml-language-server.

## Development

Toolchain: [Bun](https://bun.sh) + TypeScript.

```sh
bun install
bun run check   # typecheck + lint + tests
```

Process: TDD per task file in [tasks/](tasks/); decisions are recorded in
[decisions/](decisions/); parallel-safe tasks are developed in separate git
worktrees. See
[decisions/0009-development-process.md](decisions/0009-development-process.md).

Releases: pushing a tag `vX.Y.Z` (matching `package.json`) builds per-platform
binaries, creates a GitHub release, and publishes to npm.

## Related projects

- [flexible-form](https://github.com/ncukondo/flexible-form) — Next.js form
  builder this YAML schema originates from
- [@ncukondo/dynamic-form-rules](https://github.com/ncukondo/dynamic-form-rules)
  — rule engine used for `visible_when`

## License

[MIT](LICENSE)
