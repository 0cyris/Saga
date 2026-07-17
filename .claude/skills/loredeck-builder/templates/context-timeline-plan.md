# Context & Timeline Plan: <Canon>

*This plan is written before any anchors, windows, or cards exist. It decides the timeline axis, the durable anchors, the spoiler windows, and the tag vocabulary for each deck. One subsection per deck. Cards and `timeline.json` are built from what is decided here.*

## Deck: <deck-id>

### Timeline axis / mode

*State the `timelineMode` (e.g. `story_anchor`) and the axis Context is measured in, and justify it from the Story-coordinate model in the scope brief. Say whether sort follows narrative reveal order or in-universe chronology, and how flashbacks are handled.*

- Mode: *e.g. `story_anchor` — no in-world calendar, so anchors are named story points, not dates.*
- Axis: *e.g. book + chapter, sorted by narrative reveal order.*
- Rationale: *e.g. the text uses flashbacks heavily; sorting by reveal order keeps spoilers gated to when the reader learns them.*

### Key anchors

*List the durable, high-value waypoints only — starts/ends, reveals, irreversible changes, before/after pivots. Prefer few strong anchors over one per minor fact. `sortKey` is monotonic along the chosen axis; explain the spacing so later inserts have room.*

| anchor id | label | what story point | sortKey rationale |
| --- | --- | --- | --- |
| `canon.book1.arrival` | Arrival at Ravenhold | Book 1 Ch. 1 — Mara enters the garrison; canon begins | 1000 — first anchor; leave a gap below for any prologue insert |
| `canon.book1.sethe-reveal` | Sethe's betrayal revealed | Book 1 Ch. 14 — the hard spoiler pivot | *e.g. 5000 — spaced well above arrival so mid-book anchors fit between* |
| `canon.book1.siege-end` | End of the Siege | Book 1 finale — arc closes, status quo breaks | *e.g. 8000 — ends the Book 1 window* |

### Windows (eras / spoiler boundaries)

*Define the windows that gate cards. Each window is bounded by anchor ids (`validFromAnchor`/`validToAnchor`) and must be broad enough to select but narrow enough to keep spoilers gated. Name what each window protects.*

- *`arc:pre-reveal` — from `canon.book1.arrival` to just before `canon.book1.sethe-reveal`; protects the betrayal secret.*
- *`arc:post-reveal` — from `canon.book1.sethe-reveal` onward; unlocks Sethe's true-loyalty cards.*
- *`era:book1` — full Book 1 span (`arrival` → `siege-end`) for era-scoped entities.*

### Tag vocabulary plan (namespaces used)

*List the tag namespaces this deck uses and the intended values, kept consistent with the shared family vocabulary (the core deck's `tags.json` is the reference). Every tag must later be defined in `tags.json` with a label. No decorative tags — each exists for retrieval, filtering, or health.*

- `fandom:` — *e.g. `fandom:founding-trilogy` (one deck-wide fandom tag).*
- `character:` — *e.g. `character:mara-venn`, `character:warden-sethe`.*
- `place:` — *e.g. `place:ravenhold-keep`.*
- `faction:` — *e.g. `faction:wardens-order`, `faction:ashen-pact`.*
- `arc:` / `era:` — *e.g. `arc:the-siege`, `era:book1` (mirror the window names above).*
- `secret:` — *e.g. `secret:sethe-loyalty` (used only on gated reveal cards).*
