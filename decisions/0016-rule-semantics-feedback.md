# 0016: `visible_when` semantic feedback — value-domain check and `eval`

Date: 2026-07-19
Status: accepted

## Context

Generation-time validation (decision 0006) catches rule syntax errors and
unknown keys, but not *semantic* mistakes: comparing against a value no
choice can produce (`role = "Student"` when the value is `student`), or plain
logic errors (wrong operator/combination). An agent never opens the generated
HTML, so today these mistakes reach respondents undetected.

## Decision

Two layers:

1. **Static value-domain check** (extends decision 0006's rule validation).
   For every rule comparison whose referenced key derives from a
   `choice` / `choice_table` / `rubric` item, the compared literal(s) —
   including members of `in [...]` lists — must be within that item's choice
   values. Violations are generation **errors** (code
   `rule_value_unreachable`), consistent with unknown-key handling: an
   unreachable comparison makes the rule constant, which is always a bug.
   Keys with free-text domains (`short_text`, `long_text`, `.comment`
   sub-keys) and regex operators are exempt.

2. **Headless evaluation**: `yaml-form eval <input.yaml|-> --answers <json>`
   prints the visibility of every item for the given answers as JSON
   (`{"ok":true,"visible":{"<item_id>":bool,...}}`). Answers use the same
   nested raw shape the browser produces (flattened internally via
   `flattenAnswers`). The command reuses `src/runtime/visibility.ts` — the
   exact code bundled into the generated HTML — so CLI results are
   evaluation-faithful by construction, with no separate simulator to drift.

Error messages for `rule_value_unreachable` name the actual choice values and
point at `yaml-form eval` for behavioral verification, steering agents into
the test loop.

## Consequences

- Value typos, case mismatches, and `title`-vs-`value` confusion fail at
  generation time with self-correctable messages.
- Logic correctness becomes testable without a browser: an agent asserts
  "with answers X, item Y is visible" the same way it writes unit tests.
- `src/runtime/visibility.ts` gains a second consumer (CLI); it must stay
  free of browser-only APIs (already true — enforced by its use in tests).
