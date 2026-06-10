# Saga Advanced Workflow

Use Advanced Experience when you want the full Saga control surface for authoring, diagnostics, automation, and prompt tuning.

Advanced uses the same data model as Basic. Loredecks, Context, pending Lorecards, accepted Lorecards, pin/mute choices, and settings-backed work carry across mode changes.

## Advanced Loop

```text
Loredecks -> Session -> Context -> Continuity -> Lorecards -> Injection -> Settings
```

## What Advanced Adds

- Full rail access, including **Continuity** and **Injection**.
- Automation and cadence controls.
- Context auditing, proposals, and advanced brief details.
- Lorecard workbenches, bulk actions, timeline/audit history, and Auto-Relevance.
- Full injection preview by relevance tier, prompt placement, compression, and sync diagnostics.
- Deck Health, Creator, import/export, update, duplication, and finalization workflows.

## Recommended Advanced Workflow

1. Configure providers in **Settings**.
2. Build and order the active Loredeck stack in **Loredecks**.
3. Resolve Context manually or with proposals in **Context**.
4. Use **Lorecards** to suggest, generate, review, edit, tier, pin, mute, and audit entries.
5. Use **Injection** to inspect what Saga sends and tune prompt placement or compression.
6. Use **Continuity** when current-scene state needs a separate tracked surface.
7. Use Deck Health and Creator tools when creating or repairing Loredecks.

Advanced should still remain review-first. Model-produced proposals should become pending or reviewable changes before they affect prompts.

## When To Return To Basic

Switch back to Basic when you want to run a chat with fewer controls visible. Basic keeps the same accepted Lorecards and Context, but hides the diagnostic surfaces.
