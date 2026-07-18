# Task 0009: Distribution & upgrade

Status: todo
Depends on: 0008
Parallel: no (release plumbing)

## Goal

One version tag publishes the npm package and per-platform binaries, and
`yaml-form upgrade` replaces a binary install with the latest release.

## Context

- Relevant decisions: `decisions/0001-distribution.md`
- Open point from that decision: repository/releases visibility (or token) —
  resolve before first release and record the outcome.

## Scope

- `bun build --compile` matrix (linux x64/arm64, macOS x64/arm64, windows
  x64) in a release GitHub Actions workflow; attach to GitHub Releases; npm
  publish from the same tag.
- `upgrade` subcommand: detect binary vs npm install (npm → print the package
  manager command instead), fetch latest release, verify (checksum), replace
  self atomically.
- `generator` string in the payload picks up the release version.

## Out of scope

- Auto-update checks on normal runs.

## TDD plan

1. **Red** — tests for upgrade logic with a mocked release API: version
   compare, platform asset selection, npm-install detection, checksum
   mismatch abort.
2. **Green** — implement; keep network/file-replace behind interfaces for
   testability.
3. **Refactor** — dry-run flag for CI smoke tests.

## Acceptance criteria

- [ ] Tag push produces npm package + release binaries via CI
- [ ] `yaml-form upgrade` upgrades a binary install; refuses safely on npm
      installs and on checksum mismatch
- [ ] `bun test` and `bun run typecheck` pass

## Verification

- `bun test tests/upgrade`
- Manual: run a compiled binary from a test release, `upgrade`, `--version`.
