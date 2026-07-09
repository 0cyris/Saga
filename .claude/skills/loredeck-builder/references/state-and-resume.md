# Project State and Resume

`workshop/<project>/project.json` is the resume contract. It is owned by the CLI (`lib/project-state.mjs`); never hand-edit it.

## Where the workshop lives

`SAGA_WORKSHOP_ROOT` decides the parent directory all `<project-id>` folders live under — and the raw repo CLI and the packaged skill/plugin default it differently:

- **Raw repo CLI** (`node tools/loredeck/loredeck-cli.mjs`): if `SAGA_WORKSHOP_ROOT` is unset, it defaults to `<repo-root>/workshop` (gitignored).
- **Packaged plugin/skill CLI** (`cli/loredeck-plugin.mjs`, the wrapper `sync-from-repo.mjs` generates): if unset, it defaults to `<your project dir>/loredeck-workshop` instead, so workshop projects land next to the canon you're authoring rather than inside the plugin's own install location.

If a `status`/`evidence`/etc. command can't find a project, this is the first thing to check — not "the CLI silently returned nothing." A missing or wrong project surfaces as a clear thrown error (`No workshop project found for <id> (missing .../project.json)`), not an empty pass; if you're seeing something that looks like an empty pass instead, check which CLI entry point (raw vs. packaged wrapper) you're actually invoking and where each one resolves the root to. Set `SAGA_WORKSHOP_ROOT` explicitly if you're ever unsure, rather than relying on either default.

## Shape (schemaVersion 1)

- `projectId`, `title`, `canonSize` (`single|family`), `continuity` (`continuityId`, `canonTier`, `adaptation`).
- `decks[]`: `{ deckId, role: core|era|standalone, stage }` — deck stage becomes `promoted` after a successful promote.
- `stage`: one of `intake, scope_brief, evidence, planning, titles, cards, health, package, complete`. **This is one value for the whole project, not per deck** — `decks[].stage` only ever tracks `pending`/`promoted`, nothing finer. A family project has a single staged-loop cycle; there's no built-in notion of "deck A finished its cycle, deck B hasn't started its."
- `gates[]`: `{ gate, stage, approvedAt, artifact, note }` appended by `gate approve`. Not deduplicated by gate name — a project that runs the staged loop more than once (see "Adding decks after `complete`" below) accumulates multiple entries with the same `gate` value, in order. That's expected, not corruption.
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

Because `stage` is project-wide, adding new decks to a family project that has already reached `complete` (e.g. shipping 4 decks, then coming back to add 3 more) leaves `gate approve` with nothing to approve — `complete` has no gate. **Never hand-edit `project.json`'s `stage` to work around this.** Use `gate reopen <id> --stage <stage> [--note N]` instead: it rewinds `stage` to an earlier point (never forward past the project's current stage — `gate approve` is the only way to advance) and logs a `gate_reopened` journal entry, without touching the prior cycle's `gates[]` history.

`decks[]` is only ever set at `init` — there is no CLI command to add a deck to an already-initialized project. **If you know a family will eventually cover more decks than you'll work on right away, declare the full roster in `init --decks` up front** (e.g. all 7 core/module/novel decks at once), even the ones you won't touch for weeks — they just sit at deck-stage `pending` until you get to them. That sidesteps this entirely: no gap between "decks I have" and "decks I need."

If you didn't declare a deck upfront and need to add one to an existing project later, that's a real, unfixed gap — there is currently no sanctioned way to do it without hand-editing `decks[]` (unlike `stage`, which `gate reopen` now covers).

For decks that already exist in `decks[]` but haven't started their staged-loop cycle (deck-stage `pending`) while the project as a whole has reached `complete` from other decks: do the evidence/planning/titles/cards work for just those decks — evidence, batch, report, health, promote, and package all operate per-deck or on the filesystem directly and never consult `stage` (only `gate approve` does) — then `gate reopen <id> --stage titles` (or whichever stage matches where those decks actually are) before resuming the normal `gate approve` loop for the remaining stages. Already-promoted decks are unaffected; `promote`/`package` work per-deck via `--deck`.
