# Loredeck Builder: Multi-Agent Verification and Delegation Spec

Date: 2026-10-08
Status: Proposed
Scope: `.claude/skills/loredeck-builder/`, `tools/loredeck/`, `plugins/loredeck-builder/`

## 1. Summary

The skill's core design (orchestrator with single-threaded writes, file-based handoff, CLI-owned state, user gates, strict Pack Health) already follows current multi-agent practice. Two gaps remain, and the commit history shows both causing real failures:

1. **Grounding is checked only by the agent that wrote the claim.** Commits `14efe44` and `a43a5c3` added rules like "spot-check every claim against its cited facts". The orchestrator that drafted or merged a card is the one asked to check it, and the CLI cannot tell a cited claim from a grounded one (`report --stage cards` checks only that `evidenceRefs` resolve).
2. **Subagent briefs are written by hand, each time, by the orchestrator.** Commit `9c9d527` shows the results: abbreviated schemas produced `encounters[]` instead of `records[]`, a subagent wrote to `tags.json`, and a multi-file task returned null. The current fixes are prose rules ("paste verbatim, in full, every prompt"), which depend on the orchestrator following them.

Proposal: add **one deterministic CLI layer** (rendered briefs, fact-level grounding check, return contract) and **two read-only verifier roles** (evidence auditor, grounding verifier). Each verifier runs in a clean context at a stage boundary. The user-gated loop is unchanged. Gates get a verifier report attached.

## 2. Research basis

| Finding | Source | Implication here |
| --- | --- | --- |
| Hallucinations change form at each pipeline stage (fact → derived → narrative → invisible). Per-boundary escape rates were 24.6% → 48.3% → 89.3%. Boundary gates cut survival from 58.4% to 16.2%. Checking only at the end improved on no checking by 2.3 pp. | *The Hallucination Snowball*, arXiv 2608.14588 | Evidence → titles → cards is the same chain. The cheapest catch point is evidence → titles. Pack Health at the end can't catch grounding errors. |
| Generator/verifier loops work best when "the coding and review agents do not share any context beforehand". Writes stay single-threaded and extra agents add analysis. | Cognition, *Multi-Agents: What's Actually Working* (2026) | Verifiers must be fresh-context and read-only. The orchestrator stays the only writer, as today. |
| A dedicated CitationAgent attributes claims after drafting. Subagents write to storage and return lightweight references. Delegation needs an objective, an output format, tools, and boundaries. Effort scaling must be explicit. Start evals with ~20 real cases. | Anthropic, *How we built our multi-agent research system* | Add a grounding pass and a fixed return contract. Render briefs from templates. Seed a small eval set. |
| Read-heavy multi-agent systems are easier than write-heavy ones. | LangChain, *How and when to build multi-agent systems* | Research and verification fan out. Drafting fan-out stays narrow and merged by one writer. |
| Structure helps where the model reads. Prose helps where it writes. Naming a forbidden construction in the prompt concentrated defects: 96% of surviving defects were the two named forms. | *Structure for Reading, Prose for Writing*, arXiv 2608.20786 | Briefs should state the positive shape (the verbatim template) and avoid naming anti-examples like `encounters[]` to subagents. Keep the anti-examples in orchestrator docs. This is a single study, so treat it as a hypothesis to test in evals. |
| Subagents support `tools` allowlists, `model`, `maxTurns`, and `skills` preload. Plugins ship agents in `agents/`. | Claude Code subagents docs | Verifier roles can be tool-restricted (Read/Grep, no Write). The `.skill` bundle can't install agents, so the portable path is CLI-rendered briefs. |

## 3. Changes

### 3.1 CLI: `brief` — rendered subagent prompts (process + tooling)

`loredeck brief <id> --role research|draft|evidence-audit|grounding-verify --deck D [--scope S | --batch B] [--out FILE]`

- Renders a complete, self-contained prompt from templates in `.claude/skills/loredeck-builder/agents/<role>.md`, filling in values from project state:
  - scope brief excerpt
  - verbatim `templates/evidence-file.json` or title batch
  - registry paths
  - output path
  - return contract (§3.3)
- Output is deterministic for a given project state. The orchestrator passes it through unchanged, optionally adding a short task note.
- The orchestrator no longer re-types schemas or rules, so the `9c9d527` drift becomes impossible to reproduce by construction.
- Templates state required shapes positively. Anti-pattern lists stay in `references/` for the orchestrator only (§2, last-but-one row).
- Portable: works in Claude Code, Cowork, and non-Claude runtimes (the DeepSeek sessions in `9c9d527`), because it's just text.

### 3.2 Fact-level grounding anchors + `ground check` (structural)

- Title batch entries and cards gain fact-level support pointers: `support: ["<scope>/<recordId>#<factIndex>", ...]`.
  - Titles: a new field in `templates/title-batch.json`.
  - Cards: a workshop sidecar `drafts/<deck>/.grounding/<file>.json` mapping card id → support. It's kept out of the shipped deck so no schema change is needed. *Open question O1: put it in `sourceInfo` instead.*
- `loredeck ground check <id> [--deck D] [--stage titles|cards]` fails on:
  - a missing support pointer
  - a pointer to an unaccepted record or an out-of-range fact index
  - a support record not listed in `evidenceRefs`
- `report --stage titles|cards` inlines each claim next to the fact strings it points to. Reviewers (user and verifier) then compare text side by side instead of opening evidence files.
- This turns "did you cite a fact?" into a mechanical check. "Does the fact entail the claim?" stays a judgment call, and §3.4 handles it.

### 3.3 Return contract (process)

Every subagent's final message is one JSON object and nothing else:

```json
{ "status": "ok|partial|failed", "wrote": ["path"], "counts": { "records": 0 }, "gaps": ["..."], "flags": ["missing-tag:character:x"] }
```

- The orchestrator reads files from disk and never re-ingests drafted content from chat. This is the Anthropic "lightweight reference" pattern, and it keeps the orchestrator's context small on large families.
- `partial`/`failed` plus `gaps` replace today's silent null returns. With one file per subagent, a `failed` return means re-dispatching just that one file.

### 3.4 New roles (structural)

Both roles are read-only. Neither may edit files. Each returns a findings file through the contract above, and the orchestrator decides what to fix.

**A. Evidence auditor** (Stage 2, after `evidence validate`, before the evidence gate)

- Input: one evidence file, plus the source slice or provenance URL it came from.
- Checks:
  - Each fact is supported by the source text.
  - Contested items are marked as contested.
  - Nothing falls outside the continuity boundary.
  - The file doesn't reveal truncation (`fetch_fandom.py` 3,000-char cap) or PDF extraction noise.
- Output: `reviews/audit/evidence-<scope>.json`, a list of `{recordId, factIndex, verdict: supported|unsupported|contested|out-of-scope, note}`.
- Placement: this is the S1→S2 boundary, where the Snowball data says most errors are still catchable.

**B. Grounding verifier** (Stage 4, per title batch; Stage 5, per card batch)

- Input: the batch file and the evidence files it cites. It gets no drafting history and no orchestrator summary.
- Check: does each `gateIntent`, `content.fact`, or `content.injection` follow from its `support` facts, and do the context/reveal gates match the timing those facts describe?
- Output: `reviews/audit/<deck>-<kind>-<batch>.json`. Verdicts are `entailed|partial|unsupported|timing-mismatch`.
- `report` summarizes verifier findings at the top of the gate artifact. The user sees "N claims verified, M flagged (fixed / open)".

Both roles run on **Claude Code** through `.claude/agents/loredeck-evidence-auditor.md` and `.claude/agents/loredeck-grounding-verifier.md`:

- `tools: Read, Grep, Glob` (evidence auditor also gets `WebFetch`)
- `model: inherit`
- `maxTurns` sized to file count

Other runtimes use `brief --role ...` with a generic subagent. The plugin build copies the agent files when it's built as a plugin. The `.skill` bundle relies on `brief`.

### 3.5 Effort scaling table (process)

Replace the prose in `canon-sizing.md` / `subagent-playbook.md` with an explicit table:

| Size | Research agents | Drafting agents | Evidence audit | Grounding verify |
| --- | --- | --- | --- | --- |
| Single (≤150 cards) | 0 (orchestrator) | 0 | 1 per evidence file, or 1 combined | 1 per titles gate + 1 per card batch |
| Core + eras | 1 per scope (optional) | 0–1 per deck | 1 per evidence file | 1 per batch |
| Franchise | 1 per scope per deck | 1 per batch | 1 per evidence file | 1 per batch, run in parallel with next drafting wave |

The verifier always runs, even for single decks. Grounding is the most frequent failure class, and the check is cheap relative to a user re-review.

### 3.6 Orchestrator rule changes (SKILL.md)

- Rule 2 gains: "A claim is ready when `ground check` passes and the grounding verifier has no open `unsupported`/`timing-mismatch` findings."
- Stage 2/4/5 text replaces "spot-check yourself" with "run the auditor/verifier; resolve findings; then spot-check a sample".
- Subagent playbook: replace the hand-written prompt guidance with "use `brief`". Keep the failure-mode history as orchestrator-only rationale.

## 4. Expected impact (estimates — no baseline is measured today)

| Metric | Today | Expected | Basis |
| --- | --- | --- | --- |
| Subagent structural drift (wrong top-level keys, tag registry writes) | Recurring (`9c9d527`) | ~0 | Rendered briefs + read-only registries + validate on return. Deterministic. |
| Silent null subagent returns | Recurring | Replaced by explicit `partial/failed` + targeted retry | Return contract |
| Ungrounded claims reaching the user gate | Unknown. Recurring enough to warrant two commits. | **−50 to −70%** | Snowball boundary-gating result (58→16% survival), discounted for the user gate that already exists and for verifier misses |
| Claims missing fact-level support | Undetectable | 0 at gate (mechanical) | `ground check` |
| User review time per titles/cards gate | Full manual comparison | Lower: side-by-side claim/fact view + pre-triaged flags | §3.2 report change. Not quantified. |
| Token cost per deck | Baseline | **+20 to +35%** | One verifier read per batch ≈ batch + cited evidence. Auditor ≈ one evidence file + source slice. |
| Orchestrator context use on families | Grows with pasted content | Lower | Return contract; no re-ingest |

Overall: a **moderate-to-large quality improvement** on the most frequent failure class (grounding), for about a quarter more tokens. Workflow shape and user gates don't change. The biggest single lever is §3.4B plus §3.2. §3.1 and §3.3 are cheap reliability fixes.

## 5. Measurement

Add `tools/scripts/test-loredeck-grounding-eval.mjs` with fixtures under `tools/scripts/fixtures/loredeck-grounding/`:

- A ~20-case seeded set (per the Anthropic guidance), built from an accepted evidence fixture and a clean card batch.
- Cases mutate one claim each:
  - unsupported fact
  - claim drawn from `inUniverseSpan`
  - wrong timing gate
  - fact from a different record
  - a correct control
- Deterministic part (CI): `ground check` must flag every structural case.
- Model part (manual / opt-in): the verifier brief is run against the fixtures. Report catch rate and false-positive rate. Ship target: ≥85% catch, ≤10% false positives on controls.
- Re-run on brief template changes. This also tests the "don't name anti-examples" hypothesis (§2) by A/B-ing two template variants.

## 6. Non-goals

- No parallel writers to the same deck, and no agent-to-agent negotiation. Writes stay with the orchestrator (Cognition/LangChain).
- No change to user gates, `project.json` ownership, or strict-Pack-Health release bar.
- No LLM grounding check inside the CLI. The CLI stays deterministic and offline.

## 7. Implementation order

1. Return contract + `brief` command + `agents/*.md` templates (research, draft). Update playbook. *(Small. Removes known drift.)*
2. `support` pointers in title batch template, `.grounding` sidecar, `ground check`, report side-by-side view, tests.
3. Grounding verifier role (template + `.claude/agents` file), wired into Stages 4–5 and `report`.
4. Evidence auditor role, wired into Stage 2.
5. Eval fixtures + script. Plugin sync copies `agents/` templates and `.claude/agents` files. Bundle test asserts their presence.

## 8. Open questions

- **O1:** Should the grounding sidecar go in `sourceInfo.evidenceFacts` instead, so support survives into shipped decks and in-app review? This needs a schema-doc addition and a check that health ignores it.
- **O2:** Should verifier `unsupported` findings block `gate approve` (CLI-enforced), or only be surfaced? Recommendation: surface in v1, block in v2 once false-positive rate is known.
- **O3:** Should verifiers use a different model than the drafter for diversity? Default to `inherit`, and revisit with eval data.

## Sources

- Anthropic, How we built our multi-agent research system — https://www.anthropic.com/engineering/multi-agent-research-system
- Cognition, Multi-Agents: What's Actually Working — https://cognition.com/blog/multi-agents-working
- Cognition, Don't Build Multi-Agents — https://cognition.com/blog/dont-build-multi-agents
- LangChain, How and when to build multi-agent systems — https://blog.langchain.com/how-and-when-to-build-multi-agent-systems
- The Hallucination Snowball (arXiv 2608.14588) — https://arxiv.org/abs/2608.14588
- Structure for Reading, Prose for Writing (arXiv 2608.20786) — https://arxiv.org/abs/2608.20786
- Claude Code subagents docs — https://code.claude.com/docs/en/sub-agents
