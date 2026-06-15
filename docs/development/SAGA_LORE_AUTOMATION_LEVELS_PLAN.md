# Saga Lore Automation Levels Plan

Status: Target architecture plan for the next Lore Automation revision. Initial implementation work exists, but this document defines the desired product and engine behavior going forward.

This plan defines the next-generation Lore Automation system for Saga. It expands the current Auto-Relevance pass into a compact, cockpit-style automation feature that can keep Accepted Lorecards fresh without exposing a wall of brittle tuning controls.

## Purpose

Saga needs lore automation that feels powerful in the background but remains understandable at a glance.

The user should not need to understand every scoring threshold, candidate cap, prompt depth, model adjudication rule, or context gate to operate the system. They should be able to choose the automation level quickly, see whether the system is working, override individual Lorecards when needed, and recover from a bad automation run.

The product target is:

```text
Mode -> Status -> Per-card override -> Run history -> Undo
```

The implementation target is:

```text
Deterministic hard gates first.
Broad multi-lane recall second.
Optional model semantic adjudication third.
Validated, capped, reversible operations last.
Narrative movement cadence determines when the workflow is due.
```

## User-Facing Modes

The visible mode selector should use short cockpit labels. Documentation and tooltips carry the expanded meaning.

| Mode | Tooltip | Automation Authority |
| --- | --- | --- |
| `Off` | Lore Automation disabled | No background lore automation. Manual controls still work. |
| `AR` | Auto-Relevance | Promotes and demotes Accepted Lorecards between High, Normal, and Low. |
| `ARMP` | Auto-Relevance, Muting, Pinning | AR plus automatic mute, unmute, pin, and unpin actions for eligible cards. |
| `ARMPC` | Auto-Relevance, Muting, Pinning, Curating | ARMP plus active-deck curation: accepting newly relevant Lorecards and retiring stale automation-owned cards. |

The UI should not spell out these acronyms inline beyond tooltip text. Users who want the deeper meaning can read documentation.

## Relationship To Existing Automation Mode

Saga already has a Session-level Automation Mode for whether runtime actions run only when clicked or automatically after roleplay turns.

Lore Automation is a separate, narrower control:

- Session Automation Mode decides **when Saga runs background workflows**.
- Lore Automation Mode decides **what authority Saga has over Lorecards when the lore automation workflow runs**.

Do not merge these concepts in the UI or data model. A user can have Saga Session automation enabled while Lore Automation is `Off`, or can manually click `Run Now` while Lore Automation is `ARMP`.

The cockpit should make this clear through placement and copy:

- Session automation belongs in Session.
- Lore Automation belongs in Lorecards.
- Status messages can mention when Session automation is needed for automatic cadence, but the Lore Automation mode selector should not become a global runtime automation selector.

## Product Principles

### Keep The Cockpit Small

The primary Lore Automation surface should expose only the operational controls a user needs in the moment:

- Mode: `Off`, `AR`, `ARMP`, `ARMPC`.
- Style preset: `Careful`, `Balanced`, `Aggressive`.
- Cadence: `Auto` by default; optional Advanced pacing presets can tune responsiveness without exposing raw counters.
- Status: ready, paused, needs Context, provider unavailable, last run summary.
- Actions: `Run Now`, `Pause`, `Undo Last Run`, `Review Activity`.

Avoid exposing raw implementation controls in the main panel:

- Candidate cap.
- Confidence threshold.
- Recent message character limit.
- Model token cap.
- Raw turn counters, word thresholds, remap timers, or curation timers.
- Low-level scorer weights.

Those can exist under an Advanced diagnostics/tuning section if needed, but the default experience should be mode and status driven.

### Automation Means Action

Lore Automation is an autonomous controller, not a suggestion workflow.

All enabled Styles should act when the selected Mode permits an operation. `Careful` must not mean "mark for review"; it means "make fewer, stricter, more defensible changes per pass." Activity views explain what happened after the run. They should not become the primary approval queue.

The capability boundary still belongs to Mode:

- `AR` can only promote or demote relevance.
- `ARMP` can also pin, unpin, mute, and unmute.
- `ARMPC` can also accept from active decks and retire stale automation-owned cards.

The Style boundary is per-pass assertiveness, not whether automation is allowed to automate.

### Cadence Is Narrative Movement

Turn count is not a reliable clock. Some users write a chapter-length message; others write several short exchanges. Lore Automation should run when enough narrative movement has accumulated, or sooner when Saga has strong structured evidence that the scene or stack changed.

The robust cadence model is:

```text
Run when:
  authoritative app event
  OR accumulated story budget is reached
  OR local stack pressure is outside target bands
  OR optional Utility edge classifier reports a high-confidence hard edge
```

Session Automation still decides whether background workflows may run automatically. Lore Automation cadence decides whether the lore workflow is due when a safe run boundary is available. `Run Now` bypasses the due-state check.

Cadence must not be a Style property. If the user chooses `ARMPC` with `Balanced`, changing to `Aggressive` should make each due pass more assertive, not secretly run the workflow more often.

The baseline clock should be accumulated story text:

- Track words or tokens since last remap.
- Track words or tokens since last curation.
- Keep separate meters for remap and curation because curation is heavier.
- Coalesce multiple triggers into one pending run.
- Do not run during generation.
- Enforce a minimum movement delta unless a hard app event or urgent stack pressure fires.

Authoritative app events should trigger or invalidate cadence locally:

- Context Workbench applies a new context, window, or anchor.
- Active Loredeck stack changes.
- Accepted Lorecard stack changes.
- User changes scene date, canon boundary, location, current activity, present characters, or nearby characters.
- New chat/session starts.

Do not hard-code a large bank of transition phrases. Prose-based scene movement is exactly the case where deterministic phrase matching becomes brittle. If semantic edge detection is needed, use the Utility Provider as an advisory classifier only. The classifier can pull a run forward when confidence is high, lower the remaining story budget when confidence is medium, and do nothing when confidence is low or unavailable. It must never directly curate or mutate Lorecards.

### Per-Card Automation Ownership Beats Global Protection UI

Do not create a bulky "protection" settings block.

Each Accepted Lorecard should have a small corner icon that indicates whether Lore Automation is enabled for that card.

Recommended states:

- Automation enabled: Saga may modify the card according to the active global mode.
- Automation disabled: manual changes are protected; automation skips this card.

Manual changes should automatically disable Lore Automation for that card. Re-enabling the icon makes the card eligible for the next automation pass. The toggle should not immediately mutate the card.

Manual changes include:

- Relevance changes.
- Pin or unpin.
- Mute or unmute.
- Content edits.
- Metadata edits that affect retrieval, gating, or injection.
- User-authored manual notes, unless accepted through an explicit automation flow.

Bulk actions should exist for selected or filtered cards:

- Enable Lore Automation.
- Disable Lore Automation.
- Enable Lore Automation for filtered cards.
- Disable Lore Automation for filtered cards.

The mental model is:

```text
Icon on: Saga may manage this card.
Icon off: the user owns this card.
```

### Background Process, Not Hidden Process

ARMPC should feel like a background curator in the happy path. It can quietly keep the accepted stack fresh while the user roleplays.

It must not be hidden, irreversible, or untraceable.

Every run should produce:

- A compact visible summary.
- A durable run journal.
- Per-action reasons.
- Enough before/after data to undo the run.

The default UI can stay quiet:

```text
Lore Automation: ARMPC
Last run: 3 accepted, 5 promoted, 2 pinned, 4 muted, 1 retired
```

Detailed reasons belong in `Review Activity`, card details, injection audit, and Lore Timeline.

### Local Hard Gates, Model-Assisted Recall

Local scoring should not be the only discovery mechanism.

The current Auto-Relevance scorer is useful as a fast evidence generator, but a single hand-weighted score is brittle when the system needs to find subtle Lorecards that do not share obvious keywords with recent chat. This matters most for ARMPC, where the job is not merely "rank accepted cards" but "notice which active-deck cards should enter the working set."

Style must not make discovery shallow. `Careful`, `Balanced`, and `Aggressive` should all use the same recall-oriented discovery funnel. They differ in how much action the system is allowed to take after discovery.

The durable split should be:

```text
Local hard gates
  -> broad multi-lane candidate gathering
  -> diverse bounded packet construction
  -> model semantic classification/rerank
  -> deterministic validation
  -> capped apply
```

Keep these local and deterministic:

- Active stack enabled/disabled state.
- Context window and branch eligibility.
- Duplicate detection against Pending Review and Accepted Lorecards.
- Per-card Lore Automation enabled/disabled state.
- Mode legality.
- Per-run operation caps.
- Undoability.

Do not rely only on local keyword, scope, or date scoring for discovery. Candidate gathering should use multiple lanes:

- Direct keyword, scope, and recent-message matches.
- Context-window-eligible cards from active decks, even without keyword hits.
- High-priority or high-specificity cards near the current Context.
- Cards tied to present characters, nearby characters, locations, objects, spells, factions, or active tags.
- Cards near neighboring timeline anchors or windows.
- Recently injected, recently muted, recently pinned, or recently automation-touched cards.
- A small rotating exploration sample from eligible active-deck cards, so scorer blind spots do not persist forever.
- Optional model-expanded semantic needs from the current scene, converted back into local candidate lookups rather than direct state mutation.

The model should not search or mutate the whole deck blindly. It should review a compact, diverse, eligible candidate pool, identify subtle semantic matches, classify coverage, and return bounded operations with confidence and reasons.

The target is not "add N cards." The target is coverage:

- Cover current scene constraints without bloating the working set.
- Keep important lanes represented: present characters, location, objective, secrets, knowledge gates, items, abilities, rules, active temporal gates, and high-priority deck anchors.
- Prefer no action over padding the stack with weak cards.
- Retire cards that no longer cover an active lane, but only when deterministic policy says retirement is safe.

### Provider Routing

Provider choice should not be part of the main Lore Automation cockpit. The default should be `Auto`, with internal routing by operation risk.

Recommended routing:

| Decision Type | Default Route |
| --- | --- |
| Obvious AR promote/demote | Local only |
| Borderline or high-impact AR promote/demote | Utility Provider |
| ARMP pin, unpin, mute, unmute | Utility Provider |
| Semantic edge classifier for cadence acceleration | Utility Provider, advisory only |
| ARMPC broad-packet classification and direct auto-accept | Reasoning Provider |
| ARMPC retire from Accepted Lorecards | Reasoning Provider |
| Branch-sensitive conflicts, duplicate semantics, or contradiction checks | Reasoning Provider |

Advanced diagnostics may expose provider routing overrides such as `Auto`, `Utility only`, `Reasoning only`, or `Local only where possible`, but those controls should not appear in the primary panel.

### Confidence Is Not A Single Score

Do not let one scalar score decide every action.

Each proposed operation should carry separate evidence:

- `localConfidence`: how strongly deterministic signals support the operation.
- `semanticConfidence`: how strongly the provider or semantic adjudicator supports it.
- `policyConfidence`: whether the operation is safe under mode, style, ownership, cooldown, and Context rules.
- `finalConfidence`: the bounded result after deterministic validation.

This prevents a strong keyword hit from becoming an unsafe mute, or a confident model answer from bypassing ownership rules. Relevance, pinning, muting, accepting, and retiring are different decisions and should have operation-specific thresholds.

## Mode Behavior

### Off

No automatic changes.

Manual Lorecard controls remain available. Existing prompt injection still uses current relevance, pin, mute, Context gates, and injection settings.

### AR

AR is the current Auto-Relevance authority, but should be renamed and integrated into the broader Lore Automation system.

Allowed operations:

- `promote_relevance`
- `demote_relevance`

Skipped operations:

- Pin.
- Unpin.
- Mute.
- Unmute.
- Accept from active decks.
- Retire from accepted stack.

AR only touches cards with Lore Automation enabled.

### ARMP

ARMP manages the active injection shape.

Allowed operations:

- `promote_relevance`
- `demote_relevance`
- `pin`
- `unpin`
- `mute`
- `unmute`

ARMP only touches cards with Lore Automation enabled.

Recommended behavior:

- Pin only high-confidence cards that currently constrain the next reply.
- Unpin automation-pinned cards when their direct scene value fades.
- Mute cards that are clearly out of Context, expired, contradicted, duplicate, or harmful to current injection.
- Unmute automation-muted cards when they become context-current again.
- Do not use mute as a synonym for "less important right now"; demotion is usually enough.

### ARMPC

ARMPC manages both the active injection shape and the accepted Lorecard collection for the current chat.

Allowed operations:

- All ARMP operations.
- `accept_from_active_decks`
- `retire_from_accepted_stack`
- Potential future `restore_retired`.

ARMPC should treat source Loredecks as the durable library and Accepted Lorecards as the chat's working set.

Recommended behavior:

- Scan enabled active stack entries for Context-eligible Lorecards.
- Gather a broad multi-lane candidate pool so subtle but currently important Lorecards are not missed merely because they lack keyword overlap.
- Use model semantic adjudication to choose high-confidence, non-duplicate cards for direct curation.
- Accept selected cards into the chat's Accepted Lorecards. Pending Review is not the core ARMPC path because the feature promise is automation.
- Default auto-accepted cards to Lore Automation enabled.
- Retire stale automation-owned cards from the accepted working set when they no longer cover current needs.
- Prefer "retire" over destructive delete.
- Never delete source Loredeck content.
- Only permanently delete generated/session lore if the action is explicitly designed, reversible through timeline/history, and clearly scoped.

ARMPC curation should be capped per run so one bad Context read cannot flood or empty the accepted stack. The caps are action budgets, not discovery budgets.

## Style Presets

The Style preset should compile to per-pass assertiveness: action budgets, confidence thresholds, stale-evidence requirements, cooldowns, and target-stack pressure. It must not control cadence, scan depth, or manual protection.

Suggested hidden policy mapping:

| Style | Meaning | Add Budget | Retirement | Cooldown / Evidence |
| --- | --- | --- | --- | --- |
| `Careful` | Acts automatically, but only on very defensible changes | Low | Low; repeated stale evidence required | Long cooldowns |
| `Balanced` | Maintains the stack toward target coverage | Medium | Medium; normal stale evidence window | Moderate cooldowns |
| `Aggressive` | Adapts the working set quickly when the scene changes | Higher but still bounded | Higher; one strong stale signal can be enough | Short cooldowns |

The exact numeric thresholds should remain implementation details unless an Advanced diagnostics panel needs them for debugging.

Hard gates are identical across all Styles:

- Per-card Lore Automation toggle.
- Manual edits disabling card-level automation.
- Pinned cards are not retired.
- Existing Accepted or Pending duplicates are not re-added.
- Source Loredeck content is never deleted by curation.
- `Undo Last Run` remains available for applied changes.
- Cadence is independent of Style.

Style should never mean "scan less carefully." All Styles use broad, diverse candidate discovery. Style decides how much of the validated result can be applied on this pass.

### Careful

Recommended for cautious users and first-time use.

- Applies automatically.
- Smaller per-run caps.
- Conservative pin/mute actions.
- Automatic retirement is allowed, but only for automation-owned cards with repeated stale evidence and no current coverage value.
- May require more stable evidence before changing a card recently touched by automation.
- Longer re-add and replacement cooldowns.

### Balanced

Recommended default once the feature is stable.

- Applies high-confidence local decisions.
- Uses optional model adjudication for high-impact or borderline cases when configured.
- Allows small ARMPC accept/retire batches.
- Protects cards disabled for automation.
- Keeps strong hysteresis to avoid flip-flopping.
- Maintains the automation-owned stack inside target bands without padding with weak cards.

### Aggressive

Recommended for users who want Saga to actively curate the chat.

- Larger per-run caps.
- Faster response to Context shifts per pass.
- More willing to auto-accept and retire automation-owned cards.
- Shorter stale and replacement cooldowns.
- Still respects per-card automation disabled state.

## Data Model

Use a single automation model for all levels. Do not create separate AR, ARMP, and ARMPC state stores.

### Settings

Suggested settings shape:

```js
{
  loreAutomationMode: "off|ar|armp|armpc",
  loreAutomationStyle: "careful|balanced|aggressive",
  loreAutomationPaused: false,
  loreAutomationCadenceMode: "auto",
  loreAutomationPacing: "responsive|normal|relaxed",
  loreAutomationProviderRouting: "auto|utility|reasoning|local",
  loreAutomationRunJournalLimit: 20
}
```

Visible UI labels should remain `Off`, `AR`, `ARMP`, and `ARMPC`; stored values can be lowercase for consistency with existing settings.

`loreAutomationPacing` is an optional Advanced control. It tunes word/token budgets, classifier eagerness, and cooldown defaults. It does not change the selected Mode's authority or the selected Style's per-pass assertiveness.

Existing `autoRelevance*` settings should be migrated or mapped rather than left as a parallel control family. During transition, implementation can keep compatibility readers, but the final user-facing system should have one Lore Automation mode and one Style preset.

Suggested Accepted Lorecard extension:

```js
extensions: {
  loreAutomation: {
    enabled: true,
    enabledAt: 0,
    enabledBy: "migration|manual|automation",
    disabledReason: "",
    disabledAt: 0,
    disabledBy: "",
    lastAction: "",
    lastReason: "",
    lastRunId: "",
    lastTouchedAt: 0,
    lastProvider: "local|utility|reasoning",
    owner: "manual|auto|imported|generated"
  }
}
```

`owner` is about origin. `enabled` is about whether the automation may touch this card. A manually imported card can still be automation-enabled if the user chooses that.

### Manual Change Handling

When a manual edit disables automation for a card, preserve the user-facing reason:

```js
{
  enabled: false,
  disabledReason: "manual_relevance_change|manual_pin_change|manual_mute_change|manual_content_edit|manual_metadata_edit",
  disabledBy: "user",
  disabledAt: Date.now()
}
```

Bulk re-enable should clear `disabledReason`, set `enabled = true`, and record `enabledBy = "manual"`.

Re-enabling should not immediately apply automation. The next scheduled run or `Run Now` handles mutation.

Suggested run journal shape:

```js
state.loreAutomationRuns = [
  {
    id: "run_...",
    mode: "AR|ARMP|ARMPC",
    style: "careful|balanced|aggressive",
    startedAt: 0,
    finishedAt: 0,
    status: "changed|unchanged|paused|failed",
    summary: {
      promoted: 0,
      demoted: 0,
      pinned: 0,
      unpinned: 0,
      muted: 0,
      unmuted: 0,
      accepted: 0,
      retired: 0,
      skipped: 0
    },
    actions: [
      {
        cardId: "",
        operation: "",
        sourceRef: "",
        confidence: 0,
        localConfidence: 0,
        semanticConfidence: 0,
        policyConfidence: 0,
        provider: "local|utility|reasoning",
        reason: "",
        skipped: false,
        skipReason: "",
        before: {},
        after: {}
      }
    ]
  }
]
```

The run journal should be compact and retention-limited, but it must support `Undo Last Run`.

Suggested cadence state:

```js
state.loreAutomationCadence = {
  lastRemapAtMessageId: "",
  lastRemapWordCount: 0,
  lastCurationAtMessageId: "",
  lastCurationWordCount: 0,
  accumulatedRemapWords: 0,
  accumulatedCurationWords: 0,
  lastContextHash: "",
  lastDeckStackHash: "",
  lastAcceptedAutomationHash: "",
  pendingReason: "",
  lastEdgeClassifier: {
    edge: "none|soft_scene_shift|hard_scene_shift|chapter_or_arc_shift",
    confidence: 0,
    changed: [],
    reason: ""
  },
  staleEvidenceByCardId: {},
  cooldownByCardId: {}
}
```

The hashes should be deterministic summaries of structured Saga state, not model output. They let the scheduler detect authoritative app events and stack changes without fragile prose parsing.

## Operation Contracts

All automation actions should be represented as operations with explicit eligibility and validation.

| Operation | Modes | Required Local Proof | Model Role | Reversible State |
| --- | --- | --- | --- | --- |
| `promote_relevance` | AR, ARMP, ARMPC | Card accepted, automation-enabled, injectable by default, not disabled/archived | Optional for borderline/high-impact cases | Previous relevance and metadata |
| `demote_relevance` | AR, ARMP, ARMPC | Card accepted, automation-enabled, not protected by recent manual edit | Optional for stale/ambiguous cases | Previous relevance and metadata |
| `pin` | ARMP, ARMPC | Card accepted, automation-enabled, not muted, Context-eligible | Decide whether card must shape next reply | Previous pinned set and metadata |
| `unpin` | ARMP, ARMPC | Card was automation-pinned or automation-enabled and no longer critical | Decide whether pin is no longer justified | Previous pinned set and metadata |
| `mute` | ARMP, ARMPC | Card accepted, automation-enabled, not manually pinned, clear exclusion reason | Decide whether card should stop influencing prompt | Previous muted set and metadata |
| `unmute` | ARMP, ARMPC | Card was automation-muted and is now eligible/current | Decide whether it should return to influence | Previous muted set and metadata |
| `accept_from_active_decks` | ARMPC | Source deck enabled, Context-eligible, not duplicate, source reference stable | Decide whether card belongs in working set | Accepted insertion and source ref |
| `retire_from_accepted_stack` | ARMPC | Card automation-owned, automation-enabled, not pinned, stale under policy, restorable | Decide whether retirement is safe | Accepted removal/archive state |

The validator should reject operations that lack required local proof, even if the provider recommends them.

## Evidence Packet Contract

Local scoring should emit structured evidence packets. Providers should receive these packets, not raw unbounded state.

Suggested compact candidate packet:

```js
{
  candidateId: "accepted:card_id|deck:pack_id:card_id",
  cardId: "card_id",
  source: "accepted|active_deck|pending_review",
  title: "",
  compactFact: "",
  injectionText: "",
  currentState: {
    relevance: "high|normal|low",
    pinned: false,
    muted: false,
    automationEnabled: true,
    owner: "manual|auto|imported|generated"
  },
  context: {
    gateStatus: "eligible|blocked|unresolved",
    temporalRole: "current_window|near_future|recent_past|distant_future|distant_past|ongoing",
    branchMatch: true
  },
  evidence: {
    localScore: 0,
    specificityScore: 0,
    characterHit: false,
    locationHit: false,
    topicHit: false,
    titleHit: false,
    recentHit: false,
    laneIds: ["context_window", "present_character", "exploration"],
    coverageLaneIds: ["present_character:Harry Potter", "location:Hogwarts"],
    stackPressure: "none|add|remove|replace",
    stalePasses: 0,
    cooldownActive: false
  },
  priorAutomation: {
    lastAction: "",
    lastRunId: "",
    lastTouchedTurnsAgo: 0
  }
}
```

Candidate packets should be aggressively truncated and redacted like other model-facing Saga data. For ARMPC, send enough semantic text for the model to judge relevance, but keep source identifiers stable so returned operations map back deterministically.

## Model Contracts

Provider calls should be narrow, JSON-only, and operation-specific.

### AR Adjudication

Use for borderline or high-impact accepted-card relevance changes.

Allowed operations:

- `promote_relevance`
- `demote_relevance`
- `none`

Output shape:

```json
{
  "operations": [
    {
      "candidateId": "accepted:card_id",
      "operation": "promote_relevance",
      "targetRelevance": "high",
      "confidence": 0.86,
      "reason": "Current scene directly involves the card's secret."
    }
  ]
}
```

### ARMP Adjudication

Use Utility Provider by default. The task is bounded active-set classification, not long-horizon curation.

Allowed operations:

- `promote_relevance`
- `demote_relevance`
- `pin`
- `unpin`
- `mute`
- `unmute`
- `none`

Prompt rules:

- Prefer `none` unless the action is clear.
- Pin means the card must shape the next reply.
- Mute means the card should not influence the next reply.
- Demote stale cards before muting them.
- Never recommend operations for automation-disabled candidates.
- Return only known candidate IDs.

### ARMPC Adjudication

Use Reasoning Provider for direct curation and retirement. Utility Provider can support advisory edge classification, but it should not be the default authority for direct curation.

Allowed operations:

- `accept_from_active_decks`
- `retire_from_accepted_stack`
- ARMP operations.
- `none`

Prompt rules:

- Choose only cards that are likely to matter now or soon.
- Include subtle semantic matches even when keyword overlap is weak.
- Do not accept general reference cards unless they directly constrain the current or near-future scene.
- Retire only automation-owned accepted cards that are clearly stale and restorable.
- Return no more operations than the supplied per-run caps.
- Classify coverage explicitly: `add_now`, `keep`, `retire`, `hold`, or `ignore`.
- Prefer `hold` over weak additions and prefer `keep` over uncertain retirement.

Suggested output shape:

```json
{
  "operations": [
    {
      "candidateId": "deck:pack_id:card_id",
      "operation": "accept_from_active_decks",
      "classification": "add_now",
      "coverageLaneIds": ["present_character:Ron Weasley", "objective:poisoned mead"],
      "confidence": 0.84,
      "reason": "This card constrains the immediate rescue scene."
    },
    {
      "candidateId": "accepted:card_id",
      "operation": "retire_from_accepted_stack",
      "classification": "retire",
      "confidence": 0.91,
      "reason": "The automation-owned card no longer covers any active lane."
    }
  ]
}
```

All model responses must be parsed through the shared provider response normalizer and rejected on malformed JSON. A failed parse should degrade the run rather than applying partial free-form output.

## Automation Engine

Build one policy engine with mode-gated operations.

Recommended pipeline:

1. Read current settings, Context, recent chat, active stack, accepted Lorecards, pending review entries, cadence state, and current prompt eligibility state.
2. Update narrative movement counters and structured state hashes.
3. Decide whether remap and/or curation is due from app events, accumulated story budget, local stack pressure, or advisory Utility edge classification.
4. Apply deterministic hard gates for active stack, Context, branch, duplicates, automation eligibility, mode legality, and undoability.
5. Gather a broad multi-lane candidate pool rather than relying on a single keyword/scoring pass.
6. Build evidence packets for each candidate: local score, temporal role, gate status, entity/scope hits, recent-message hits, specificity, coverage lanes, stack pressure, current tier, current pin/mute state, ownership, and prior automation actions.
7. Run model semantic adjudication for the configured subset when the operation needs semantic judgment.
8. Validate every proposed operation against mode, style, per-card automation state, Context gates, duplicate guards, cooldowns, hysteresis, target bands, and run caps.
9. Apply a bounded batch.
10. Record timeline, cadence, and run-journal events.
11. Sync prompt injection if the accepted set or injection-affecting state changed.

The model should never be the sole authority for applying operations. It can adjudicate candidates, but deterministic validation decides what is legal.

Model prompts should be operation-specific. Avoid asking the model to "manage lore." Ask bounded questions:

- AR: Which accepted cards should change relevance tier?
- ARMP: Which accepted cards must shape the next reply, should stop shaping it, or should be excluded?
- ARMPC: Which eligible active-deck cards should enter the working set, and which automation-owned accepted cards are safe to retire?

Model output should use only allowed operation names and known card IDs.

## Cadence And Triggering

Lore Automation cadence should be clock-first, event-aware, pressure-aware, and model-assisted only when useful.

### Due-State Sources

| Source | Detection | Model Required | Effect |
| --- | --- | --- | --- |
| Story budget | Accumulated words/tokens since last remap or curation | No | Normal due signal |
| Context app event | Structured Context hash changed after Saga-owned UI/action | No | Run soon |
| Deck app event | Active Loredeck stack hash changed | No | Run curation soon in ARMPC |
| Accepted stack event | Accepted automation stack hash changed | No | Recompute pressure |
| Stack pressure | Local target-band, stale, duplicate, and coverage checks | No | Run curation when pressure crosses policy |
| Semantic edge | Utility classifier on recent prose and last snapshot | Optional | Pull run forward only on high confidence |

### Utility Edge Classifier

Do not hard-code broad transition phrase banks. If prose needs semantic judgment, use a small Utility Provider classifier:

```json
{
  "edge": "none|soft_scene_shift|hard_scene_shift|chapter_or_arc_shift",
  "confidence": 0.82,
  "changed": ["location", "cast", "objective", "time"],
  "reason": "The scene moved from the infirmary to the common room."
}
```

Classifier policy:

- High-confidence hard edge can run remap/curation sooner.
- Medium-confidence soft edge can lower the remaining story budget.
- Low confidence, malformed output, unavailable provider, or timeout does nothing.
- The classifier never recommends card operations and never mutates state.

### Stack Pressure

Stack pressure is local accounting, not a model call.

Add pressure exists when:

- Current coverage lanes are missing accepted cards.
- Active decks contain strong candidates for uncovered lanes.
- Automation-owned accepted cards are below the target band.
- Active deck or Context hash changed and the accepted stack has not been refreshed.

Remove pressure exists when:

- Automation-owned cards no longer cover any active lane.
- Automation-owned cards have low relevance, no recent hit, and stale evidence across the Style's required window.
- Source deck is inactive or Context gate no longer matches.
- Multiple automation-owned cards cover the same lane and the stack is above target.
- Automation-owned accepted cards exceed the max band.

The policy engine should prefer replacement over churn: add stronger coverage first when below target, retire stale automation-owned cards when above target or repeatedly stale, and avoid removing a card that would leave an important lane uncovered.

## Candidate Gathering

Candidate gathering should be broad enough for recall but structured enough for deterministic validation.

Do not use Style as a candidate-crop shortcut. `Careful`, `Balanced`, and `Aggressive` should all start from a broad eligible set. The engine should then pack a bounded, diverse model packet from lanes so subtle but important cards survive even when their raw local score is lower.

Recommended lanes:

| Lane | Applies To | Purpose |
| --- | --- | --- |
| `direct_recent_text` | AR, ARMP, ARMPC | Find obvious matches from recent chat terms. |
| `context_window` | ARMPC | Include all cards eligible for the current Context window up to lane caps. |
| `present_entities` | ARMP, ARMPC | Include cards tied to present or nearby characters, locations, objects, spells, or factions. |
| `high_specificity` | ARMPC | Surface narrow gates, secrets, status changes, and constraints near current Context. |
| `timeline_neighbor` | ARMPC | Catch cards adjacent to current anchors/windows. |
| `recently_active` | ARMP, ARMPC | Re-evaluate cards recently injected, pinned, muted, accepted, or automation-touched. |
| `exploration` | ARMPC | Rotate through eligible active-deck cards to expose scorer blind spots. |
| `model_need_expansion` | ARMPC | Ask model for semantic needs, then map those needs back to local candidate lookups. |

Lanes should dedupe by stable source reference and preserve lane IDs in evidence packets. Candidate caps should be per-lane before global caps so one noisy lane cannot starve subtle candidates.

The final provider packet should be bounded by prompt budget, not by Style. Style constrains what can be applied after the reasoner and validator respond. If the packet is over budget, prefer diversity:

- Keep at least one candidate per active coverage lane where possible.
- Preserve high-priority narrow gates, secrets, constraints, current items, and temporal gates.
- Include currently accepted automation-owned cards that may be stale so the model can compare add/keep/retire decisions.
- Rotate exploration candidates deterministically across runs.
- Summarize skipped lane counts in the run journal.

## Degraded Behavior

Lore Automation should fail soft.

| Condition | AR | ARMP | ARMPC |
| --- | --- | --- | --- |
| No Context | Local stale/current scoring only where safe | Disable pin/mute, run AR only or pause | Pause curation |
| Utility unavailable | Local obvious AR only | Apply local-safe ARMP only where deterministic proof is sufficient, otherwise pause ARMP operations | Edge acceleration unavailable; cadence falls back to app events, story budget, and stack pressure |
| Reasoning unavailable | No impact unless needed | No impact unless routed there | Pause direct curation and explain provider unavailable |
| Malformed model JSON | Ignore model response and keep local-safe operations only | Do not apply model-only pin/mute | Do not apply curation |
| Too many candidates | Use lane caps and summarize skipped counts | Use lane caps and summarize skipped counts | Use lane caps, exploration rotation, and summarize skipped counts |
| Utility edge classifier uncertain | No impact | No impact | Keep accumulating story budget; do not pull curation forward |

Status should explain degraded behavior compactly:

- `Needs Context`
- `Utility unavailable`
- `Reasoning unavailable`
- `Curation paused`
- `Model output rejected`
- `Run capped`

## Robustness Requirements

The system should be engineered as a reliable background controller, not a fragile suggestion script.

Required safeguards:

- Per-card automation enable/disable state.
- Automation ownership tracking.
- Manual changes disable per-card automation.
- Local scoring is evidence, not sole authority for subtle discovery.
- Multi-lane candidate gathering for ARMPC discovery.
- Idempotent accept logic that prevents duplicate Accepted Lorecards.
- Context-gate validation before acceptance or injection-affecting changes.
- Hysteresis so a card does not flip relevance, pin, or mute every run.
- Cooldowns for recently touched cards.
- Per-run operation caps.
- Target stack bands for automation-owned curated cards.
- Local stack-pressure accounting for add, remove, and replace pressure.
- Narrative movement cadence based on story budget plus structured app events.
- Utility edge classification is advisory and optional, not foundational.
- No broad hard-coded transition phrase bank.
- Degraded modes when Context is missing or provider configuration fails.
- Compact run history and undo support.
- Timeline/audit visibility for every applied action.
- Strict source scope: only enabled active stack entries participate in ARMPC discovery.
- Provider JSON parsing and operation validation before any mutation.
- Per-lane candidate caps so broad recall remains bounded.
- Exploration sampling that is deterministic by run seed and source IDs, not random churn.

## UI Plan

### Lore Automation Panel

Primary controls:

```text
Lore Automation

Mode:      ARMPC
Style:     Balanced
Cadence:   Auto

Status: Ready
Last run: 3 accepted, 5 promoted, 2 pinned, 4 muted, 1 retired

[Run Now] [Pause] [Undo Last Run] [Review Activity]
```

Mode selector:

- Render as segmented control or compact select.
- Labels are exactly `Off`, `AR`, `ARMP`, `ARMPC`.
- Tooltips provide the expanded names.

Style selector:

- `Careful`
- `Balanced`
- `Aggressive`

Status should be readable without opening diagnostics:

- `Ready`
- `Paused`
- `Needs Context`
- `No active decks`
- `Provider unavailable`
- `Last run failed`
- `Undo available`

### Card Icon

Each Accepted Lorecard gets a compact corner icon.

Requirements:

- Visible enough to discover.
- Small enough not to dominate card content.
- Tooltip explains the current automation state.
- Clicking toggles enabled/disabled for that card.
- Disabled state should look clearly distinct from muted card state. Automation-disabled does not mean injection-muted.

Suggested tooltip copy:

- Enabled: `Lore Automation enabled for this card.`
- Disabled: `Lore Automation disabled for this card. Manual changes are protected until re-enabled.`

### Activity View

The activity view should answer:

- What changed?
- Why did it change?
- Was it local or model-adjudicated?
- Can I undo it?
- Which cards were skipped and why?

It should not become the primary operating UI.

### Advanced Diagnostics

Advanced diagnostics may expose implementation detail, but it should be visually subordinate to the cockpit.

Possible diagnostics:

- Provider routing: `Auto`, `Utility only`, `Reasoning only`, `Local only where possible`.
- Pacing preset: `Responsive`, `Normal`, `Relaxed`.
- Story budget progress since last remap and curation.
- Last structured edge trigger.
- Last Utility edge classifier result.
- Stack pressure: add/remove/replace/none.
- Last candidate lane counts.
- Last provider status.
- Last run caps hit.
- Last rejected operations.
- Exportable run journal excerpt for debugging.

Do not place these in the default panel body.

## Integration Points

### Accepted Lorecards

Accepted card rendering needs:

- Automation icon.
- Bulk enable/disable actions.
- Last automation reason in details.
- Filtering by automation enabled/disabled may be useful in Advanced Workbench.

### Pending Review

Pending Review remains a manual review surface, not the core ARMPC path.

ARMPC's product promise is automation. It should directly accept high-confidence active-deck cards into the chat's Accepted Lorecards and retire stale automation-owned cards from that working set. If an early rollout uses a feature flag to route direct curation through Pending Review for safety, that must be treated as a temporary rollout constraint, not the target behavior.

### Lore Timeline

Timeline events should include:

- Automation run summary.
- Individual accepted/retired actions where useful.
- Restore/undo path.

### Injection Audit

Injection audit should show automation-caused pin/mute/relevance state when it affects prompt selection.

### Active Stack

ARMPC discovery only considers enabled active stack entries. Disabled stack entries must never contribute auto-accepted cards.

### State And Settings

State sanitization should preserve:

- Per-card `extensions.loreAutomation` state.
- Compact run journal entries up to the retention limit.
- Last run summary for quick status rendering.

Settings migration should:

- Map `autoRelevanceEnabled: false` or legacy `autoRelevanceMode: "off"` to `loreAutomationMode: "off"`.
- Map current enabled Auto-Relevance suggest/apply behavior to `loreAutomationMode: "ar"` plus Style defaults.
- Keep old `autoRelevance*` settings readable during migration.
- Avoid leaving two visible UI control families for the same behavior.
- Use a new migration flag such as `loreAutomationLevelsMigratedYYYYMMDD`. Do not reuse the existing `loreAutomationDefaultsMigrated20260602` flag, which belongs to older lore-generation automation defaults.

## Implementation Slices

### Slice 1: Rename And Generalize Current AR

- Keep current behavior unchanged.
- Introduce `loreAutomationMode` with `Off` and `AR`.
- Keep existing Auto-Relevance settings migrated or mapped.
- Update UI labels to the new mode selector.
- Ensure current integration coverage still passes.
- Confirm Session Automation Mode remains separate from Lore Automation Mode.

### Slice 2: Per-Card Automation State

- Add `extensions.loreAutomation.enabled`.
- Default existing Accepted Lorecards conservatively.
- Manual relevance, pin, mute, and content edits disable automation for that card.
- Add card corner icon.
- Add bulk enable/disable actions.
- Add sanitizer/storage handling.

### Slice 3: Unified Operation Engine

- Refactor the current Auto-Relevance pass into candidate operation generation.
- Apply mode-gated operation validation.
- Convert local scoring into reusable evidence packets rather than the only final decision path.
- Add run journal and compact run summary.
- Add undo last run.
- Add operation contracts and shared validation.
- Add evidence packet builder.

### Slice 4: ARMP Apply Mode

- Enable high-confidence pin/mute application.
- Respect per-card automation disabled state.
- Record timeline and injection audit events.
- Add tests for pin/mute changes, manual edit protection, and undo.
- Add Utility Provider adjudication contract for ARMP JSON operations.

### Slice 5: Narrative Cadence And Stack Pressure

- Replace turn-only cadence with narrative movement cadence.
- Track accumulated story words/tokens separately for remap and curation.
- Track structured Context, active stack, and accepted automation stack hashes.
- Add local stack pressure for target-band, stale, duplicate, and missing-coverage signals.
- Add optional Utility Provider edge classifier for semantic scene/chapter movement.
- Ensure classifier output is advisory only and cannot directly mutate Lorecards.
- Add anti-spam guards: coalescing, no runs during generation, minimum movement deltas, and cooldowns.

### Slice 6: ARMPC Broad Discovery And Coverage Packing

- Scan active decks for Context-eligible cards.
- Build multi-lane candidate pools from context-window eligibility, scope/entity matches, priority/specificity, timeline neighbors, recent activity, and exploration samples.
- Build bounded, diverse provider packets without making Style a scan-depth shortcut.
- Add model semantic classification/rerank for subtle candidates that local scoring may miss.
- Add coverage lanes and stack pressure to evidence packets.
- Deduplicate against Accepted Lorecards and Pending Review.
- Add run caps and degraded behavior when Context is missing.
- Add lane-count diagnostics and skipped-candidate summaries.

### Slice 7: ARMPC Direct Curation

- Allow direct auto-accept under ARMPC for all Styles, with Style-specific assertiveness.
- Default auto-accepted cards to automation enabled.
- Add retirement of stale automation-owned cards.
- Add target-stack bands and replacement/cooldown policy.
- Add restore/undo coverage.
- Add Reasoning Provider direct curation contract.

### Slice 8: UI Polish And Documentation

- Update operator docs.
- Add concise mode explanations.
- Keep Advanced docs as the place for acronyms, policy, and troubleshooting.
- Add visual smoke checks for mode selector, card icons, activity view, and bulk actions.

## Test Plan

Deterministic coverage should prove:

- `Off` never mutates lore state.
- `AR` only changes relevance.
- `ARMP` can change relevance, pin, and mute, but only for automation-enabled cards.
- `ARMPC` only discovers cards from enabled active stack entries.
- All Styles act automatically; `Careful` does not create a primary suggestion/review queue.
- Style changes per-pass assertiveness only, not cadence, scan depth, or card protection.
- Manual edits disable per-card automation.
- Re-enabling a card makes it eligible for the next run but does not mutate immediately.
- Bulk enable/disable works for selected and filtered cards.
- Auto-accepted cards do not duplicate existing Pending Review or Accepted Lorecards.
- Auto-retire does not affect manual/user-owned cards.
- Pinned cards are not retired.
- Target-stack bands prevent runaway additions and removals.
- Broad discovery preserves subtle candidates through lane quotas even when raw local score is lower.
- Story-word accumulation can trigger runs without turn-count dependence.
- Structured Context, active stack, and accepted stack changes trigger or invalidate cadence without model calls.
- Utility edge classifier can pull a run forward only when confidence is high and never mutates Lorecards.
- Utility edge classifier failure falls back to story budget and app events.
- Missing Context pauses or degrades curation instead of making broad guesses.
- Provider failure falls back to local policy or pauses model-adjudicated operations.
- ARMPC recall includes subtle cards that do not share direct keywords with recent chat.
- Model adjudication cannot apply operations outside the deterministic hard-gated candidate pool.
- Undo Last Run restores relevance, pin/mute, accepted/retired state, and automation metadata.
- Injection output changes only when the accepted set or injection-affecting card state changes.

Recommended integration path:

- Extend the HP Year 6 progression harness for ARMP behavior.
- Add a focused ARMPC active-stack curation harness.
- Add source-level visual smoke checks for the compact Lore Automation panel and card icon behavior.
- Add sanitizer/storage tests for `extensions.loreAutomation` and run journal retention.
- Add mocked provider fixtures for ARMP and ARMPC JSON operation contracts.
- Add degraded-provider tests for Utility unavailable, Reasoning unavailable, and malformed JSON.
- Add cadence tests for word-budget triggers, Context hash changes, deck-stack hash changes, stack-pressure triggers, and Utility edge classifier advisory behavior.

## Completion Criteria

The feature plan is implementation-ready when it answers:

- What the user sees in the cockpit.
- What each mode may mutate.
- How per-card automation enable/disable works.
- How manual changes disable card-level automation.
- How bulk enable/disable works.
- How narrative movement cadence decides when a run is due.
- How stack pressure decides add/remove/replace pressure.
- How Style controls per-pass assertiveness without changing cadence, scan breadth, or manual protection.
- How local gates, candidate gathering, model adjudication, and validation interact.
- Which provider is used by default for each decision type.
- How provider failures degrade.
- What state is persisted.
- How runs are undone.
- How tests prove mode boundaries, curation recall, and manual protection.

The implementation is feature-complete only when these contracts have deterministic coverage and no visible legacy Auto-Relevance control family conflicts with the new Lore Automation cockpit.

## Open Questions

- Should existing Accepted Lorecards default to automation enabled or disabled after migration?
- Should manual acceptance disable automation by default, or should only subsequent manual edits disable it?
- How much run history should be retained per chat?
- Should `Undo Last Run` be available for multiple previous runs or only the latest run?
- Should Style presets be visible in Basic, or should Basic only expose `Off`, `AR`, and possibly `ARMPC Balanced` once stable?
- What compact active-deck index should ARMPC send to the model for semantic recall without overloading prompts?
- How much exploration sampling is useful before it becomes noisy?
- Should model adjudication routing remain entirely automatic, or should Advanced expose provider overrides only in diagnostics?
- What default target-stack bands should `Careful`, `Balanced`, and `Aggressive` use?
- What word/token budgets should `Responsive`, `Normal`, and `Relaxed` pacing use?
- What confidence threshold should the Utility edge classifier need before it can pull a run forward?
