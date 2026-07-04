# Subagent Playbook

Use subagents to parallelize large canons. The main session is the orchestrator: it owns all gates, project state writes, the cross-deck tag/timeline registries, merging, and dedupe. Subagents never call `gate approve`, `evidence accept/reject`, or edit `project.json`.

## When to fan out

- Single deck: no subagents (overhead exceeds benefit).
- Core + eras: optional — one research subagent per evidence scope if the source material is long.
- Franchise scale: one research subagent per evidence scope, drafting subagents per deck or per card batch.

## Research subagents

Prompt contents: the approved scope brief; the assigned evidence scope and its boundaries; the evidence file schema (paste from evidence-pipeline.md) and the authoringSignals vocabulary; output paths (`workshop/<project>/evidence/<scope>/`); the source policy (web with provenance URLs, or the user-supplied material passed verbatim).

Hard rules to include in the prompt: emit evidence JSON + nothing else (no cards, no tags, no timeline edits); facts must be source-grounded with provenance; record contested facts as contested; stay inside the declared continuity boundary.

On return: run `evidence validate`, spot-check records against provenance, fix or regenerate weak files before presenting the evidence gate.

## Drafting subagents

Only after the planning gate (timeline + tags approved) and title gate for the batch. Prompt contents: the approved title batch JSON; the accepted evidence records the batch cites (paste the records, not paths — the subagent should not need to hunt); the deck's approved `timeline.json` and `tags.json`; `references/authoring-rules.md` in full; the output path for the entry file(s).

Hard rules to include in the prompt: use ONLY schema-supported fields; use ONLY anchors and tags that exist in the provided registries — never invent replacements; every card cites accepted evidence in `sourceInfo.evidenceRefs`; wide entries use `topic_or_entity` activation; keep ids stable, namespaced, and drawn from the approved titles; return valid JSON only.

## Merge protocol (main session, after each drafting wave)

1. Place returned entry files under `drafts/<deck>/<category>/`.
2. `stats <draft-dir> --write`, then `health <project> --strict` — fix every issue.
3. `report --stage cards` — resolve duplicate ids and unbacked cards it flags.
4. Reconcile tag usage: if a subagent needed a missing tag, add it to `tags.json` deliberately (and to the family vocabulary), don't let variants accumulate.
5. Present the batch review artifact at the gate.
