# Evidence Pipeline

Cards are drafted only from accepted evidence. Evidence gives the user a review gate before any lore is written, and gives every card an audit trail.

## Scopes

Plan 3–8 scopes per deck that partition the research: e.g. `chapters` (or `arcs`, `episodes`), `characters`, `factions`, `places`, `systems` (magic/tech/rules), `timeline`. Scope names are lowercase slugs; they become directory names under `evidence/`.

## Evidence files

Path: `evidence/<scope>/<slug>.json`, template `templates/evidence-file.json`. Shape:

```json
{
  "schemaVersion": 1,
  "scope": "chapters",
  "sourceKind": "user_supplied | web",
  "provenance": { "url": "", "title": "", "retrievedAt": "" },
  "records": [
    {
      "id": "st-ch-07",
      "title": "Chapter 7: boot camp discipline",
      "inUniverseSpan": "",
      "keyEntities": ["Juan Rico", "Sergeant Zim"],
      "authoringSignals": ["character-state gate", "world-rule"],
      "facts": ["..."],
      "quotesOrRefs": ["..."]
    }
  ],
  "failures": []
}
```

Rules enforced by `evidence validate`: `web` sources require `provenance.url`; `user_supplied` requires `provenance.title`; record ids unique per file; every record needs a title and at least one fact.

- `facts` must be specific and source-grounded — no interpretation, no drafting. If the source is ambiguous, record the ambiguity in the fact.
- `authoringSignals` hint what the record supports; use a consistent vocabulary: `world-rule`, `character-baseline`, `character-state gate`, `secret-knowledge gate`, `status-change gate`, `relationship`, `faction`, `place-state`, `timeline-anchor`, `anti-lore`.
- Record ids become citation keys: cards cite `<scope>/<recordId>` in `sourceInfo.evidenceRefs`.

## Sourcing

- **user_supplied**: notes, summaries, or excerpts the user provides. Preferred when web access is limited or the canon is a single book the user knows well. Never reproduce long copyrighted passages into evidence — record facts, short quotes only.
- **web**: wiki/reference research (subagents fan out per scope). Always record the exact provenance URL and retrieval date. Prefer established fandom wikis; note contested facts as contested.

### PDF sources

When a source is a PDF, extract text before drafting evidence — don't transcribe from a viewer by eye.

1. Try `pypdf` first. If it raises `DependencyError: cryptography>=3.1 is required`, the PDF is encrypted (commonly AES) — `pip install cryptography` and retry; pypdf decrypts transparently once the dependency is present.
2. If `pypdf`'s extracted text is garbled (font-encoding/OCR noise — broken ligatures, dropped spaces, random symbol substitutions), fall back to `pdftotext` (poppler-utils; `pdftotext -layout` preserves column/table structure better than the default mode).
3. If neither produces clean text, extract what you can and **record the extraction quality in the evidence file's `provenance`** (e.g. `"extractionQuality": "ocr-noisy"` or a note in `provenance.title`) rather than silently treating noisy text as ground truth — a low-confidence fact should read as one downstream.

## Review

`evidence validate <id>` regenerates `reviews/evidence.md` (file table + record table with statuses). The user accepts or rejects records — `evidence accept|reject <id> --scope S --ids a,b|--all [--note]`. Only accepted records may back cards; `report --stage cards` flags any card citing rejected/unknown records or citing nothing.
