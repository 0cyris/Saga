# Project State and Resume

`workshop/<project>/project.json` is the resume contract. It is owned by the CLI (`lib/project-state.mjs`); never hand-edit it.

## Shape (schemaVersion 1)

- `projectId`, `title`, `canonSize` (`single|family`), `continuity` (`continuityId`, `canonTier`, `adaptation`).
- `decks[]`: `{ deckId, role: core|era|standalone, stage }` — deck stage becomes `promoted` after a successful promote.
- `stage`: one of `intake, scope_brief, evidence, planning, titles, cards, health, package, complete`.
- `gates[]`: `{ gate, stage, approvedAt, artifact, note }` appended by `gate approve`.
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
