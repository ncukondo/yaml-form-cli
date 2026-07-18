# yaml-form

Generate a **single self-contained HTML form** from a YAML definition. The
generated HTML inlines all CSS/JS, works offline (including `file://`), and
handles rendering, required validation, conditional visibility, and submit
actions entirely client-side — no server needed to host the form.

```sh
bunx @ncukondo/yaml-form form.yaml -o form.html
# or
npx @ncukondo/yaml-form form.yaml -o form.html
```

## Install

- **No install** — `bunx @ncukondo/yaml-form` / `npx @ncukondo/yaml-form`
- **Global** — `npm install -g @ncukondo/yaml-form` (upgrade via npm)
- **Single-file binary** — download for your platform from
  [GitHub Releases](https://github.com/ncukondo/yaml-form-cli/releases)
  (linux/macOS x64 & arm64, windows x64). Upgrade later with
  `yaml-form upgrade`.

## Usage

```
yaml-form <input.yaml> [-o <output.html>]

Options:
  -o, --output <file>   Write HTML to file (default: stdout)
  -h, --help            Show help
  --version             Show version

Subcommands:
  yaml-form upgrade [--dry-run]
                        Self-upgrade a binary install to the latest release
                        (npm installs: upgrade via your package manager)
```

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
