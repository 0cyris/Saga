# Evidence Pipeline

Cards are drafted only from accepted evidence. Evidence gives the user a review gate before any lore is written, and gives every card an audit trail.

## Scopes

Plan 3–8 scopes per deck that partition the research: e.g. `chapters` (or `arcs`, `episodes`), `characters`, `factions`, `places`, `systems` (magic/tech/rules), `timeline`. Scope names are lowercase slugs; they become directory names under `evidence/`.

Scopes are free-text and project-wide — evidence isn't implicitly scoped to one deck of a multi-deck project just because a scope name looks like a deck id. If you want the file's evidence to be usable only by one specific deck (and want `report --stage cards` to flag any other deck that cites it), set the optional `deckId` field described below to that deck's id.

## Evidence files

Path: `evidence/<scope>/<slug>.json`, template `templates/evidence-file.json`. Shape:

```json
{
  "schemaVersion": 1,
  "scope": "chapters",
  "deckId": "",
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
- `inUniverseSpan` is a coordinate label (e.g. `"Chapter 26"`), not a fact. It's for sorting/scoping evidence, not for drafting titles or cards from — a card grounded in the span instead of `facts[]` will "cite" this record while actually containing whatever the drafter remembered happening around that point in the story. See `references/authoring-rules.md` § Grounding.
- `authoringSignals` hint what the record supports; use a consistent vocabulary: `world-rule`, `character-baseline`, `character-state gate`, `secret-knowledge gate`, `status-change gate`, `relationship`, `faction`, `place-state`, `timeline-anchor`, `anti-lore`.
- Record ids become citation keys: cards cite `<scope>/<recordId>` in `sourceInfo.evidenceRefs`.
- `deckId` (optional, lowercase slug) marks a file's evidence as belonging to one specific deck of a multi-deck project. When set, `report --stage cards` flags any card in a *different* deck that cites one of this file's accepted records as a cross-deck citation (a distinct, non-blocking warning class from missing/unaccepted refs). Leave it unset for evidence any deck in the project may cite — this is the common case and never produces a warning.

## Sourcing

- **user_supplied**: notes, summaries, or excerpts the user provides. Preferred when web access is limited or the canon is a single book the user knows well. Never reproduce long copyrighted passages into evidence — record facts, short quotes only.
- **web**: wiki/reference research (subagents fan out per scope). Always record the exact provenance URL and retrieval date. Prefer established fandom wikis; note contested facts as contested.

### Fandom wiki sources

For canons hosted on a fandom.com wiki, `scripts/fetch_fandom.py` pulls a page's rendered text via the site's MediaWiki API (`action=parse`) and strips it to clean plain text — more reliable than scraping the rendered HTML page by hand, and it follows redirects automatically.

```
python scripts/fetch_fandom.py <wiki-subdomain> <page_title>
# e.g. python scripts/fetch_fandom.py dragonlance List_of_Dragonlance_deities
```

Requires only `requests` (stdlib otherwise). Treat its output as raw material for evidence records, not evidence itself — still extract discrete, source-grounded `facts` per the shape above, and record the page URL and retrieval date in `provenance`.

The Fandom helper prints at most 3,000 characters and writes a warning to stderr when it truncates a longer page. A truncation warning means the output is only a partial research view; use the provenance URL to review the complete source before accepting evidence.

### PDF sources

When a source is a PDF, extract text before drafting evidence — don't transcribe from a viewer by eye.

1. Try `pypdf` first. If it raises `DependencyError: cryptography>=3.1 is required`, the PDF is encrypted (commonly AES) — `pip install cryptography` and retry; pypdf decrypts transparently once the dependency is present. This is a pure-Python wheel, installable with `pip install --user` even without root.
2. If `pypdf`'s extracted text is garbled (font-encoding/OCR noise — broken ligatures, dropped spaces, random symbol substitutions), fall back to `pdftotext -layout` (poppler-utils) if it's available — it preserves column/table structure better than either default-mode `pdftotext` or `pypdf`.
3. **No root / can't install system packages?** `pdftotext` needs poppler-utils via the system package manager, which is a dead end in locked-down sandboxes. Try `pdfminer.six` instead (`pip install --user pdfminer.six`, then `python -m pdfminer.high_level PDF_PATH`) — also pure-Python, no root required, and often cleaner than `pypdf` on layout-heavy PDFs.
4. If nothing produces clean text, extract what you can and **record the extraction quality in the evidence file's `provenance`** (e.g. `"extractionQuality": "ocr-noisy"` or a note in `provenance.title`) rather than silently treating noisy text as ground truth — a low-confidence fact should read as one downstream.

**If you're fanning out to research subagents for a large PDF source, run this extraction once yourself first.** Hand each subagent its assigned slice of the already-extracted plain text, not the PDF — a subagent paging through a PDF itself (one tool call per page) will exhaust its budget before writing anything. See `references/subagent-playbook.md`.

## Review

`evidence validate <id>` regenerates `reviews/evidence.md` (file table + record table with statuses). The user accepts or rejects records — `evidence accept|reject <id> --scope S --ids a,b|--all [--note]`. Only accepted records may back cards; `report --stage cards` flags any card citing rejected/unknown records or citing nothing.
