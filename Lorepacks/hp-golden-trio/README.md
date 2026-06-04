# Harry Potter: Golden Trio Lorepack

This is Saga's bundled, human-vetted reference Lorepack for the seven-book Harry Potter Golden Trio era.

It is intentionally Story Position-native. Entry files use schema v3 and do not use entry-local `date`, `validFrom`, `validTo`, or `canonTiming` gates. Calendar dates live in `timeline.json` as resolver coordinates so users can still pick a Harry Potter timeline date and Saga can translate it into the active Story Position.

## Load Model

`lorepack.json` is the manifest. It lists every entry file, registry, and cached stat used by Saga.

Required reference-pack expectations:

- `entrySchemaVersion` is `3`.
- `compatibility.sagaSchemaMin` and `compatibility.sagaSchemaMax` are `3`.
- Every entry file has `schemaVersion: 3`.
- Every entry has a `position` block.
- Every entry has `retrieval` metadata.
- No entry stores legacy timing fields.

## Timeline

`timeline.json` is the only place this pack stores calendar coordinates for gating.

The HP timeline uses `sortKeyScale: "date-derived-day"`. Anchor and window sort keys are derived from calendar dates by day number, which keeps these paths comparable:

- Manual date selection.
- Alias/header resolution.
- Model fallback resolver choices.
- Entry `position.sortKeyFrom` / `position.sortKeyTo` windows.

## Entry Shape

Entry files use the standard wrapper:

```json
{
  "schemaVersion": 3,
  "entries": []
}
```

Each entry should follow this shape:

```json
{
  "schemaVersion": 3,
  "id": "spell_gate_patronus",
  "title": "Patronus Charm learning gate",
  "kind": "spell_gate",
  "category": "spell",
  "relevance": "low",
  "lorePurpose": "ability_gate",
  "canon": "canon",
  "truthStatus": "hidden",
  "revealPolicy": "private",
  "priority": 90,
  "position": {
    "scope": "window",
    "validFromAnchor": "hp.cos.year_2",
    "validToAnchor": "hp.dh.year_7",
    "sortKeyFrom": 8401,
    "sortKeyTo": 10469,
    "precision": "school_year_window",
    "windowKind": "school_year",
    "label": "Prisoner of Azkaban: Year 3"
  },
  "scope": {
    "characters": ["Harry Potter"],
    "spells": ["Expecto Patronum"],
    "topics": ["spell knowledge", "magic ability"],
    "schoolYears": ["3"],
    "books": ["Prisoner of Azkaban"]
  },
  "visibility": {
    "revealPolicy": "private",
    "knownByAtPosition": {
      "Harry Potter": {
        "sortKey": 8917,
        "label": "1994-06-01",
        "precision": "date_anchor"
      }
    }
  },
  "retrieval": {
    "activation": "topic_or_entity",
    "frequency": "low",
    "positionalBoost": "low",
    "triggers": {
      "charactersAny": ["Harry Potter"],
      "topicsAny": ["spell knowledge", "Expecto Patronum"]
    }
  },
  "content": {
    "fact": "The Patronus Charm is advanced defensive magic; Harry learns it unusually early.",
    "injection": "The Patronus Charm is advanced defensive magic; Harry learns it unusually early.",
    "constraints": [
      "Treat Expecto Patronum knowledge as Story Position- and character-gated."
    ],
    "antiLore": [
      "Do not make Expecto Patronum common student knowledge too early."
    ]
  }
}
```

## Wide Lore

Wide lore is allowed, but it must not become always-on noise.

For broad windows, use:

```json
"retrieval": {
  "activation": "topic_or_entity",
  "frequency": "low",
  "positionalBoost": "low"
}
```

This means the entry is valid across a wide Story Position range, but Saga should only promote it when the scene, tags, subjects, or entities make it relevant.

## Visibility

Private or spoiler-sensitive lore should use position-aware visibility metadata.

Use `knownByAtPosition` and `notKnownByBeforePosition` instead of date maps. Use `neverKnownBy` for subjects that should not know something in normal canon.

## Quality Gate

Run this before treating the HP pack as reference-clean:

```bash
node scripts/test-hp-lorepack-v3-conformance.mjs
```

The test rejects legacy entry gates, unlisted entry files, missing position/retrieval metadata, old timing terminology, and timeline sort keys that do not match the date-derived axis.
