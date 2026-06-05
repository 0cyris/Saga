# HP Golden Trio Loredeck Audit

Audit date: 2026-06-03

This audit treats the bundled HP pack as Saga's reference Loredeck, not as a full wiki. Its job is to prevent likely continuity mistakes while keeping retrieval selective.

## Current Shape

- Entry schema: v3.
- Manifest-loaded entry files: 40.
- Total entries: 431.
- Entry timing model: Context only.
- Calendar coordinates: `timeline.json` only.

## Reference Rules

- Entries must not use `date`, `validFrom`, `validTo`, or `canonTiming`.
- Every entry must define `context`.
- Wide entries must use low-frequency, topic/entity-driven retrieval.
- Spoiler-sensitive entries should use Context-aware visibility metadata.
- Manifest stats must match the files on disk.
- All entry files under the pack must be listed in `loredeck.json`.

## Strong Areas

- Character, spell, behavior, knowledge, age, and event constraints are separated into focused files.
- Broad school-year and series-window lore is now explicit through `context.windowKind` and conservative retrieval metadata.
- HP date picking remains possible because `timeline.json` maps calendar dates to Context anchors and date-derived sort keys.

## Required Check

Run:

```bash
node scripts/test-hp-loredeck-v3-conformance.mjs
```

This is the authoritative local audit for whether the HP pack still conforms to the Saga v3 reference shape.
