# Loredeck grounding eval fixtures

A labelled test set for the Loredeck Builder grounding checks (spec `docs/superpowers/specs/2026-10-08-loredeck-builder-multi-agent-design.md`, §5). It answers two questions:

- Does `ground check` flag every structural grounding error? This is deterministic and runs in CI.
- How often does the grounding checker (the `grounding-verify` brief) catch a claim its cited facts don't back, and how often does it flag a correct card? This needs a model, so it is a manual, opt-in run. Its false-alarm rate decides when checker findings can block a gate (spec O2).

## Files

| File | What it is |
| --- | --- |
| `evidence/chapters/book-1.json` | A small invented canon (the Founding Trilogy, Book 1): records `canon-ch-01`, `-07`, `-14`, `-22` (accepted) and `canon-ch-30` (left pending), three facts each. |
| `timeline.json`, `tags.json` | The deck's registries. The cards' `context` gates use the timeline's anchors. |
| `scope-brief.md` | A complete scope brief, so brief rendering never stops on a starter brief. |

The project the fixtures build is `founding-trilogy` (title "The Founding Trilogy", one deck `founding-trilogy`). Nothing a checker reads (the scope brief, timeline, tags, evidence provenance, project title or card text) says "eval", "test" or "fixture"; the CI test enforces this.
| `cases.json` | The labelled cases. |
| `variant-b-addendum.md` | The "common mistakes" list appended to every brief in variant b. |

Each case in `cases.json` is:

```json
{
  "id": "timing-brask-dead-from-patrol",
  "label": "control | seeded",
  "kind": "structural | semantic",
  "errorClass": "none | in-universe-span | wrong-timing-gate | wrong-record | unsupported-fact | embellished-injection | <ground-check problem code>",
  "expectGroundCheck": "pass | <problem code from tools/loredeck/lib/grounding.mjs>",
  "expectVerdict": "entailed | partial | unsupported | timing-mismatch",
  "acceptVerdicts": ["optional: verdicts also scored as exact; defaults to [expectVerdict]"],
  "card": { "...": "one complete v3 card" },
  "note": "what was planted, and where the truth is in the evidence"
}
```

- **Controls** (`label: control`) are correct cards. `ground check` passes them and the expected verdict is `entailed`. Every word of a control's `content.fact` and `content.injection` is stated in the facts it cites, its window neither opens before nor runs the asserted state past what those facts support, and a `public` control mentions no later event.
- **`acceptVerdicts`** (optional, seeded cases only) lists every verdict that counts as exact when two readings are defensible; it must include `expectVerdict` and never `entailed`. `unsupported-sethe-daughter` and `wrong-record-brask-death` accept `unsupported` or `partial`, because a checker can fairly read part of the claim (the apprenticeship, the patrol sergeant) as backed.
- **Structural** cases (`kind: structural`) each break one pointer rule: missing `evidenceFacts`, an out-of-range index, a pointer outside `evidenceRefs`, an unaccepted record, or a malformed pointer. `ground check` must report exactly `expectGroundCheck` for them. The model layer skips them.
- **Semantic** cases (`label: seeded`, `kind: semantic`) pass `ground check` but are wrong in meaning. They cover a detail taken from a record's `inUniverseSpan`, a `context` gate that opens at the wrong anchor, a pointer to a fact from a different record, an invented fact, and an embellished `content.injection`.

Each case's card is written to its own entry file, `drafts/founding-trilogy/entries/<handle>.json`, where `<handle>` is an opaque `card-<8 hex>` derived from the case id (`caseHandle` in `tools/scripts/loredeck-grounding-eval-lib.mjs`). Case ids name the planted error, so they must never reach a checker: entry files, briefs and findings files all use the handle. Every ground-check issue (`batch: entries/<handle>`) and every findings file still maps to exactly one case; the model layer's `manifest.json` records the mapping, in a results directory outside the workshop tree (see below). Card ids and titles are neutral for the same reason.

When you add a case, keep one planted error per card, write the `note`, and run `node tools/scripts/test-loredeck-grounding-eval.mjs`. That test also checks the labelling rules above.

## Automated layer (CI)

```sh
node tools/scripts/test-loredeck-grounding-eval.mjs
```

The test builds the project through the CLI under `.tmp/test-loredeck-grounding-eval`, runs `ground check --stage cards --json`, and asserts:

- every case with `expectGroundCheck: "pass"` has no issue
- every structural case has exactly its expected problem code

It also unit-tests the scorer on synthetic findings. It is part of the CLI test plan in `.github/workflows/loredeck-builder-build-check.yml`.

## Model layer (manual, opt-in)

Run it whenever `agents/grounding-verify.md`, the checker's agent file, or the model changes. Use one run per template variant.

1. **Prepare.**

   ```sh
   node tools/scripts/loredeck-grounding-eval-model.mjs --prepare --variant a
   ```

   Everything is built outside the repo, so a checker that browses the project cannot walk up to `cases.json`. `<dir>` is `$LOREDECK_GROUNDING_EVAL_DIR`, or `<os.tmpdir()>/loredeck-grounding-eval` when it is unset. This builds the project under `<dir>/workshop`. Then, for each case that passes `ground check` (16 cases: 5 controls and 11 seeded), it renders `brief founding-trilogy --role grounding-verify --deck founding-trilogy --file entries/<handle>` to `<dir>/briefs/<handle>.md`. The manifest (`<handle>` to case id) goes to `<dir>-results/manifest.json`, a sibling of `<dir>`, never inside the workshop tree. Variant `a` uses the current template unchanged. Variant `b` appends `variant-b-addendum.md`, which names the anti-patterns without changing any verdict rule. Preparing again rebuilds the project and deletes earlier findings, so score one variant before you prepare the next.

   Briefs name files by absolute path, so the default `<dir>` puts the words `loredeck-grounding-eval` in every brief. For a run whose briefs say nothing about testing, set `LOREDECK_GROUNDING_EVAL_DIR` to a neutral path, for example `$TMPDIR/founding-trilogy`.

2. **Dispatch.** For each brief, start one fresh grounding checker and pass the brief text through unchanged. Use the `loredeck-grounding-verifier` agent in Claude Code, or any subagent with Read and Write. Give it nothing else: no case labels, no notes, and nothing from `cases.json`. Each checker writes `reviews/audit/grounding.founding-trilogy.cards.entries.<handle>.json` in the project. The checkers are independent, so you can run them in parallel.

3. **Score.**

   ```sh
   node tools/scripts/loredeck-grounding-eval-model.mjs --score
   ```

   This prints a per-case table, the metrics table, and the full score JSON. It also saves the JSON to `<dir>-results/score.<variant>.json`. Use `--json` to print only the JSON. The exit code is 0 only when every case ran and both targets are met.

4. **Repeat for variant b.**

5. **Record** both variants' numbers, plus the date, model, and commit, in spec §5.1.

### Report format

| Metric | Definition | Target |
| --- | --- | --- |
| Catch rate | seeded semantic cases whose verdict is not `entailed` ÷ seeded semantic cases that ran | ≥ 85% |
| False-alarm rate | controls whose verdict is not `entailed` ÷ controls that ran | ≤ 10% |
| Exact-verdict accuracy | cases whose verdict is in `acceptVerdicts` (default `[expectVerdict]`) ÷ cases that ran | reported only |

The per-case table shows each case's accepted set in its **Accepted** column. `acceptVerdicts` affects only exact-verdict accuracy; catch rate counts any verdict other than `entailed`.

The JSON also breaks results down by `errorClass`.

A missing findings file is reported as **not run**, and it stays out of every denominator. A findings file that doesn't parse, has no finding whose `ref` is the card's `id`, or uses an unknown verdict is **invalid**. Either one makes the result `incomplete`, not `fail`. The result is `pass` only when all 16 cases ran and both targets are met.

With 5 controls, a single false alarm is 20%, which misses the 10% target. Run each variant at least twice before you draw a conclusion, and record every run.
