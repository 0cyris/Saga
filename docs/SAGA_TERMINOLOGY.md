# Saga Terminology

**SAGA: Fandom Loresystem.**

This document records the public terminology for Saga after the Lorepack/Lore Entry rename.

## Canonical Public Terms

| Use | Public term | Old/internal term |
| --- | --- | --- |
| A loadable fandom lore collection | Loredeck | Lorepack |
| A single reviewable lore unit | Lorecard | Lore Entry |
| The user-facing deck quality report | Deck Health | Pack Health |
| Built into Saga and human-vetted | Bundled Loredeck | Bundled Lorepack |
| Created by Saga's model-assisted creator | Generated Loredeck | Generated Lorepack |
| User-created, user-edited, imported, AU, crossover, or shared | Custom Loredeck | Custom Lorepack |
| Deck creation workflow | Loredeck Creator | Lorepack Creator |
| Deck browsing and management | Loredeck Library | Lorepack Library |
| Ordered loaded deck list | Active Stack | Lorepack Stack |

## Migration Policy

Public copy, UI labels, tooltips, and docs should use **Loredeck**, **Lorecard**, and **Deck Health**.

Internal identifiers may temporarily remain `lorepack`, `packId`, `lorepack.json`, and `Lorepacks/` to reduce churn while Saga stabilizes. Do not rename internal files, schema keys, persisted state keys, or export bundle fields until compatibility aliases and migration tests exist.

When a user-facing path or code sample must reference the current on-disk format, keep the real path or field name and explain it as an internal/development name.

## Next Rename Phases

1. User-facing copy and docs.
2. Import/export aliases, so `packId` and future `deckId` both normalize safely.
3. Schema documentation update.
4. Persisted state migration, if needed.
5. Optional internal code/file rename after MVP stabilization.
