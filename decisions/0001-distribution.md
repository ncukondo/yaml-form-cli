# 0001: Distribution — npm package + single-file executable

Date: 2026-07-18
Status: accepted

## Context

Users may or may not have a JS runtime installed. We want zero-install usage
where possible and a simple upgrade path.

## Decision

Release both, from the same version tag:

- **npm package** — run via `bunx yaml-form` / `npx yaml-form`; upgraded
  through the package manager.
- **Single-file executable** — built with `bun build --compile` per platform,
  attached to GitHub Releases. `yaml-form upgrade` downloads the latest
  release and replaces the running binary.

## Consequences

- Automatic binary download requires the GitHub releases to be publicly
  reachable (or a token). Revisit repository visibility before first release.
- CI must build a per-platform binary matrix and publish npm + releases from
  one tag.
