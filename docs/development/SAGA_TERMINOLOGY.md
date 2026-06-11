# Saga Terminology

**SAGA: Fandom Loresystem.**

This document records the public terminology for Saga after the Loredeck/Lore Entry rename.

## Canonical Public Terms

| Use | Public term | Old/internal term |
| --- | --- | --- |
| A loadable fandom lore collection | Loredeck | Loredeck |
| A single reviewable lore unit | Lorecard | Lore Entry |
| The user-facing deck quality report | Pack Health | Deck Health |
| Built into Saga and human-vetted | Bundled Lorepack | Bundled Loredeck |
| Created by Saga's model-assisted creator | Generated Lorepack | Generated Loredeck |
| User-created, user-edited, imported, AU, crossover, or shared | Custom Lorepack | Custom Loredeck |
| Deck creation workflow | Loredeck Creator | Loredeck Creator |
| Deck browsing and management | Loredeck Library | Loredeck Library |
| Ordered loaded deck list | Active Stack | Loredeck Stack |

## Migration Policy

Public copy, UI labels, tooltips, and docs should use **Loredeck**, **Lorecard**, and **Pack Health**. Use **Bundled Lorepack**, **Generated Lorepack**, and **Custom Lorepack** when describing the three public Loredeck package types.

Internal identifiers may remain `loredeck`, `packId`, and `loredeck.json` while Saga stabilizes. Bundled repo content lives under `content/loredecks/`, and public package archives use `loredecks/`; do not introduce compatibility aliases for old root paths in pre-alpha work.

When a user-facing path or code sample must reference the current on-disk format, keep the real path or field name and explain it as an internal/development name.

## Next Rename Phases

1. User-facing copy and docs.
2. Import/export aliases, so `packId` and future `deckId` both normalize safely.
3. Schema documentation update.
4. Persisted state migration, if needed.
5. Optional internal code/file rename after MVP stabilization.
