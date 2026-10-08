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
| `ground check <id> --stage titles\|cards [--deck D]` | Check every title's `support` / card's `sourceInfo.evidenceFacts` fact pointers resolve to accepted facts in its `evidenceRefs`; exits 1 on any issue |
| `brief <id> --role research --deck D --scope S [--file F] [--assignment TEXT] [--out P]`<br>`brief <id> --role evidence-audit --deck D --scope S --file F [--out P]`<br>`brief <id> --role grounding-verify --deck D --batch B [--out P]`<br>`brief <id> --role draft --deck D --batch B --file <category>/<topic-stem> [--out P]` | Render a complete subagent prompt (pass it through unchanged): research per evidence scope; the read-only evidence checker per evidence file; the read-only grounding checker per title batch; card drafting per approved title batch |
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

**Stage 2 — Evidence.** Plan 3–8 evidence scopes (chapters/arcs, characters, factions, places, systems/tech, timeline) — track each scope's status (planned/researching/validated/accepted) in your task list if available. Research per scope — subagents for medium/large canons, each dispatched with the prompt from `brief <id> --role research --deck D --scope S` (`references/subagent-playbook.md`) — writing evidence files per `references/evidence-pipeline.md` (template: `templates/evidence-file.json`). `evidence validate` and fix issues. Then run the evidence checker on each evidence file: a fresh-context, read-only subagent dispatched with `brief <id> --role evidence-audit --deck D --scope S --file F` (on Claude Code, the `loredeck-evidence-auditor` agent with that brief as its task). It re-reads the source and writes a verdict per fact to `reviews/audit/evidence-audit.<scope>[.<file>].json` (`references/evidence-pipeline.md` § Review). Resolve its findings — fix or remove `unsupported`/`out-of-scope` facts, rewrite uncontested conflicts as contested, re-research truncated or noisy sources, re-run `evidence validate` — then spot-check a sample of records against provenance yourself. Present `reviews/evidence.md` (it summarizes checker findings at the top; they never block); the user accepts/rejects records (`evidence accept/reject`). Gate: enough accepted evidence to cover the scope brief → `gate approve`.

**Stage 3 — Context planning.** From accepted evidence only: write each deck's `drafts/<deck>/timeline.json` (anchors with stable ids + monotonic sortKeys, windows for eras/spoiler boundaries) and `drafts/<deck>/tags.json` (namespaced, reusable; every tag you plan to use, defined). Prose rationale goes in `plans/context-timeline-plan.md` (template: `templates/context-timeline-plan.md`). `report --stage plan`, present → `gate approve`.

**Stage 4 — Titles.** Draft title batches (~15–25 titles each) as `plans/title-batches/<deck>/batch-N.json` (template: `templates/title-batch.json`): id, title, category, gate intent, evidenceRefs, and `support`: the fact pointers (`<scope>/<recordId>#<factIndex>`, 0-based into the record's `facts[]`) that back the `gateIntent`. Ground every `gateIntent` in the cited records' `facts[]` — re-read them now; don't draft from `inUniverseSpan` or memory of the source (`references/authoring-rules.md` § Grounding). Before presenting each batch, run `ground check <id> --stage titles` and fix every issue — a pointer proves the claim points at a fact, not that the fact says what the claim says. Then run the grounding checker: a fresh-context, read-only subagent (`loredeck-grounding-verifier` on Claude Code, or a generic subagent elsewhere) dispatched with the prompt from `brief <id> --role grounding-verify --deck D --batch B`, passed through unchanged with no drafting notes added. It writes `reviews/audit/grounding.<deck>.titles.<batch>.json` with one verdict per title (`entailed|partial|unsupported|timing-mismatch`). Resolve its findings: fix each flagged title, or keep it and say why when you present. Then spot-check a sample of `gateIntent`s against the facts their pointers resolve to (the titles artifact shows them side by side). `report --stage titles` puts a findings summary at the top (advisory, it never blocks); present per batch; record outcomes with `batch set` (and in your task list if available — batch status across a large deck family adds up fast). Gate: all planned batches approved → `gate approve`.

**Stage 5 — Cards.** Draft Lorecards from approved titles + accepted evidence, in batches of ~10, into `drafts/<deck>/<category-folder>/*.json` following `references/authoring-rules.md` exactly — ground every `content.fact` in the cited evidenceRefs' `facts[]`, not in memory or the title's `gateIntent` alone, and record the backing facts in `sourceInfo.evidenceFacts` (`<scope>/<recordId>#<factIndex>`, each record also in `sourceInfo.evidenceRefs`). Subagents may draft batches for large canons, each dispatched with the prompt from `brief <id> --role draft --deck D --batch B --file <category>/<topic-stem>` (`references/subagent-playbook.md`) — track each spawned subagent's status (drafting/returned/merged) in your task list if available; you merge, dedupe ids, and reconcile tags (missing tags come back as return `flags`; you add them to `tags.json`). After each batch: `stats <draft-dir> --write`, `health <id> --strict`, `ground check <id> --stage cards`, fix everything, then `report --stage cards` (it flags duplicate ids, evidence-unbacked cards and grounding issues, and shows each card's fact and injection next to the facts its pointers resolve to — read them side by side, since a pointer proves the claim points at a fact, not that the fact says what the claim says), present, `batch set`. Gate: all batches approved → `gate approve`.

**Stage 6 — Health.** `promote <id>` (per deck). Fix every reported issue and re-promote until all decks land in dist/ strict-clean. Present `reviews/health-<deck>.md` → `gate approve`.

**Stage 7 — Package.** Bump each deck's manifest `tags[]` from `quality:draft-reference` to `quality:human-vetted` plus `quality:relevance-curated` (see `references/authoring-rules.md`), then `package <id> --author <user>` and `verify-package <zip>`. `report --stage final`, present the final review + zip path → `gate approve`.

**Stage 8 — Complete.** Deliver the zip path and import instructions: SillyTavern → Saga → Loredeck Library → Import Deck; confirm Pack Health shows "good" in-app. Offer follow-ups (cover image, more decks in the family, revisions — revisions restart at the stage they touch).

## Sizing and subagents (summary)

- **Single deck** (one novel/film, ≤ ~150 cards): one deck, no subagents needed.
- **Core + eras** (a series): `<canon>-core` plus era decks; model the split on `content/loredecks/hp-core` + `hp-year-*`; research subagents optional.
- **Deck family** (WH40k scale): core + faction/era decks; one research subagent per evidence scope, drafting subagents per deck/batch; you own the cross-deck tag registry, continuity ids, and all merging — track each deck's stage in your task list if available, since `project.json`'s `stage` is project-wide, not per-deck (`references/state-and-resume.md`). Details: `references/canon-sizing.md`, `references/subagent-playbook.md`.
