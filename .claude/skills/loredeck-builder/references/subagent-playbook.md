# Subagent Playbook

Use subagents to parallelize large canons. The main session is the orchestrator: it owns all gates, project state writes, the cross-deck tag/timeline registries, merging, and dedupe. Subagents never call `gate approve`, `evidence accept/reject`, or edit `project.json`.

If your runtime has a task-tracking tool, use it to track every spawned subagent's status (dispatched/returned/merged) once a wave is more than a couple of subagents — it's the difference between noticing a subagent went silent and finding out three batches later that one never made it into `drafts/`.

## When to fan out

How many of each agent to dispatch is set by the table in `references/canon-sizing.md` § Agents per deck size. In short: research and drafting fan out only for larger canons, while the evidence checker and grounding checker run at every size.

## Sizing each subagent's task

**One output file per subagent, max.** A subagent asked to write multiple files in one prompt (e.g. evidence + a cast file + a places file) risks exhausting its tool-call budget partway through and returning nothing usable at all — the failure is all-or-nothing, not partial credit. Split multi-file work into one subagent per file, even if that means more subagents in the wave.

**Know your runtime's per-subagent tool-call budget before deciding paste-vs-read.** Some harnesses cap it low (a subagent that ran out of budget mid-task and returned nothing usable is what motivated the one-file rule above); others give subagents a generous, effectively unbounded budget. A budget that comfortably covers a handful of file reads plus the final write (roughly: number of cited evidence files + a couple) is enough to have drafting subagents read their own evidence instead of trusting a paste — see Drafting subagents below. If the budget is tight, fall back to pasting content verbatim instead.

## Research subagents

**Dispatch every research subagent with the prompt `brief` renders — never hand-write it.**

```
node tools/loredeck/loredeck-cli.mjs brief <id> --role research --deck D --scope S [--file F] [--assignment TEXT] [--out P]
```

Pass the output through unchanged; add at most a short task note after it (the source slice or URL list for this subagent, or a `deckId` to set). The rendered prompt already contains everything the subagent needs: the approved scope brief, `templates/evidence-file.json` verbatim, the authoringSignals vocabulary, the output path (`evidence/<scope>/<file>.json`, default file name = the scope), record ids already used in the scope, the source policy, the grounding rules, and the return contract below. The prompt is deterministic for a given project state, so re-rendering it for a retry gives the subagent the same instructions. Use `--file` to split one scope across several subagents (one file each, e.g. `--file chapters-01-05`), and always pair it with `--assignment` (e.g. `--assignment "chapters 1 to 5"`) so the prompt itself states the subagent's slice; without it the prompt assigns the whole scope. `brief` refuses to render while `brief/scope-brief.md` still has placeholder sections.

Role templates live in `agents/` (`research.md`, `evidence-audit.md`, plus the shared `_return-contract.md`). They state the required shapes positively and on purpose say nothing about past failures; keep it that way when editing them.

### Why the prompt is rendered (orchestrator-only rationale)

This history is for you, not for subagents — don't paste it into a brief. Naming a forbidden construction in a prompt tends to concentrate output on exactly that construction.

- **Schema drift from shortened prompts.** Subagents given the evidence schema as a prose description, or told to "use the standard format" after the first prompt or two, produced structurally different files — e.g. an `encounters[]` array instead of `records[]`. `brief` inlines the template word for word in every prompt, so the shape can't erode across a wave.
- **Filenames that contradict the top-level key.** An output file named after a word that isn't the JSON key (`encounters.json`) invited the model to rename the field to match the file. `brief` names the file after the scope (or your `--file` slug).
- **Writes outside the assignment.** A subagent wrote to `tags.json`. The rendered brief names exactly one output file as the subagent's whole deliverable; validate on return and discard anything else it touched.
- **Silent null returns.** A multi-file task exhausted its budget and returned nothing. One file per subagent plus the return contract turns this into an explicit `partial`/`failed` you can retry.
- **Facts from memory.** Facts must come from source text the subagent actually read; anything unclear goes to `failures` or is marked contested. The brief states this as the positive rule.

**For PDF (or other binary/encoded) sources, extract the full readable text yourself before fanning out — never make a research subagent page through the source itself.** Per-page extraction (e.g. looping `reader.pages[i].extract_text()`) burns one tool call per page; a source of any real length exhausts the subagent's budget before it reaches the file write, and the subagent returns nothing usable. Run the extraction once in the orchestrator (`references/evidence-pipeline.md` § PDF sources has the pypdf → pdftotext → pdfminer.six fallback chain), then hand each research subagent its assigned slice of plain text in the task note — not the PDF. This also means encryption/dependency failures (missing `cryptography`, unavailable `poppler-utils`) get hit once total instead of once per subagent.

On return: read the return object (below), run `evidence validate`, run the evidence checker on the file (next section), resolve its findings, spot-check a sample of records against provenance, and fix or regenerate weak files before presenting the evidence gate.

## Evidence checker subagents

One checker per evidence file, always in a fresh context — never the subagent (or session) that wrote the file. Render its prompt with:

```
node tools/loredeck/loredeck-cli.mjs brief <id> --role evidence-audit --deck D --scope S [--file F]
```

`--file` is the stem of an existing file in `evidence/<S>/` (default: the scope name); `brief` errors if it doesn't exist. On Claude Code, dispatch the `loredeck-evidence-auditor` agent (`.claude/agents/loredeck-evidence-auditor.md`, shipped in the plugin's `agents/`; the `.skill` bundle carries it under `claude-code-agents/`) with the rendered brief as its task — the agent file holds no instructions of its own. Other runtimes pass the brief to a generic subagent. For a `user_supplied` file, put the source text (or slice) the file was written from in the task note; for `web` files the checker re-reads `provenance.url`.

The checker is read-only: it writes only `reviews/audit/evidence-audit.<scope>[.<file>].json` and returns `counts` as `{"facts": N, "flagged": M}`. Discard anything else it touched. Its `flags[]` carry `truncated-source:<url>` (re-research from the full page) and `noisy-extraction:<file>` (re-extract the PDF per `references/evidence-pipeline.md` § PDF sources). Findings are advisory: you decide each fix, then the summary at the top of `reviews/evidence.md` shows the user what was flagged.

## Grounding checker (titles and cards)

After drafting a title batch, or merging a card batch, and getting `ground check` clean, dispatch one read-only checker per batch with the prompt from:

```
node tools/loredeck/loredeck-cli.mjs brief <id> --role grounding-verify --deck D --batch B [--out P]
node tools/loredeck/loredeck-cli.mjs brief <id> --role grounding-verify --deck D --file <category>/<topic-stem> [--out P]
```

`--batch B` checks a title batch; `B` is the batch file name or its `batchId`. `--file` checks a card batch: one entry file, `drafts/<D>/<category>/<topic-stem>.json`, named the same way as the drafting brief's `--file`; `brief` errors if the file doesn't exist. Pass exactly one of the two. On Claude Code, dispatch it as the `loredeck-grounding-verifier` agent (`.claude/agents/`, bundled in the plugin's `agents/` and in the `.skill` under `claude-code-agents/`), whose tools are reading tools plus `Write`, and whose brief restricts that `Write` to its one findings file (the restriction is by instruction, not by the tool allowlist); elsewhere use a generic subagent. Either way the rendered brief is the whole prompt (`agents/grounding-verify.md` is the single source of truth for both kinds).

- **Keep its context clean.** Pass the brief through unchanged: no task note, no drafting rationale, no summary of what you meant. A checker that shares the drafter's context tends to share its mistakes; it sees only the batch, the evidence files it cites and, for cards, the deck's `timeline.json`.
- **What it judges.** For a title: whether the `support` facts entail the `gateIntent`, and whether the gate timing matches. For a card: whether the `sourceInfo.evidenceFacts` facts entail `content.fact` and `content.injection`, and whether the `context` window (its anchors resolved through `timeline.json`) and the `revealPolicy` match the timing those facts describe. A card whose window opens before the story point its facts describe, or whose reveal policy exposes something the facts place later, comes back `timing-mismatch`; a card with no `evidenceFacts` comes back `unsupported`.
- **On return:** open the findings file from `wrote[]`: `reviews/audit/grounding.<deck>.titles.<batch>.json` for titles, or `reviews/audit/grounding.<deck>.cards.<category>.<topic-stem>.json` for cards (the entry file's path under `drafts/<deck>/` with `/` replaced by `.`). For each non-`entailed` finding, fix the title (claim, gate, or `support`) or the card (fact, injection, context window, reveal policy, or `evidenceFacts`), or keep it and note why for the user. Re-run `ground check`, re-dispatch the checker if you changed the batch, then `report --stage titles` or `report --stage cards` (its summary shows "N verified, M flagged") and spot-check a sample yourself.
- **At franchise scale,** dispatch the card checkers for a merged wave in parallel with the next drafting wave instead of waiting on them. The checker only reads, so it never races the drafters; resolve its findings in the next merge.
- Findings are advisory in v1 and never block a gate; the user sees them at the top of the titles or cards artifact.

## Return contract

Every subagent ends with exactly one JSON object and nothing else (`agents/_return-contract.md` is the text `brief` appends to every role):

```json
{ "status": "ok|partial|failed", "wrote": ["evidence/chapters/chapters.json"], "counts": { "records": 12 }, "gaps": ["..."], "flags": ["contested:ch-07"] }
```

- **Read results from disk, never from chat.** `wrote[]` tells you which files to open; don't take drafted content back from the subagent's message, and don't paste it into your own context. This keeps the orchestrator's context small on large families.
- **`ok`** — validate the files in `wrote[]` and continue.
- **`partial`** — the file exists but `gaps[]` lists missing work. Either accept the file and plan the gap as a follow-up dispatch, or re-dispatch that one file.
- **`failed`**, a missing/unparseable return object, or a `wrote[]` path that isn't on disk — re-dispatch just that one file with the same rendered brief (re-render it with `brief`; it's deterministic). One file per subagent is what makes the retry this cheap.
- **`flags[]`** — `kind:detail` items you must decide on (e.g. `contested:<recordId>`, `truncated-source:<url>`, and for drafting roles `missing-tag:<tag>`). Track them in your task list until resolved.

## Drafting subagents

Only after the planning gate (timeline + tags approved) and the title gate for the batch. **Dispatch every drafting subagent with the prompt `brief` renders — never hand-write it.**

```
node tools/loredeck/loredeck-cli.mjs brief <id> --role draft --deck D --batch B --file <category>/<topic-stem> [--out P]
```

Pass the output through unchanged; add at most a short task note after it. The rendered prompt contains: the approved title batch (`plans/title-batches/<deck>/<B>.json`, or the file whose `batchId` is B) verbatim; the deck's `timeline.json` and `tags.json` paths, stated as read-only; the absolute path of every evidence file holding a record the batch cites in any title's `evidenceRefs` or `support` (deduplicated, sorted), with the instruction to read each one directly before drafting; `references/authoring-rules.md` in full; the output path `drafts/<deck>/<file>.json`; the grounding rules (every card carries `sourceInfo.evidenceRefs` and `sourceInfo.evidenceFacts`); and the return contract with `counts` as `{"cards": N}`. It is deterministic for a given project state.

- `--file` names the one entry file the subagent writes, by topic: `characters/core_cast`, `secrets/major_reveals`. `brief` rejects batch-numbered stems (`batch-1`, `entries_2`); see authoring-rules § Deck manifest. If the file already exists, the prompt tells the subagent to keep its entries and append.
- `brief` refuses to render unless the batch's titles status is `approved` (`batch set ... --kind titles --status approved`), the deck's registries exist, and every cited record is in an evidence file. Run `ground check --stage titles` first.
- Missing tags and anchors come back as return `flags` (`missing-tag:<namespace:value>`, `missing-anchor:<anchor-id>`), and titles the cited facts can't support as `ungrounded:<title-id>` plus a `gaps` entry. The subagent never edits the registries.

The prompt has the subagent read evidence files itself rather than taking a paste. This assumes a tool-call budget of roughly (cited evidence files + a couple); see Sizing above. If the runtime's budget is too tight, add the cited records verbatim (not paraphrased) in the task note.

### Why the drafting prompt reads like this (orchestrator-only rationale)

This history is for you, not for subagents — don't paste it into a brief.

- **Pasted evidence drifts.** A paraphrase or an accidentally-dropped record in an orchestrator paste is exactly how a card ends up "citing" evidence it doesn't really match. Reading the actual `facts[]` arrays removes that step.
- **Drafting from labels or memory.** Cards drafted from a record's `inUniverseSpan` label, genre knowledge, or memory of the source still validate, because the evidenceRef resolves. `sourceInfo.evidenceFacts` makes the subagent name the specific facts each card rests on, so `ground check --stage cards` can check the pointers and you can read each claim next to its facts.
- **Drifted tags.** Subagents that could define tags produced bare strings like `"location"` instead of namespaced `namespace:value` ids, and tags defined but never used by any card. The registries are read-only to the subagent, and missing tags come back as flags you resolve in the merge protocol.
- **Batch-numbered files.** Entry files named after generation batches are a maintenance dead end; `--file` forces a topic name.

## Merge protocol (main session, after each drafting wave)

1. Confirm each returned entry file is at the `drafts/<deck>/<category>/` path its brief named, and discard anything else the subagent touched.
2. `stats <draft-dir> --write`, then `health <project> --strict` — fix every issue.
3. `ground check <project> --stage cards` — fix every issue.
4. Run the grounding checker on each merged entry file: one fresh-context checker per file, dispatched with `brief <id> --role grounding-verify --deck D --file <category>/<topic-stem>` (see Grounding checker above). At franchise scale, dispatch these checkers in parallel with the next drafting wave. Resolve each non-`entailed` finding: fix the card, or keep it with a reason for the user. Re-run `ground check` after any fix.
5. `report --stage cards` — resolve duplicate ids and unbacked cards it flags; the checker's findings summary sits at the top. Spot-check a sample of cards against the facts shown next to them.
6. Reconcile tag usage: if a subagent flagged a missing tag, add it to `tags.json` deliberately (and to the family vocabulary) — this is the only place new tags get added; a subagent's own output should never contain a `tags.json` edit or an undefined tag.
7. Present the batch review artifact at the gate.
