# Canon Sizing Rubric

Pick the smallest structure that lets a user load only what their story needs. Key inputs: number of distinct eras/arcs/POVs, expected card count, spoiler-window density, and whether anyone would want a partial stack.

## Single deck (`--size single`)

One novel, film, game, or tightly-bounded arc. One era, one continuity, ≤ ~150 cards.

- Example: Starship Troopers (the Heinlein novel).
- 3–6 evidence scopes (chapters/phases, characters, factions/organizations, systems/tech, places).
- Timeline: one axis of story anchors; windows for the major phases.
- No subagents required; batches of ~20 titles / ~10 cards.

## Core + era decks (`--size family`)

A series with one narrative spine: book series, TV series, game trilogy.

- Model: `$CLAUDE_PLUGIN_ROOT/reference-decks/hp-core` + `hp-year-1..7` + `hp-epilogue-post-war`.
- `<canon>-core`: durable world rules, stable character baselines, factions, magic/tech systems — things true across the span, written as wide entries with conservative retrieval.
- One era deck per book/season/act: state changes, local pressure, reveals, era-gated secrets.
- Shared tag vocabulary and continuity ids across the family; era decks set `family.role: era` and `recommendedCoreDeckId`. `init --size family` also nests each deck's `library.suggestedPath` under the project title (core deck gets `[title, "Core"]`, era decks get `[title, deckId]`) — relabel the second segment by hand for readability once you know the era names.
- Research subagents optional (one per evidence scope); drafting usually stays in the main session.

## Deck family at franchise scale

Multi-era, multi-faction canons (Warhammer 40k, Star Wars, long-running comics).

- Never attempt total coverage. Grill the user for the slice their stories actually need (factions, era, sources) and declare everything else out of scope in the brief.
- Core deck + one deck per faction/era the user selected. Each deck gets its own evidence scopes.
- Subagents: one research agent per scope, drafting agents per deck/batch (see subagent-playbook.md). The main session owns the cross-deck tag registry, continuity ids, dedupe, and all gates.
- Ship incrementally: core + one or two decks to strict-clean health and import them before widening — the family grows deck by deck, each a full pass through stages 2–7. **Declare the full deck roster in `init --decks` at Stage 0, even the decks you won't touch until a later wave** — `decks[]` can only be set at `init`, there's no CLI command to add a deck afterward. Undeclared decks you add to the roster later mean hand-editing project state, which is exactly what the CLI-owned `project.json` contract forbids.
- The project's `stage` (not `decks[].stage`) is project-wide, not per-deck — once the first wave's decks reach `complete`, `gate approve` has nothing left to approve for the *next* wave's stages 4–7. Use `gate reopen <id> --stage titles` (or wherever the next wave actually starts) before resuming the normal gate loop; see `references/state-and-resume.md`.

## Granularity within any size

- **Compact**: major constraints, critical secrets, durable rules, high-impact state changes.
- **Focused** (default): arc-level coverage — relationships, obligations, powers, timing.
- **Dense**: many scene-relevant anchors and status changes across a broad scope.
- **Scene-dense**: moment-level Context for a short span.

Derive card counts from scope × source density × granularity; don't ask the user for an arbitrary number unless they have a hard limit.
