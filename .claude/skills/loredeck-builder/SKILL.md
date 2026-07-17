---
name: loredeck-builder
description: Build complete, validated Saga Loredecks outside the app through a staged, user-gated workflow (scope brief, evidence, context planning, titles, cards, health, package). Use when the user wants to create a new canon or fandom Loredeck, resume a workshop project, validate a deck folder, or produce an importable .saga-loredeck.zip. Scales from a single novel to a huge franchise with subagent fan-out.
---

# Loredeck Builder

You are driving Saga's external Loredeck authoring workflow: a staged loop that turns a canon (one novel up to a whole franchise) into a validated, importable `.saga-loredeck.zip`. The user reviews and approves every stage; nothing advances without their explicit sign-off.

## Ground rules

1. **The schema reference is the only source of truth for data shapes.** Read `docs/loredecks/SAGA_LOREDECK_SCHEMA.md` before emitting deck JSON. Never invent fields, registry shapes, or health codes. `references/authoring-rules.md` condenses the practical rules.
2. **Evidence before cards.** Lorecards may only be drafted from accepted evidence records, and every card cites its evidence in `sourceInfo.evidenceRefs`. No wiki-memory drafting.
3. **Gates are user approvals, not formalities.** Present the stage's review artifact, wait for the user's explicit approval in chat, and only then run `gate approve`. If the user rejects, revise and re-present — that is the loop.
4. **Project state is CLI-owned.** Never hand-edit `project.json`; use the CLI so the resume contract stays valid. All other project files (briefs, evidence, plans, deck drafts) are yours to write.
5. **The release bar is strict-clean Pack Health**: zero errors, warnings, AND suggestions. `promote` and `verify-package` enforce this; do not argue a warning is acceptable — fix it.
6. **Track multi-part work with a task list tool when your runtime has one.** Evidence scopes, title/card batches, and (for families) decks in flight are exactly the state a task-tracking tool exists for. Use it alongside `batch set`/`status`, not instead of them: the CLI owns the resume contract; the task list is your own live picture of what's done, in progress, and blocked this session — most valuable with subagent fan-out, where it's easy to lose track of which of N spawned subagents have returned.

## The CLI

From a repository checkout, commands are `node tools/loredeck/loredeck-cli.mjs <command>` and projects default to the gitignored `workshop/` directory. The packaged skill uses its generated `cli/loredeck-plugin.mjs` wrapper and defaults to `<your project>/loredeck-workshop/`. Both entry points honor `SAGA_WORKSHOP_ROOT`; set it explicitly when the location matters. Add `--json` for machine-readable output.

| Command | Purpose |
| --- | --- |
| `init <id> --title T [--size single\|family] [--decks id:role,...]` | Scaffold project + skeleton deck folders |
| `status <id> --json` | Resume contract: stage, pending gate, counts |
| `deck add <id> --deck D:ROLE` | Add a core/era/standalone deck to an existing project |
| `gate approve <id> [--deck D] [--note N] [--artifact P]` | Record user approval, advance project-wide or deck-scoped stage |
| `gate reopen <id> --stage S [--note N]` | Rewind to an earlier (or same) stage — for a family project already at `complete` gaining new decks; never advances |
| `evidence validate\|accept\|reject <id> [--scope S] [--ids a,b\|--all]` | Evidence pipeline |
| `batch set <id> --deck D --kind titles\|cards --id B --status S [--count N]` | Record batch review outcomes |
| `report <id> --stage brief\|evidence\|plan\|titles\|cards\|final` | Regenerate the stage review artifact in `reviews/` |
| `health <deck-dir\|id> [--deck D] [--dist] [--strict]` | Full Pack Health (identical to in-app) |
| `conformance <deck-dir>` / `stats <deck-dir> --write` | Structural checks / stats+files[] rewrite |
| `promote <id> [--deck D]` | drafts → dist, gated on conformance + strict health |
| `package <id> [--deck D] [--author A] [--pkg-version V]` | Build the `.saga-loredeck.zip` from dist/ |
| `verify-package <zip>` | Parse + health-check the final artifact |

The CLI mechanically validates project state, evidence shape, manifests, registries, statistics, Pack Health, safe package paths, and archive round-trips. It does not prove that a card's wording is actually grounded in its cited facts, that a continuity decision is correct, or that a deck deserves human-vetted quality tags. Regenerate each review artifact, resolve its findings, present it to the user, and only then record the gate approval.

## Session start: new or resume?

If the user names an existing project (or you find one), run `status <id> --json` and resume at the recorded stage — regenerate that stage's review artifact before re-presenting its gate. See `references/state-and-resume.md`. Otherwise start at Stage 0.

## The staged loop

Full stage-by-stage instructions, gate criteria, and artifacts: this section is the spine; keep to it.

**Stage 0 — Intake.** Define the user's intent. If a `/grill` skill is available, invoke it with the canon-definition brief; otherwise use the built-in question framework in `references/intake-questions.md` (source boundary, continuity/adaptation, canon tier, spoiler philosophy, deck split, granularity). Size the canon with `references/canon-sizing.md` and recommend single deck vs deck family. Gate: user confirms the intent summary → `init` the project → `gate approve`.

**Stage 1 — Scope brief.** Write `brief/scope-brief.md` (template: `templates/scope-brief.md`): fandom, source range, continuity, canon tier, deck split with per-deck boundaries, story-coordinate model, spoiler philosophy, assumptions/risks. `report --stage brief`, present, iterate until approved → `gate approve --artifact reviews/brief.md`.

**Stage 2 — Evidence.** Plan 3–8 evidence scopes (chapters/arcs, characters, factions, places, systems/tech, timeline) — track each scope's status (planned/researching/validated/accepted) in your task list if available. Research per scope — subagents for medium/large canons (`references/subagent-playbook.md`) — writing evidence files per `references/evidence-pipeline.md` (template: `templates/evidence-file.json`). `evidence validate`, fix issues, present `reviews/evidence.md`; the user accepts/rejects records (`evidence accept/reject`). Gate: enough accepted evidence to cover the scope brief → `gate approve`.

**Stage 3 — Context planning.** From accepted evidence only: write each deck's `drafts/<deck>/timeline.json` (anchors with stable ids + monotonic sortKeys, windows for eras/spoiler boundaries) and `drafts/<deck>/tags.json` (namespaced, reusable; every tag you plan to use, defined). Prose rationale goes in `plans/context-timeline-plan.md` (template: `templates/context-timeline-plan.md`). `report --stage plan`, present → `gate approve`.

**Stage 4 — Titles.** Draft title batches (~15–25 titles each) as `plans/title-batches/<deck>/batch-N.json` (template: `templates/title-batch.json`): id, title, category, gate intent, evidenceRefs. Ground every `gateIntent` in the cited records' `facts[]` — re-read them now; don't draft from `inUniverseSpan` or memory of the source (`references/authoring-rules.md` § Grounding). Before presenting each batch, spot-check every `gateIntent` against its cited facts — citing a real evidenceRef doesn't mean the claim came from it. `report --stage titles`, present per batch; record outcomes with `batch set` (and in your task list if available — batch status across a large deck family adds up fast). Gate: all planned batches approved → `gate approve`.

**Stage 5 — Cards.** Draft Lorecards from approved titles + accepted evidence, in batches of ~10, into `drafts/<deck>/<category-folder>/*.json` following `references/authoring-rules.md` exactly — ground every `content.fact` in the cited evidenceRefs' `facts[]`, not in memory or the title's `gateIntent` alone. Subagents may draft batches for large canons — track each spawned subagent's status (drafting/returned/merged) in your task list if available; you merge, dedupe ids, and reconcile tags. After each batch: `stats <draft-dir> --write`, `health <id> --strict`, fix everything, `report --stage cards` (it flags duplicate ids and evidence-unbacked cards, but not ungrounded ones — spot-check card facts against cited evidence yourself before presenting), present, `batch set`. Gate: all batches approved → `gate approve`.

**Stage 6 — Health.** `promote <id>` (per deck). Fix every reported issue and re-promote until all decks land in dist/ strict-clean. Present `reviews/health-<deck>.md` → `gate approve`.

**Stage 7 — Package.** Bump each deck's manifest `tags[]` from `quality:draft-reference` to `quality:human-vetted` plus `quality:relevance-curated` (see `references/authoring-rules.md`), then `package <id> --author <user>` and `verify-package <zip>`. `report --stage final`, present the final review + zip path → `gate approve`.

**Stage 8 — Complete.** Deliver the zip path and import instructions: SillyTavern → Saga → Loredeck Library → Import Deck; confirm Pack Health shows "good" in-app. Offer follow-ups (cover image, more decks in the family, revisions — revisions restart at the stage they touch).

## Sizing and subagents (summary)

- **Single deck** (one novel/film, ≤ ~150 cards): one deck, no subagents needed.
- **Core + eras** (a series): `<canon>-core` plus era decks; model the split on `content/loredecks/hp-core` + `hp-year-*`; research subagents optional.
- **Deck family** (WH40k scale): core + faction/era decks; one research subagent per evidence scope, drafting subagents per deck/batch; you own the cross-deck tag registry, continuity ids, and all merging — track each deck's stage in your task list if available, since `project.json`'s `stage` is project-wide, not per-deck (`references/state-and-resume.md`). Details: `references/canon-sizing.md`, `references/subagent-playbook.md`.
