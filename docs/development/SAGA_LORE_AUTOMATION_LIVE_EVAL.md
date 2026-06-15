# Saga Lore Automation Live Evaluation Loop

This loop runs the installed Saga extension inside real SillyTavern through the CDP smoke harness, seeds the latest `Story2` chat fixture into the live browser context, spends explicit provider calls, and writes a JSON report that Codex can use for iterative tuning.

## Default Run

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
node tools/scripts/smoke-live-st-cdp.mjs
```

Default fixture:

- Data dir: `F:\SillyTavern\SillyTavern\data\default-user`
- Chat folder: `chats\Story2`
- Chat file: latest `.jsonl` in that folder
- Message window: latest 20 real Story2 messages
- Active deck fallback: `hp-year-6-half-blood-prince`
- Persistence: off by default. The harness overrides `saveMetadata` and `saveSettingsDebounced`, then restores the live chat array, Saga metadata, and Saga settings.

Default matrix:

- `ar:balanced:local`
- `armp:balanced:auto`
- `armp:aggressive:utility`
- `armpc:careful:auto`
- `armpc:balanced:auto`

Report path defaults to `assets/documentation/renders/saga-smoke/live-lore-automation-report.json`.
The console prints a compact summary; inspect the report file for full provider-call metadata, diffs, diagnostics, and operation journals.

## Broader Sweeps

```powershell
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='tail,east-cloister,malfoy-manor,curation-gap,retirement-overload'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='ar:balanced:local;armp:careful:utility;armp:balanced:utility;armpc:careful:reasoning;armpc:balanced:reasoning;armpc:aggressive:reasoning'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='30'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
node tools/scripts/smoke-live-st-cdp.mjs
```

Recommended first ARMPC capability pass:

```powershell
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='tail,curation-gap,retirement-overload'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armpc:balanced:reasoning'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
node tools/scripts/smoke-live-st-cdp.mjs
```

Scenario probes:

- `tail`: latest Story2 message window with the real accepted stack.
- `east-cloister`: same chat tail with the current East Cloister scene reinforced.
- `malfoy-manor`: same chat tail with Malfoy Manor pressure reinforced.
- `curation-gap`: removes a small number of top matching accepted active-deck cards in memory, then verifies whether ARMPC can add them back from the active deck.
- `retirement-overload`: scores unpinned Story2 accepted cards, marks selected cards as automation-owned in memory, primes stale evidence, and neutralizes their scope/date in memory only when needed to produce true stale retirement candidates. The report records `forceStaleCount` and `neutralizedForProbe`.

Useful overrides:

- `SAGA_LIVE_LORE_AUTOMATION_CHAT_FILE`: exact Story2 JSONL file.
- `SAGA_LIVE_LORE_AUTOMATION_CHAT_DIR`: alternate chat folder.
- `SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT=0`: pass the full chat to the live page.
- `SAGA_LIVE_LORE_AUTOMATION_CURATION_GAP_COUNT=4`: number of matching accepted active-deck cards to remove for the curation-gap probe.
- `SAGA_LIVE_LORE_AUTOMATION_RETIREMENT_PROBE_COUNT=8`: number of existing Story2 cards to mark automation-owned for the retirement-overload probe.
- `SAGA_LIVE_LORE_AUTOMATION_AR_MODEL=1`: also let AR use model adjudication.
- `SAGA_LIVE_LORE_AUTOMATION_PERSIST=1`: allow real save calls. Use only for a dedicated persistence pass.
- `SAGA_SMOKE_REPORT`: explicit report output path.

## Iteration Contract

For each scenario and matrix entry, inspect:

- `status`, `result.modelStatus`, and `result.providerStatus`.
- `providerCallCount` and `providerCalls`.
- `diff.counts` for accepted, retired, relevance, pin, and mute changes.
- `diff.accepted`, `diff.retired`, `diff.relevanceChanges`, `diff.pinAdded`, and `diff.muteAdded`.
- `scenarioProbe` for any in-memory setup the harness applied before automation ran.
- `diagnostics.stackPressure` and `diagnostics.preview` for candidate/pressure evidence before the run.
- `lastRun.operations` for the run journal evidence that users can later inspect or undo.

Treat these as tuning signals:

- Provider path unavailable or malformed: fix provider routing, prompt shape, or response parsing before tuning thresholds.
- No provider calls recorded in a provider-backed matrix: the candidate gate is too narrow, the scenario lacks active-deck/context pressure, or the route fell back to local unexpectedly.
- ARMPC accepts too many broad cards: tighten curation prompt language, candidate packing, or target caps.
- ARMPC accepts nothing despite clear current-scene pressure: improve scene/context seeding, coverage lanes, or candidate ranking before raising caps.
- ARMP pins/mutes unrelated cards: inspect local score reasons and model operations before changing thresholds.
- ARMP never acts: verify local remap candidates exist before blaming the Utility Provider.

The goal is not just a green run. The goal is a repeatable report that explains what Lore Automation did, which provider paths were exercised, and which tuning change should be tried next.
