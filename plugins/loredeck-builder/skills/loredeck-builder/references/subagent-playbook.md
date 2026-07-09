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

Prompt contents: the approved scope brief; the assigned evidence scope and its boundaries; **the evidence file schema pasted verbatim from `evidence-pipeline.md` — in full, in every prompt, never shortened to "use the standard format" after the first one or two** (subagents given only a prose description have produced structurally different output, e.g. an `encounters[]` array instead of `records[]`); the authoringSignals vocabulary; output paths (`workshop/<project>/evidence/<scope>/`); the source policy (web with provenance URLs, or the user-supplied material passed verbatim).

**Name the output file after the scope, not after a word that isn't the actual top-level JSON key** — e.g. `chapters-26-27.json`, not `encounters.json`. A filename that doesn't match the required `records` key invites the model to rename the field to match the file instead.

**For PDF (or other binary/encoded) sources, extract the full readable text yourself before fanning out — never make a research subagent page through the source itself.** Per-page extraction (e.g. looping `reader.pages[i].extract_text()`) burns one tool call per page; a source of any real length exhausts the subagent's budget before it reaches the file write, and the subagent returns nothing usable. Run the extraction once in the orchestrator (`references/evidence-pipeline.md` § PDF sources has the pypdf → pdftotext → pdfminer.six fallback chain), then hand each research subagent its assigned slice of plain text — not the PDF. This also means encryption/dependency failures (missing `cryptography`, unavailable `poppler-utils`) get hit once total instead of once per subagent.

Hard rules to include in the prompt: emit evidence JSON + nothing else (no cards, no tags, no timeline edits); facts must be source-grounded with provenance — ground every fact in the source text you actually read, never in memory or genre knowledge, and if the assigned span doesn't clearly support something, record it as a gap or contested rather than fill it in; record contested facts as contested; stay inside the declared continuity boundary.

On return: run `evidence validate`, spot-check records against provenance, fix or regenerate weak files before presenting the evidence gate.

## Drafting subagents

Only after the planning gate (timeline + tags approved) and title gate for the batch. Prompt contents: the approved title batch JSON; the deck's approved `timeline.json` and **`tags.json` as read-only reference material**; `references/authoring-rules.md` in full; the output path for the entry file(s).

**If the tool-call budget allows it (see Sizing above), give the subagent the evidence file *paths* the batch cites and instruct it to read each one directly before drafting — don't paste the records.** Reading the actual `facts[]` array removes the orchestrator's paste step as a place drift can creep in (a paraphrase or an accidentally-dropped record in the paste is exactly how a card ends up "citing" evidence it doesn't really match). Only fall back to pasting the records verbatim (not paraphrased) if the runtime's budget is too tight for a few extra reads per subagent.

Hard rules to include in the prompt: **ground every claim in the evidence file(s) you read — never in memory, genre knowledge, or a record's `inUniverseSpan` label; if a fact you need isn't in the cited evidence, flag the gap in your return instead of drafting it anyway**; use ONLY schema-supported fields; use ONLY anchors and tags that already exist in the provided registries — never define new tags or edit `tags.json`; if a card needs a tag that doesn't exist yet, flag the gap in the return instead of inventing one (drifted tags — bare strings like `"location"` instead of a namespaced `namespace:value` id, or tags defined but never used by any card — are a common subagent failure mode); every card cites accepted evidence in `sourceInfo.evidenceRefs`; wide entries use `topic_or_entity` activation; keep ids stable, namespaced, and drawn from the approved titles; return valid JSON only.

## Merge protocol (main session, after each drafting wave)

1. Place returned entry files under `drafts/<deck>/<category>/`.
2. `stats <draft-dir> --write`, then `health <project> --strict` — fix every issue.
3. `report --stage cards` — resolve duplicate ids and unbacked cards it flags.
4. Reconcile tag usage: if a subagent flagged a missing tag, add it to `tags.json` deliberately (and to the family vocabulary) — this is the only place new tags get added; a subagent's own output should never contain a `tags.json` edit or an undefined tag.
5. Present the batch review artifact at the gate.
