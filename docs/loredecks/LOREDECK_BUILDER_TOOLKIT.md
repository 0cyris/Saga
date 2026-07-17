# Loredeck Builder Toolkit

This document describes the `loredeck-builder` skill and its `tools/loredeck/` CLI: the external, LLM-driven path for authoring a complete, validated Saga Loredeck outside the app and producing an importable `.saga-loredeck.zip` package.

The toolkit is the third release-facing authoring path, alongside the in-app **Deck Maker** and the manual docs-plus-schema handoff bundle. Use it when you want a staged, user-gated workflow that an assistant can drive end to end in a repo checkout, with the same Pack Health bar as the app enforced at every gate. It scales from a single novel up to a large franchise deck family.

The skill supplies the workflow and judgment. The CLI owns project state, evidence, review artifacts, health parity, promotion, and packaging. This document is the release-facing reference for the CLI and project layout; the skill's own `SKILL.md` and `references/` hold the stage-by-stage authoring instructions.

## When To Use It

Use the toolkit when:

- You are authoring a new canon or fandom Loredeck outside Saga and want the output to be an importable package.
- You want an evidence-gated workflow with an audit trail from source to card, not wiki-memory drafting.
- You want app-identical Pack Health validation before you ship, without importing draft data into Saga.
- You are working in Claude Code, Cowork, or Claude Desktop with this repository available.

Use the in-app **Deck Maker** instead when you want to draft inside Saga with live provider routing and Pending Review. Use the plain docs handoff (see [LLM_LOREDECK_GENERATION_GUIDE.md](LLM_LOREDECK_GENERATION_GUIDE.md)) when another LLM cannot run the repo tooling.

## Getting Started

The workflow is driven by the skill, not by running CLI commands by hand.

1. Open this repository in Claude Code, Cowork, or Claude Desktop.
2. Invoke the `loredeck-builder` skill (or type `/loredeck-builder`) and describe the canon you want to build, the folder you want validated, or the project you want to resume.
3. The skill drives the staged, user-gated loop. It presents a review artifact at each stage and waits for your explicit approval before advancing; nothing moves forward without your sign-off.

You can run the CLI directly for inspection, but the resume contract, gates, and evidence pipeline are meant to be managed through the skill so project state stays valid.

Node 18 or newer is required to run the CLI.

## The CLI

All commands run from the repository root:

```text
node tools/loredeck/loredeck-cli.mjs <command> [args] [--json]
```

Every command accepts `--json` for machine-readable output. Run the CLI with no command, `help`, or `--help` to print the usage list.

| Command | Purpose | Key arguments and flags |
| --- | --- | --- |
| `init` | Scaffold a workshop project and skeleton deck folders. | `<project-id> --title <title> [--size single\|family] [--decks id:role,...]` |
| `status` | Resume contract: current stage, pending gate, evidence and batch counts. | `<project-id> [--json]` |
| `gate` | Record a user approval and advance exactly one stage. | `approve <project-id> [--note <note>] [--artifact <path>]` |
| `batch` | Record a title or card batch review outcome. | `set <project-id> --deck <deck-id> --kind titles\|cards --id <batch-id> --status draft\|approved\|rejected [--count N]` |
| `evidence` | Validate, accept, or reject evidence records. | `validate\|accept\|reject <project-id> [--scope <scope>] [--ids a,b\|--all] [--note <note>]` |
| `report` | Regenerate a stage's review artifact under `reviews/`. | `<project-id> --stage brief\|evidence\|plan\|titles\|cards\|final` |
| `health` | Full Pack Health, identical to the in-app check. | `<deck-dir\|project-id> [--deck <deck-id>] [--strict] [--out <dir>]` |
| `conformance` | Structural conformance checks on a deck folder. | `<deck-dir>` |
| `stats` | Compute deck stats; optionally rewrite the manifest `stats`/`files`. | `<deck-dir> [--write]` |
| `promote` | Move drafts to `dist/`, gated on conformance and strict health. | `<project-id> [--deck <deck-id>]` |
| `package` | Build the `.saga-loredeck.zip` from `dist/`. | `<project-id> [--out <file.saga-loredeck.zip>] [--author <name>] [--pkg-version <semver>]` |
| `verify-package` | Parse and health-check a finished package archive. | `<zip-path>` |

## Workshop Project Layout

Projects live under `workshop/<project>/` in the repository root. This directory is gitignored: work-in-progress canon projects are local scratch, and the only shipped output is the promoted `.saga-loredeck.zip`. Override the location with the `SAGA_WORKSHOP_ROOT` environment variable when you want projects stored elsewhere.

A project folder holds:

```text
workshop/<project>/
  project.json                CLI-owned resume contract. Never hand-edit it.
  brief/                      Scope brief and intake notes.
  evidence/<scope>/*.json     Evidence records, one file per source per scope.
  plans/                      Context/timeline plan prose and title batches.
  drafts/<deck>/              Draft deck folders: manifest, registries, entry files.
  reviews/                    Generated stage review artifacts presented at each gate.
  dist/                       Promoted, strict-clean deck folders ready to package.
```

`project.json` records the stage, deck roles, appended gate approvals, evidence counts, per-deck batch states, and a capped action journal. It is owned by the CLI so the resume contract stays valid; use the CLI to change it rather than editing it directly.

## Evidence Records

Cards may only be drafted from accepted evidence, and every card cites its evidence in `sourceInfo.evidenceRefs`. Evidence gives the user a review gate before any lore is written and gives every card an audit trail back to a source.

Evidence lives at `evidence/<scope>/<slug>.json`, where a scope is a lowercase slug partitioning the research (for example `chapters`, `characters`, `factions`, `places`, `systems`, `timeline`). Each file carries:

- `schemaVersion`, `scope`, and `sourceKind` (`user_supplied` or `web`).
- `provenance`: `url`, `title`, `retrievedAt`. A `web` source requires `provenance.url`; a `user_supplied` source requires `provenance.title`.
- `records[]`: each with a unique `id`, a `title`, `keyEntities`, `authoringSignals`, `facts` (specific and source-grounded, no interpretation), and optional `quotesOrRefs`. Every record needs a title and at least one fact.
- `failures[]`: recorded research gaps.

`evidence validate` enforces these rules and regenerates `reviews/evidence.md`. The user then accepts or rejects records with `evidence accept|reject`. Only accepted records may back cards; the card-stage report flags any card that cites a rejected or unknown record, or cites nothing. Record ids become citation keys in the form `<scope>/<recordId>`.

## Promotion, Packaging, and the Release Bar

The finishing pipeline is `promote` then `package` then `verify-package`:

1. `promote <project-id>` runs conformance and strict Pack Health on each deck's drafts and, only if they pass, moves the deck into `dist/`. Fix every reported issue and re-promote until all decks land clean.
2. `package <project-id>` assembles the `.saga-loredeck.zip` from `dist/`, with package metadata, the `loredecks/` index, deck manifests, entry files, registries, and any cover assets. See [LOREDECK_ZIP_PACKAGE_STRUCTURE.md](LOREDECK_ZIP_PACKAGE_STRUCTURE.md) for the archive contract.
3. `verify-package <zip-path>` re-parses the finished archive and health-checks it as Saga would on import.

The release bar is **strict-clean Pack Health**: zero errors, zero warnings, and zero suggestions. This is the same Pack Health used inside the app, run against the same deck data through the same engine, so a package that clears the toolkit's bar imports and reports clean in Saga. `promote` and `verify-package` both enforce this bar; a warning is not something to argue past, it is something to fix.

After packaging, import the archive through **SillyTavern > Saga > Loredeck Library > Import Deck** and confirm Pack Health reports clean in-app.

## Validation

The toolkit and its supporting modules are covered by the alpha gate. These scripts run as part of `tools/scripts/run-alpha-gate.mjs`:

- `test-loredeck-cli-health-parity.mjs`: confirms the CLI's Pack Health matches the in-app health engine.
- `test-loredeck-workshop-state.mjs`: exercises the `project.json` resume contract and stage machine.
- `test-loredeck-evidence-store.mjs`: covers evidence validation, acceptance, and citation rules.
- `test-loredeck-cli-conformance.mjs`: covers the conformance and stats checks.
- `test-loredeck-cli-package-roundtrip.mjs`: promotes, packages, and verifies a deck end to end.

## See Also

- [LOREDECK_AND_LORECARD_CREATION_GUIDE.md](LOREDECK_AND_LORECARD_CREATION_GUIDE.md): authoring intent, principles, and the supported authoring paths.
- [SAGA_LOREDECK_SCHEMA.md](SAGA_LOREDECK_SCHEMA.md): the schema contract the toolkit enforces; the source of truth for all deck data shapes.
- [LOREDECK_ZIP_PACKAGE_STRUCTURE.md](LOREDECK_ZIP_PACKAGE_STRUCTURE.md): the importable `.saga-loredeck.zip` package shape `package` produces.
- [LLM_LOREDECK_GENERATION_GUIDE.md](LLM_LOREDECK_GENERATION_GUIDE.md): the docs-only handoff path for an LLM that cannot run the repo tooling.
