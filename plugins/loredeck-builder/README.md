# Saga Loredeck Builder (Claude Code skill)

A self-contained Claude Code skill that builds complete, validated Saga
**Loredecks** for any fandom canon — from a single novel to a large franchise —
and packages them as importable `.saga-loredeck.zip` files. It runs in Claude
Code, Cowork, or Desktop **without cloning the Saga repo**: the skill, the
`loredeck` CLI, a bundled Pack Health engine, the authoring docs, and one
reference deck all travel inside the `.skill` file.

## Install

Download `loredeck-builder.skill` from the repo's
[Releases](https://github.com/0cyris/saga/releases), then unzip it into
`~/.claude/skills/` (or a project's `.claude/skills/`):

```
unzip loredeck-builder.skill -d ~/.claude/skills/
```

Then invoke the skill (`/loredeck-builder`, or just ask Claude to build a
loredeck for a canon). Requires Node 18+ on the machine running Claude Code.

There's no live marketplace install for this skill — `plugins/loredeck-builder/`
is a build directory, not an installable plugin source; see below.

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
project (`$CLAUDE_PROJECT_DIR`), not inside the installed skill's own
directory. Override with the `SAGA_WORKSHOP_ROOT` environment variable. The
finished `.saga-loredeck.zip` imports into SillyTavern via
**Saga → Loredeck Library → Import Deck**.

## Layout

This directory is a **build directory, not a committed bundle** — everything
below except `README.md` and `scripts/` is gitignored and generated on demand;
none of it is hand-edited or checked into git:

```
loredeck-builder/
  README.md
  scripts/
    sync-from-repo.mjs            # regenerates skills/, cli/, docs/, reference-decks/ below from the repo
    build-skill-file.mjs          # zips the synced bundle into dist/loredeck-builder.skill
  skills/loredeck-builder/        # (generated) the skill: SKILL.md + references + templates
  cli/
    loredeck-plugin.mjs           # (generated) entry point that defaults the workshop root
    loredeck/                     # (generated) the CLI, vendored from tools/loredeck
    vendor/                       # (generated) 12 vendored Pack Health / packaging modules
  docs/                           # (generated) the four authoring docs
  reference-decks/hp-core/        # (generated) one bundled reference deck
  dist/loredeck-builder.skill     # (generated) the distributable archive
```

## Building the bundle (maintainers)

The Saga repo is the only source of truth — `.claude/skills/loredeck-builder`,
`tools/loredeck`, `docs/loredecks`, `content/loredecks/hp-core`,
`src/loredecks`, and `src/lorecards`. After changing any of those, rebuild
before cutting a release:

```
node plugins/loredeck-builder/scripts/sync-from-repo.mjs
node plugins/loredeck-builder/scripts/build-skill-file.mjs
```

There's nothing to keep "in sync" in git — the generated directories are
gitignored, so there's no second copy that can drift. `.github/workflows/loredeck-builder-build-check.yml`
runs the same build on every PR/push touching a source path and verifies the
result with `tools/scripts/test-loredeck-plugin-bundle.mjs` (self-contained
imports, strict-clean Pack Health on the bundled reference deck, a
well-formed `.skill` archive). `.github/workflows/loredeck-builder-release.yml`
runs the same build and attaches `dist/loredeck-builder.skill` to GitHub
Releases.
