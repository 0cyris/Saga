# Saga Loredeck Builder (Claude Code plugin)

A self-contained Claude Code plugin that builds complete, validated Saga
**Loredecks** for any fandom canon — from a single novel to a large franchise —
and packages them as importable `.saga-loredeck.zip` files. It runs in Claude
Code, Cowork, or Desktop **without cloning the Saga repo**: the skill, the
`loredeck` CLI, a bundled Pack Health engine, the authoring docs, and one
reference deck all travel inside the plugin.

## Install

```
/plugin marketplace add 0cyris/saga
/plugin install loredeck-builder@saga-marketplace
```

Then invoke the skill (`/loredeck-builder`, or just ask Claude to build a
loredeck for a canon). Requires Node 18+ on the machine running Claude Code.

## What you get

- **`loredeck-builder` skill** — a staged, user-gated workflow (scope brief →
  evidence → context/timeline plan → titles → cards → health → package), with
  references (canon-sizing rubric, evidence pipeline, authoring rules, subagent
  playbook, resume contract) and templates.
- **`loredeck` CLI** — `init`, `status`, `gate`, `batch`, `evidence`, `report`,
  `health`, `conformance`, `stats`, `promote`, `package`, `verify-package`.
  Validation uses the same Pack Health engine as the Saga extension, so a deck
  validated here is validated for real.
- **Authoring docs** (`docs/`) and one **reference deck** (`reference-decks/hp-core`).

## Workshop location

WIP canon projects are written under `loredeck-workshop/` in your current
project (`$CLAUDE_PROJECT_DIR`), not in the plugin cache. Override with the
`SAGA_WORKSHOP_ROOT` environment variable. The finished `.saga-loredeck.zip`
imports into SillyTavern via **Saga → Loredeck Library → Import Deck**.

## Layout

```
loredeck-builder/
  .claude-plugin/plugin.json
  skills/loredeck-builder/        # the skill (SKILL.md + references + templates)
  cli/
    loredeck-plugin.mjs           # entry point (defaults the workshop root)
    loredeck/                     # the CLI (vendored from tools/loredeck)
    vendor/                       # 12 vendored Pack Health / packaging modules
  docs/                           # the four authoring docs
  reference-decks/hp-core/        # one bundled reference deck
  scripts/sync-from-repo.mjs      # regenerates everything above from the repo
```

## Keeping the bundle current (maintainers)

The Saga repo is the source of truth. This bundle is generated — do not
hand-edit files under `skills/`, `cli/`, `docs/`, or `reference-decks/`. After
changing the skill, CLI, or health modules in the repo, regenerate:

```
node plugins/loredeck-builder/scripts/sync-from-repo.mjs
```

CI can guard against drift by running the script and then
`git diff --exit-code plugins/loredeck-builder`. The bundle's health engine is
smoke-tested by `tools/scripts/test-loredeck-plugin-bundle.mjs`.
