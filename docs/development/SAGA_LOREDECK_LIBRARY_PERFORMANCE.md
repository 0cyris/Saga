# Loredeck Library performance

Deck badges use only the deck's cached health report. Library records, settings, stack, registry, folder index, health summaries, and stats are reused within each synchronous refresh. The snapshot is released in finally, so later edits, scans, hydration, and chat changes read fresh data. Manual sorting indexes placements once per sort.

Selection updates highlights, actions, and changed details. Stack mutations update the stack pane and hierarchy without replacing the overlay. Search and view changes preserve unchanged stack controls and details. Export actions resolve the current selection when invoked.

Large lists construct at most 40 rows or approximately 8 ms of row work per batch, then yield through a timer. Expansion counts both folders and decks before choosing the small synchronous path. Closing or replacing a list cancels pending work. Scroll restoration continues as rows become available; user pointer, wheel, touch, or keyboard input cancels it.

CSS content-visibility: auto skips offscreen layout and painting. The complete logical order remains available for range selection during batching. Rows remain in the DOM after rendering, preserving keyboard, drag, and browser find behavior. This is incremental construction and offscreen containment rather than a fixed-size DOM window.

## Verification

- node tools/scripts/test-loredeck-library-performance.mjs
- node tools/scripts/test-loredeck-library-browser-performance.mjs
- node tools/scripts/run-alpha-gate.mjs

The browser test requires Playwright and Chromium. SAGA_PLAYWRIGHT_PATH can point to Playwright's index.mjs; SAGA_CHROME_PATH selects an executable. Its local server and headless browser are closed at completion.

Node coverage includes shipped Library normalization, zero whole-Library reads from deck/folder summaries, fresh snapshots after cache changes or errors, and indexed manual sorting. Browser coverage includes selection/stack DOM preservation, current-selection actions, 1,000-deck batching and range selection, deep scroll, cancellation, mobile expansion, 1,000 empty child folders, and clearing old folder details on view changes.

Controlled local measurements: the 77-deck health-summary probe fell from about 3.25 seconds and 308 whole-Library reads to about 0.6 ms and zero reads. The 18-folder model fell from about 7.2 seconds and 616 reads to about 2 ms and zero reads. A synthetic 1,000-deck browser initial render fell from about 234 ms for all cards to about 23 ms for the first batch. These are isolated development measurements rather than live-session guarantees.
