# Project State and Resume

`workshop/<project>/project.json` is the resume contract. It is owned by the CLI (`lib/project-state.mjs`); never hand-edit it.

## Where the workshop lives

`SAGA_WORKSHOP_ROOT` decides the parent directory all `<project-id>` folders live under — and the raw repo CLI and the packaged skill/plugin default it differently:

- **Raw repo CLI** (`node "$CLAUDE_PLUGIN_ROOT/cli/loredeck-plugin.mjs"`): if `SAGA_WORKSHOP_ROOT` is unset, it defaults to `<repo-root>/workshop` (gitignored).
- **Packaged plugin/skill CLI** (`cli/loredeck-plugin.mjs`, the wrapper `sync-from-repo.mjs` generates): if unset, it defaults to `<your project dir>/loredeck-workshop` instead, so workshop projects land next to the canon you're authoring rather than inside the plugin's own install location.

If a `status`/`evidence`/etc. command can't find a project, this is the first thing to check — not "the CLI silently returned nothing." A missing or wrong project surfaces as a clear thrown error (`No workshop project found for <id> (missing .../project.json)`), not an empty pass; if you're seeing something that looks like an empty pass instead, check which CLI entry point (raw vs. packaged wrapper) you're actually invoking and where each one resolves the root to. Set `SAGA_WORKSHOP_ROOT` explicitly if you're ever unsure, rather than relying on either default.

## Shape (schemaVersion 1)

- `projectId`, `title`, `canonSize` (`single|family`), `continuity` (`continuityId`, `canonTier`, `adaptation`).
- `decks[]`: `{ deckId, role: core|era|standalone, stage }`. `stage` defaults to `pending` and gets stamped `promoted` by a successful `promote`; it can *also* now walk the same `intake..complete` sequence as the project-wide `stage` below, independently per deck, once you start using `gate approve/reopen --deck <id>` on that deck (see below) — the two are separate counters that happen to share vocabulary.
- `stage`: one of `intake, scope_brief, evidence, planning, titles, cards, health, package, complete`. This is the project-wide position, advanced by plain `gate approve`/`gate reopen` (no `--deck`) — unaffected by any deck-scoped gate activity. For a family project working through decks in separate waves (e.g. Core finishes first, a module deck follows weeks later), use `gate approve <id> --deck <deck-id>` / `gate reopen <id> --deck <deck-id> --stage <stage>` instead: these walk `decks[].stage` for just that one deck through `intake..complete`, so a newly-added or lagging deck can progress on its own cadence without disturbing the project-wide `stage` or any other deck. A deck whose `promote` already ran before its first deck-scoped `gate approve` starts that per-deck walk from `intake` regardless of how far promotion got it — promotion doesn't backfill a deck's position in the stage sequence.
- `gates[]`: `{ gate, stage, approvedAt, artifact, note, deckId? }` appended by `gate approve`. `deckId` is present only on entries from a deck-scoped (`--deck`) approval; flat, project-wide entries omit the key entirely. Not deduplicated by gate name — a project that runs the staged loop more than once (see "Adding decks after `complete`" below, and per-deck gating above) accumulates multiple entries with the same `gate` value, in order. That's expected, not corruption.
- `evidence`: `{ scopes[], acceptedCount, pendingCount, rejectedCount }` refreshed by evidence commands.
- `batches`: per deck, `titles[]`/`cards[]` of `{ id, status: draft|approved|rejected, count, updatedAt }`.
- `journal[]`: capped audit trail of CLI actions.

## Resume protocol

1. `status <id> --json` → read `stage`, `pendingGate`, `evidence`, `decks`, `batches`, `journalTail`.
2. Re-read `brief/scope-brief.md` and (from `planning` onward) the deck registries, so your working context matches the approved artifacts — approvals in `gates[]` are settled decisions; don't relitigate them.
3. Regenerate the current stage's review artifact (`report --stage ...`) before re-presenting its gate — never trust a stale artifact.
4. Pick up mid-stage work from the file system: pending evidence records, title batches without an approved status, decks with fewer cards than approved titles.

## Stage machine rules

- `gate approve` advances exactly one stage; it fails at `complete`.
- There is no skip: a stage's gate can only be approved while the project is at that stage.
- Revisions after approval: return to the affected files, redo the work, and re-run the downstream stages' validation (a card change after promote means re-promote and re-package). Record what happened via `--note` on the next gate.

## Adding decks after `complete`

Because project-wide `stage` has nothing to approve at `complete`, adding new decks to a family project that has already reached `complete` (e.g. shipping 4 decks, then coming back to add 3 more) used to force a whole-project `gate reopen`, rewinding every deck's cycle even though only the new ones needed it. **Never hand-edit `project.json`'s `stage` to work around this.** Two options now, in order of preference:

- **Per-deck (preferred):** `gate approve <id> --deck <deck-id>` / `gate reopen <id> --deck <deck-id> --stage <stage> [--note N]` operate on just that deck's `decks[].stage`, leaving the project-wide `stage` and every sibling deck's stage untouched. This is the right tool when only some decks (new ones, or ones that need rework) need to cycle again.
- **Project-wide:** `gate reopen <id> --stage <stage> [--note N]` (no `--deck`) rewinds the project-wide `stage` to an earlier point (never forward past the project's current stage — `gate approve` is the only way to advance) and logs a `gate_reopened` journal entry, without touching the prior cycle's `gates[]` history. Use this when the whole project's stage genuinely needs to move, not just one deck's.

`deck add <project-id> --deck <deck-id>:<role>` extends an already-initialized project's `decks[]` through the CLI — it appends the same `{deckId, role, stage: 'pending'}` record `init` would have built for that deck up front, and scaffolds the identical skeleton deck folder (`loredeck.json` with the same `family.recommendedCoreDeckId` linking, `tags.json`, `timeline.json`). **Never hand-edit `project.json`'s `decks[]` to add a deck** — `deck add` is the sanctioned mechanism, keeping the "CLI owns project state" contract intact the same way `gate reopen` does for `stage`. A deck added this way starts at `stage: 'pending'` regardless of how far the rest of the project has progressed — it does not inherit the project's or any sibling deck's position, so gate it independently with `gate approve <id> --deck <new-deck-id>` (see above) once its own evidence/planning/titles/cards work is ready.

You can still declare the full roster up front via `init --decks` if you already know it (e.g. all 7 core/module/novel decks at once, letting undeclared ones sit at `pending` until you get to them) — that remains a reasonable choice, just no longer the only option. `deck add` exists for the common real-world case: a family project already underway that needs one more deck later.

For decks that already exist in `decks[]` but haven't started their staged-loop cycle (deck-stage `pending`) while the project as a whole has reached `complete` from other decks: do the evidence/planning/titles/cards work for just those decks — evidence, batch, report, health, promote, and package all operate per-deck or on the filesystem directly and never consult `stage` (only `gate approve` does) — then gate them with `gate approve <id> --deck <deck-id>` (preferred, doesn't disturb the rest of the family) or `gate reopen <id> --stage titles` (or whichever stage matches where those decks actually are, rewinding the whole project) before resuming gate approvals for the remaining stages. Already-promoted decks are unaffected; `promote`/`package` work per-deck via `--deck`.
