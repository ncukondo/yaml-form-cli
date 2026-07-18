# yaml-form-cli

A CLI tool that generates a **single self-contained HTML form** from a YAML
definition. The generated HTML inlines all CSS/JS, works offline (including
`file://`), and handles rendering, validation, conditional visibility, and
submit actions entirely client-side.

> **Status: specification phase.** See [docs/SPEC.md](docs/SPEC.md) for the
> draft specification and open questions. Implementation has not started yet.

## Example

See [examples/sample.yaml](examples/sample.yaml) for a full-featured form
definition, including:

- Basic items: `constant`, `short_text`, `long_text`, `choice`, `choice_table`
- A `rubric` item type (levels × criteria with per-cell descriptors)
- Conditional visibility via `visible_when`
  ([@ncukondo/dynamic-form-rules](https://github.com/ncukondo/dynamic-form-rules) syntax)
- Submit actions (`log:`, `mailto:`, `https://`)

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

## Related projects

- [flexible-form](https://github.com/ncukondo/flexible-form) — Next.js form
  builder this YAML schema originates from
- [@ncukondo/dynamic-form-rules](https://github.com/ncukondo/dynamic-form-rules)
  — rule engine used for `visible_when`
