# Saga Lore Automation Live Evaluation Log

Append live SillyTavern + real-provider Lore Automation test results here. Keep entries short, evidence-backed, and tied to report files.

## 2026-06-15 - Story2 bounded matrix iteration

Report: `assets/documentation/renders/saga-smoke/live-lore-automation-iteration-report.json`

Command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='tail,curation-gap,retirement-overload'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armp:balanced:utility;armpc:balanced:reasoning;armpc:balanced:reasoning:curation'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-iteration-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Result:

- Final rerun passed with `ok: true`, `findings: []`, `errors: []`, `totalProviderCalls: 10`, and `saveCallCount: 0`.
- `tail` proved ARMP Utility and ARMPC Reasoning remap paths can pin relevant cards without curation candidates.
- `curation-gap` proved ARMPC full and curation-only paths can accept active-deck cards after the probe removes matching accepted cards.
- `retirement-overload` proved ARMPC full and curation-only paths can retire stale automation-owned cards; ARMP Utility correctly used mute/pin remapping without deleting.

Bugs found and fixed:

- False positive: curation-only runs with no new active-deck candidates and no stale retirement candidates were failing for recording zero provider calls. The harness now requires provider calls only when curation candidates exist.
- Report observability gap: full-pass rows truncated `lastRun.operations` before curation/remap operations appeared. Reports now include `lastRun.automationOperations` with filtered pin, mute, accept, and retire operations.

Observed but not changed:

- One transient dynamic-import failure occurred for the installed `auto-relevance.js` module. The module URL returned 200, the installed file matched the repo, syntax checks passed, and an immediate retry succeeded, so no code change was made for this unless it repeats.

## 2026-06-15 - Story2 scene-edge style sweep

Report: `assets/documentation/renders/saga-smoke/live-lore-automation-scene-edge-report.json`

Command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='east-cloister,malfoy-manor'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armp:balanced:utility;armpc:careful:reasoning;armpc:aggressive:reasoning'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-scene-edge-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Result:

- Passed with `ok: true`, `findings: []`, `errors: []`, `totalProviderCalls: 6`, and `saveCallCount: 0`.
- `east-cloister` and `malfoy-manor` both completed ARMP Utility, ARMPC Careful Reasoning, and ARMPC Aggressive Reasoning full-pass runs.
- Careful stayed conservative (`3-4` relevance changes, `1` pin), while Aggressive applied more changes (`10-22` relevance changes, `3` pins).
- No new active-deck curation happened because the report preview showed `newCount: 0`; the relevant active-deck cards were already accepted in Story2.

Bugs found and fixed:

- None in this sweep.

## 2026-06-15 - Story2 curation style-isolation sweep

Report: `assets/documentation/renders/saga-smoke/live-lore-automation-style-curation-report.json`

Command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='curation-gap,retirement-overload'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armpc:careful:reasoning:curation;armpc:aggressive:reasoning:curation'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-style-curation-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Result:

- Final rerun passed with `ok: true`, `findings: []`, `errors: []`, `totalProviderCalls: 4`, and `saveCallCount: 0`.
- `curation-gap` now differentiates by style: Careful accepted `1` active-deck card, while Aggressive accepted `2` active-deck cards.
- `retirement-overload` still differentiates by style: Careful retired `1` stale automation-owned card, while Aggressive retired `3`.
- The installed SillyTavern extension copy was updated before the rerun so the live provider smoke exercised the patched `auto-relevance.js`.

Bugs found and fixed:

- Style policy gap: ARMPC curation sent the same conservative instruction to the reasoner for Careful and Aggressive, so the first style-isolation run accepted the same single card in both modes. The curator prompt now includes explicit style policy, action guidance, caps, thresholds, target stack bounds, and stale-pass policy in the provider payload.
- Regression coverage: `test-lore-automation-levels.mjs` now checks the style prompt policy semantics, and `test-visual-smoke-harness.mjs` asserts that ARMPC provider prompts keep the style-policy payload.

## 2026-06-15 - Story2 full ARMPC style sweep

Reports:

- Full sweep: `assets/documentation/renders/saga-smoke/live-lore-automation-style-full-report.json`
- Targeted fix rerun: `assets/documentation/renders/saga-smoke/live-lore-automation-aggressive-retirement-report.json`

Command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='curation-gap,retirement-overload'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armpc:careful:auto;armpc:balanced:auto;armpc:aggressive:auto'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-style-full-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Targeted rerun command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='retirement-overload'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armpc:aggressive:auto'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-aggressive-retirement-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Result:

- Full sweep passed harness-level checks with `ok: true`, `findings: []`, `errors: []`, `totalProviderCalls: 11`, and `saveCallCount: 0`.
- `curation-gap` full passes accepted active-deck cards across Careful, Balanced, and Aggressive with auto routing, proving ARMPC can mix Utility remapping and Reasoning curation in a full run.
- The first full sweep exposed a product bug in `retirement-overload:armpc-aggressive-auto-full`: Utility remapping muted all stale automation-owned cards before ARMPC curation scanned for retirements, so the row recorded `providerStatus: "utility"` and `retired: 0` despite `staleCount: 8`.
- After the fix, the targeted rerun passed with `ok: true`, `totalProviderCalls: 2`, `providerStatus: "utility/reasoning"`, `muted: 8`, and `retired: 3`.

Bugs found and fixed:

- ARMPC retirement eligibility was incorrectly tied to pin/mute state. Since manual protection is the per-card Lore Automation toggle, not pin/mute, the retirement scanner now considers automation-owned stale cards even if ARMP already pinned or muted them in the same full pass.
- Regression coverage: `test-lore-automation-levels.mjs` now covers an automation-owned stale card that is already muted and verifies ARMPC can still retire it.

## 2026-06-15 - Story2 ARMP Utility style sweep

Reports:

- Full sweep: `assets/documentation/renders/saga-smoke/live-lore-automation-armp-style-report.json`
- Diagnostics rerun: `assets/documentation/renders/saga-smoke/live-lore-automation-armp-remap-diagnostics-report.json`

Command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='tail,east-cloister,malfoy-manor'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='armp:careful:utility;armp:balanced:utility;armp:aggressive:utility'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-armp-style-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Result:

- Full sweep passed with `ok: true`, `findings: []`, `errors: []`, `totalProviderCalls: 9`, and `saveCallCount: 0`.
- ARMP Utility acted across all three Story2 scene windows. Careful stayed narrow (`3-4` relevance changes, `0-1` pins), Balanced was midrange (`3-15` relevance changes, `1-2` pins), and Aggressive applied the broadest remap/relevance set (`10-22` relevance changes, `3` pins).
- No mute behavior appeared in the scene-edge sweep because the scenarios had no stale low-relevance pressure without the retirement probe. Mute behavior remains covered by the retirement-overload ARMPC full sweep.
- The diagnostics rerun passed with `ok: true`, `totalProviderCalls: 3`, and `saveCallCount: 0`; it confirmed the new `diagnostics.remapPreview` report field records pre-provider ARMP candidates and explains accepted/declined remap operations.

Bugs found and fixed:

- No ARMP behavior bug was found in this sweep.
- Test-loop observability gap: ARMP reports did not show whether a no-remap row had zero local candidates or whether the Utility Provider declined available candidates. The live report now includes `diagnostics.remapPreview` and adds quality notes when provider-backed ARMP sees candidates but applies no pin/mute changes.

## 2026-06-15 - Story2 Level 1 Off/AR sweep

Reports:

- Local baseline: `assets/documentation/renders/saga-smoke/live-lore-automation-ar-local-baseline-report.json`
- Initial Utility model pass: `assets/documentation/renders/saga-smoke/live-lore-automation-ar-utility-model-report.json`
- Error-reporting rerun: `assets/documentation/renders/saga-smoke/live-lore-automation-ar-utility-rerun-report.json`
- Targeted fixed rerun: `assets/documentation/renders/saga-smoke/live-lore-automation-ar-utility-aggressive-fixed-report.json`

Local baseline command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='tail,malfoy-manor'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='off:balanced:local;ar:careful:local;ar:balanced:local;ar:aggressive:local'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_AR_MODEL='0'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-ar-local-baseline-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Utility model command shape:

```powershell
$env:SAGA_SMOKE_TARGET='live-lore-automation'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_LIVE_LORE_AUTOMATION_SCENARIOS='tail,malfoy-manor'
$env:SAGA_LIVE_LORE_AUTOMATION_MATRIX='ar:careful:utility;ar:balanced:utility;ar:aggressive:utility'
$env:SAGA_LIVE_LORE_AUTOMATION_MESSAGE_LIMIT='20'
$env:SAGA_LIVE_LORE_AUTOMATION_TIMEOUT_MS='300000'
$env:SAGA_LIVE_LORE_AUTOMATION_AR_MODEL='1'
$env:SAGA_SMOKE_REPORT='assets/documentation/renders/saga-smoke/live-lore-automation-ar-utility-model-report.json'
node tools/scripts/smoke-live-st-cdp.mjs
```

Result:

- Local baseline passed with `ok: true`, `findings: []`, `errors: []`, `totalProviderCalls: 0`, and `saveCallCount: 0`.
- Off mode was inert in both Story2 windows. AR local changed only relevance tiers and did not pin, mute, accept, or retire cards.
- Initial Utility model pass spent `6` real provider calls. Tail rows and Malfoy Careful completed through `modelStatus: "model"`, but Malfoy Balanced and Aggressive fell back to local with `model_failed`.
- Error-reporting rerun confirmed Malfoy Aggressive failed with `modelError: "No message generated"`.
- After shrinking the AR Utility model packet, the targeted Malfoy Aggressive rerun passed with `ok: true`, `totalProviderCalls: 1`, `modelStatus: "model"`, `modelError: ""`, `changed: 11`, and `saveCallCount: 0`.

Bugs found and fixed:

- Harness false positive: all-local/off matrices were failing because the live smoke required at least one provider call for every opt-in run. The harness now requires provider calls only for rows that actually expect provider work.
- Report clarity gap: provider failure findings showed the row status (`changed`) instead of the failing subsystem. Findings now report `model_failed` and include `modelError`; live reports include `modelError` on AR results.
- AR Utility packet brittleness: the live harness sent roughly 51k user chars for AR model adjudication, and the Utility provider intermittently returned `No message generated`. AR model candidate packets are now smaller: the default candidate cap is `20`, the runtime clamp is `40`, candidate summaries are shorter, and the live harness uses `20` candidates with `5000` recent chars.
- Installed-extension sync gap: the installed ST copy had the updated `auto-relevance.js` but was missing its new `lore-selection.js` dependency, causing dynamic import failures. The missing dependency was copied into the installed extension, and the live harness now retries dynamic imports for transient fetch races.

## 2026-06-15 - Story2 cadence, manual-protection, and ARMPC curation iteration

Reports:

- ARMP cadence pass: `assets/documentation/renders/saga-smoke/live-lore-automation-tail-armp-report.json`
- AR baseline plus manual-protection pass: `assets/documentation/renders/saga-smoke/live-lore-automation-tail-baseline-manual-report.json`
- ARMPC curation-gap auto/reasoning failure: `assets/documentation/renders/saga-smoke/live-lore-automation-curation-gap-report.json`
- ARMPC curation-gap Utility control: `assets/documentation/renders/saga-smoke/live-lore-automation-curation-gap-utility-report.json`

Result:

- Focused local contract initially passed after restoring the ARMP pin contract, but another active Codex/Node writer repeatedly reverted `src/lorecards/lore-automation.js`, `tools/scripts/test-lore-automation-levels.mjs`, and parts of `src/context/auto-relevance.js` back to the stale mute-only ARMP contract during the loop.
- Installed-extension sync was verified for the Lore Automation runtime files before live testing.
- ARMP Balanced Utility cadence passed with `ok: true`, `findings: []`, `totalProviderCalls: 1`, `changed: 15`, and `pinAdded: 2`. The cadence API returned `scheduled`, while the actual applied run was captured in `lastRun`.
- AR local `cadence-wait` correctly remained waiting with `0` provider calls and `0` changes.
- The original `cadence-manual` row was a bad harness scenario: it set global cadence mode to manual, then expected background automation to run. The harness now treats that token as a manual-protection probe: it disables Lore Automation on one remap candidate, runs explicit automation, and fails if that card's relevance, pinned, muted, or enabled state changes.
- The repaired manual-protection row passed with `ok: true`, `totalProviderCalls: 1`, `changed: 14`, `pinAdded: 1`, and the protected card unchanged.
- ARMPC curation-gap with `auto` routed to the Reasoning provider (`zai-org/glm-5.1:thinking`) and failed with `model_failed` / `No message generated` after one provider call. It removed four accepted active-deck cards from the fixture copy and correctly exposed those four as new candidates, but accepted none because the provider returned no usable message.
- ARMPC curation-gap with Utility routing passed with `ok: true`, `totalProviderCalls: 1`, `status: curated`, and `accepted: 2`. The Utility model selected high-value Year 6 guardrail cards, confirming the curation candidate set and apply path were sound.

Bugs found and fixed:

- Harness false negative: `cadence-manual` conflated global manual cadence with per-card manual protection. It now runs an explicit automation pass with a disabled card probe and validates that card-level protection is honored.
- Compact console report gap: manual-protection probes now include protected card id/title/operation and preview candidate count in the compact report, while the full JSON already retained those details.
- ARMPC auto-routing brittleness was identified: Reasoning can return no message for a curation prompt that Utility handles successfully. A narrow fallback was drafted in `adjudicateCurationWithModel`: when routing is `auto` and Reasoning fails or returns malformed JSON, retry through Utility; explicit `reasoning` routing should still surface the failure.

Open blocker:

- The source tree is currently racing with other Codex/Node kernels in `F:\git\Saga`; process inspection showed multiple active Codex command runners and Node kernels using the same working directory. The fallback and ARMP pin-contract restoration need a clean rerun after the competing writer is paused or terminated.
