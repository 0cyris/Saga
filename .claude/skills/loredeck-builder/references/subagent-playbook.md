# Subagent Playbook

Use subagents to parallelize large canons. The main session is the orchestrator: it owns all gates, project state writes, the cross-deck tag/timeline registries, merging, and dedupe. Subagents never call `gate approve`, `evidence accept/reject`, or edit `project.json`.

If your runtime has a task-tracking tool, use it to track every spawned subagent's status (dispatched/returned/merged) once a wave is more than a couple of subagents — it's the difference between noticing a subagent went silent and finding out three batches later that one never made it into `drafts/`.

## When to fan out

- Single deck: no subagents (overhead exceeds benefit).
- Core + eras: optional — one research subagent per evidence scope if the source material is long.
- Franchise scale: one research subagent per evidence scope, drafting subagents per deck or per card batch.

## Sizing each subagent's task

**One output file per subagent, max.** A subagent asked to write multiple files in one prompt (e.g. evidence + a cast file + a places file) risks exhausting its tool-call budget partway through and returning nothing usable at all — the failure is all-or-nothing, not partial credit. Split multi-file work into one subagent per file, even if that means more subagents in the wave.

**Know your runtime's per-subagent tool-call budget before deciding paste-vs-read.** Some harnesses cap it low (a subagent that ran out of budget mid-task and returned nothing usable is what motivated the one-file rule above); others give subagents a generous, effectively unbounded budget. A budget that comfortably covers a handful of file reads plus the final write (roughly: number of cited evidence files + a couple) is enough to have drafting subagents read their own evidence instead of trusting a paste — see Drafting subagents below. If the budget is tight, fall back to pasting content verbatim instead.

## Research subagents

**Dispatch every research subagent with the prompt `brief` renders — never hand-write it.**

```
node tools/loredeck/loredeck-cli.mjs brief <id> --role research --deck D --scope S [--file F] [--assignment TEXT] [--out P]
```

Pass the output through unchanged; add at most a short task note after it (the source slice or URL list for this subagent, or a `deckId` to set). The rendered prompt already contains everything the subagent needs: the approved scope brief, `templates/evidence-file.json` verbatim, the authoringSignals vocabulary, the output path (`evidence/<scope>/<file>.json`, default file name = the scope), record ids already used in the scope, the source policy, the grounding rules, and the return contract below. The prompt is deterministic for a given project state, so re-rendering it for a retry gives the subagent the same instructions. Use `--file` to split one scope across several subagents (one file each, e.g. `--file chapters-01-05`), and always pair it with `--assignment` (e.g. `--assignment "chapters 1 to 5"`) so the prompt itself states the subagent's slice; without it the prompt assigns the whole scope. `brief` refuses to render while `brief/scope-brief.md` still has placeholder sections.

Role templates live in `agents/` (`research.md` plus the shared `_return-contract.md`). They state the required shapes positively and on purpose say nothing about past failures; keep it that way when editing them.

### Why the prompt is rendered (orchestrator-only rationale)

This history is for you, not for subagents — don't paste it into a brief. Naming a forbidden construction in a prompt tends to concentrate output on exactly that construction.

- **Schema drift from shortened prompts.** Subagents given the evidence schema as a prose description, or told to "use the standard format" after the first prompt or two, produced structurally different files — e.g. an `encounters[]` array instead of `records[]`. `brief` inlines the template word for word in every prompt, so the shape can't erode across a wave.
- **Filenames that contradict the top-level key.** An output file named after a word that isn't the JSON key (`encounters.json`) invited the model to rename the field to match the file. `brief` names the file after the scope (or your `--file` slug).
- **Writes outside the assignment.** A subagent wrote to `tags.json`. The rendered brief names exactly one output file as the subagent's whole deliverable; validate on return and discard anything else it touched.
- **Silent null returns.** A multi-file task exhausted its budget and returned nothing. One file per subagent plus the return contract turns this into an explicit `partial`/`failed` you can retry.
- **Facts from memory.** Facts must come from source text the subagent actually read; anything unclear goes to `failures` or is marked contested. The brief states this as the positive rule.

**For PDF (or other binary/encoded) sources, extract the full readable text yourself before fanning out — never make a research subagent page through the source itself.** Per-page extraction (e.g. looping `reader.pages[i].extract_text()`) burns one tool call per page; a source of any real length exhausts the subagent's budget before it reaches the file write, and the subagent returns nothing usable. Run the extraction once in the orchestrator (`references/evidence-pipeline.md` § PDF sources has the pypdf → pdftotext → pdfminer.six fallback chain), then hand each research subagent its assigned slice of plain text in the task note — not the PDF. This also means encryption/dependency failures (missing `cryptography`, unavailable `poppler-utils`) get hit once total instead of once per subagent.

On return: read the return object (below), run `evidence validate`, spot-check records against provenance, fix or regenerate weak files before presenting the evidence gate.

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

Only after the planning gate (timeline + tags approved) and title gate for the batch. Prompt contents: the approved title batch JSON; the deck's approved `timeline.json` and **`tags.json` as read-only reference material**; `references/authoring-rules.md` in full; the output path for the entry file(s).

**If the tool-call budget allows it (see Sizing above), give the subagent the evidence file *paths* the batch cites and instruct it to read each one directly before drafting — don't paste the records.** Reading the actual `facts[]` array removes the orchestrator's paste step as a place drift can creep in (a paraphrase or an accidentally-dropped record in the paste is exactly how a card ends up "citing" evidence it doesn't really match). Only fall back to pasting the records verbatim (not paraphrased) if the runtime's budget is too tight for a few extra reads per subagent.

Hard rules to include in the prompt: **ground every claim in the evidence file(s) you read — never in memory, genre knowledge, or a record's `inUniverseSpan` label; if a fact you need isn't in the cited evidence, flag the gap in your return instead of drafting it anyway**; use ONLY schema-supported fields; use ONLY anchors and tags that already exist in the provided registries — never define new tags or edit `tags.json`; if a card needs a tag that doesn't exist yet, flag the gap in the return instead of inventing one (drifted tags — bare strings like `"location"` instead of a namespaced `namespace:value` id, or tags defined but never used by any card — are a common subagent failure mode); every card cites accepted evidence in `sourceInfo.evidenceRefs`; wide entries use `topic_or_entity` activation; keep ids stable, namespaced, and drawn from the approved titles; return valid JSON only.

Until `brief` has a drafting role, append `agents/_return-contract.md` verbatim to every drafting prompt (with `counts` as `{"cards": N}`) so drafting subagents end with the same return object.

## Merge protocol (main session, after each drafting wave)

1. Place returned entry files under `drafts/<deck>/<category>/`.
2. `stats <draft-dir> --write`, then `health <project> --strict` — fix every issue.
3. `report --stage cards` — resolve duplicate ids and unbacked cards it flags.
4. Reconcile tag usage: if a subagent flagged a missing tag, add it to `tags.json` deliberately (and to the family vocabulary) — this is the only place new tags get added; a subagent's own output should never contain a `tags.json` edit or an undefined tag.
5. Present the batch review artifact at the gate.
