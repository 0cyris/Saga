<p align="center">
  <img src="Images/branding/saga-banner-full.png" alt="SAGA: Fandom Loresystem">
</p>

# SAGA

**SAGA: Fandom Loresystem.**

Saga is a work-in-progress SillyTavern extension for long-form fandom roleplay and fanfiction. It is being built to organize canon, alternate-universe, crossover, and user-created lore into modular **Lorepacks** that can be loaded, prioritized, edited, validated, and used during active writing.

Saga began as Wandlight, a Harry Potter-focused lore system. The project is now being rebuilt into a broader framework for story-aware fandom support across many settings.

## Status

Saga is currently **under construction**.

This repository is being prepared for public testing so the extension can be loaded in SillyTavern and visually smoke-tested. Expect active development, incomplete workflows, changing schemas, and rough edges. Do not rely on Saga as stable storage for important stories without backups.

## What Saga Is Intended To Do

- Load canon and custom fandom Lorepacks.
- Support multiple loaded Lorepacks with stack priority.
- Track Story Position so lore appears when it belongs in the story.
- Keep future canon, secrets, and timing-sensitive facts from leaking too early.
- Let users duplicate, customize, generate, validate, and export Lorepacks.
- Provide review-first editing through Pending Review queues.
- Assist Lorepack creation and revision with model-powered tools while keeping user approval in the loop.

## Current Focus

The current production focus is stabilizing the Lorepack system:

- Bundled Harry Potter Golden Trio Lorepack.
- Story Position-native schema and retrieval.
- Lorepack Library and Stack UI.
- Custom and Generated Lorepack editing.
- Pack Health validation.
- Pending Review for lore, tags, and timeline changes.
- Timeline Registry and Tag Manager tools.
- Early Lore Assistant and Lorepack Creator workflows.

Next up: import/install handling for shared Saga Lorepack bundles, duplicate-pack warnings, and update metadata for creator-shared packs.

## Testing

Saga should be tested inside a local SillyTavern instance as a third-party extension.

Visual smoke testing should confirm that:

- The Saga runtime shelf opens and closes.
- The Lorepack tab and Settings tab render correctly.
- Provider/API settings appear in the runtime Settings tab.
- The bundled Harry Potter Lorepack loads.
- Lorepack Library, Stack, Details, Pack Health, Story Position, Tag Manager, Timeline Registry, Pending Review, Lore Assistant, and Creator panels render without layout breakage.

## Project Notes

- Lorepacks are intended to be data-only. No executable code should ship inside user-made packs.
- Bundled Lorepacks are human-vetted packs shipped with Saga.
- Generated Lorepacks are model-drafted packs created by Saga's built-in tools.
- Custom Lorepacks are user-created or user-shared packs.

## License

See [LICENSE](LICENSE).
