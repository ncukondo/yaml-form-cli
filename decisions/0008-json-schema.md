# 0008: Publish a JSON Schema for the YAML format

Date: 2026-07-18
Status: accepted

## Context

Form authors write YAML by hand; editor completion and validation
(yaml-language-server) need a JSON Schema. A schema also prevents drift
between docs and the actual accepted format.

## Decision

- Ship a JSON Schema for the form YAML, generated from the same runtime
  validation source (single source of truth — no hand-maintained duplicate).
- Reference it from example YAML files via a
  `# yaml-language-server: $schema=…` comment so editors pick it up.
- Constraints the schema cannot express (unique ids, descriptor counts,
  rule-key existence, `multiple` forbidden on rubric) remain generation-time
  checks in the CLI.

## Consequences

- The validation library must support JSON Schema export (influences library
  choice in task 0002).
- The schema file is a published artifact; its path/URL must stay stable
  across releases.
