# yaml-form-cli

A CLI tool that generates a **single self-contained HTML form** from a YAML
definition. The generated HTML inlines all CSS/JS, works offline (including
`file://`), and handles rendering, validation, conditional visibility, and
submit actions entirely client-side.

> **Status: spec fixed, implementation starting.** The full format and CLI
> reference is in [docs/reference.md](docs/reference.md). Design decisions are
> recorded in [decisions/](decisions/), and the implementation plan in
> [tasks/](tasks/).

## Example

See [examples/sample.yaml](examples/sample.yaml) for a full-featured form
definition, including:

- Basic items: `constant`, `short_text`, `long_text`, `choice`
- `choice_table` (questions as rows sharing one scale) and `rubric`
  (a choice_table with per-cell descriptor text)
- Conditional visibility via `visible_when`
  ([@ncukondo/dynamic-form-rules](https://github.com/ncukondo/dynamic-form-rules) syntax)
- Submit actions (`log`, `post`, `mailto`)

## Planned usage

```sh
yaml-form form.yaml -o form.html
```

## Development

Toolchain: [Bun](https://bun.sh) + TypeScript.

```sh
bun install
bun test
```

Process: TDD per task file in [tasks/](tasks/) (template included); decisions
go in [decisions/](decisions/); parallel-safe tasks are developed in separate
git worktrees. See [decisions/0009-development-process.md](decisions/0009-development-process.md).

## Related projects

- [flexible-form](https://github.com/ncukondo/flexible-form) — Next.js form
  builder this YAML schema originates from
- [@ncukondo/dynamic-form-rules](https://github.com/ncukondo/dynamic-form-rules)
  — rule engine used for `visible_when`
