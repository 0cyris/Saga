# Story Opener Creator Plan

Status: Planning draft. This document defines the desired product behavior, storage model, Context/lore guardrail strategy, and implementation phases for adding Story Opener Creator to the Session tab.

Saga is pre-alpha, so this plan does not preserve compatibility with any old Story Opener state. The feature should ship with a clean schema and update every touched surface in place.

## Purpose

Story Opener Creator helps a user start or restart roleplay from the active Saga setup.

It uses:

- the active Loredeck stack
- the manually selected Context/story position for each loaded Loredeck
- eligible Lorecards and source Loredeck facts
- an editable user prompt
- an editable Prose Style instruction
- opener-specific controls for shape, character focus, point of view, tense, revision history, and variants

The output is plain opener text that the user can copy into chat or into a character card first message. Saga should not auto-send the opener to chat in the first implementation.

## Product Goals

- Make opener generation feel like a natural continuation of Session Readiness.
- Preserve user control: every generated opener is draft text until copied by the user.
- Keep Prose Style editable instead of forcing detected fandom choices into a selector.
- Reuse Saga's Context and Loredeck systems instead of creating a parallel story-position picker.
- Keep file storage compact in chat state by externalizing opener session payloads.
- Keep opener sessions global so users can return to them regardless of which chat is open.
- Let Story Opener Creator work without an active chat by falling back to active Loredecks plus Context.
- Let users return to a previous opener session and revise it over time.
- Keep old opener sessions loadable even when Loredecks, Context rows, or Lorecards have changed during alpha.
- Force latest resolved lore for new generation/revision instead of treating old compact packets as the source of truth.
- Make future-canon avoidance a first-class generation contract, not just a prompt suggestion.
- Support variant browsing without losing partial successes when one provider call fails.

## Non-Goals

- No automatic chat insertion.
- No new general-purpose writing assistant outside the Session workflow.
- No hidden Context selection inside the opener form. If Context is wrong or unset, route the user back to Context/Browse Context.
- No attempt to imitate an exact living author. Prose Style should describe broad narrative register, medium, pacing, point of view, and fandom-era feel.
- No legacy migration for old opener data.
- No storage of full active Loredeck payloads inside opener sessions.
- No requirement that a chat be open before an opener can be created.
- No silent replacement of the user's real active Loredeck stack, active Context, or active chat Lorecards when an opener is resumed.
- No use of a historical frozen Context Packet as the authority for new generation after sources have changed.

## User Experience

### Placement

Add a collapsible **Story Opener Creator** section to the Session tab, after Session Readiness/Automation and before Session Metrics.

The section has two states:

- **No active opener session**: show recent global opener sessions and a **New Opener** action.
- **Active opener session**: show controls, generation output, revision history, and variant carousel.

On mobile, the Session root summary should stay compact. The opener surface should appear inside Session Details or a nested Session subview, not on the root mobile summary card.

### Creator-Style Workflow

Story Opener Creator should feel like a smaller sibling of Loredeck Creator, not a one-off form.

Use the same broad user model:

- visible staged progress at the top
- one current-task card
- durable stage outputs
- provider progress inside the current task
- stage-level reset/revert controls for completed steps
- review/copy as the final user-controlled handoff

The feature does not need the full Loredeck Creator workbench complexity, but it should reuse its interaction language where possible so users understand it immediately.

### Stage Bar

The opener stage bar should use compact step cards similar to Loredeck Creator:

| Step | Label | Purpose | Durable output |
| --- | --- | --- | --- |
| 1 | `Inputs` | User prompt, Prose Style, Opening Shape, Character Focus, PoV/Tense, Target Length, Variants. | session `inputs` |
| 2 | `Context Packet` | Resolve the opener's source intent against latest available lore, then collect eligible facts, future exclusions, and salience. | `lastSourceResolution`, `snapshots.guardrailSummary`, and packet fingerprint |
| 3 | `Opener Brief` | Reasoning Provider turns the packet into an inspectable writing brief. | brief record |
| 4 | `Draft Variants` | Reasoning Provider writes one opener or three variants. | variant records |
| 5 | `Review & Copy` | User selects a variant, revises if needed, and copies the final text. | active variant and copy metadata |

The current-task card should name the next action in Creator style:

- `Set Opener Inputs`
- `Build Context Packet`
- `Build Opener Brief`
- `Draft Opener`
- `Review and Copy`

The stage bar should support click-to-scroll within the opener surface, and locked future steps should explain the missing dependency.

### Reset To Step

Add a small `Reset to this step` control to eligible completed opener stages, matching the Creator reset pattern.

This is not undo and not history restore. It is a destructive forward-data wipe:

- Keep the target step's data.
- Keep all earlier step data.
- Clear every later step's data.
- Return the current task to the selected step.

Reset should be disabled while any opener provider run is active. It should be unavailable for `Review & Copy` because that is the terminal handoff step.

Reset examples:

- Reset to `Inputs`: keep session identity and current input fields; clear Context Packet, Opener Brief, variants, revision records, run records, and active variant.
- Reset to `Context Packet`: keep inputs and the current packet/fingerprint; clear Opener Brief, variants, revision records, run records, and active variant.
- Reset to `Opener Brief`: keep inputs, packet, and brief; clear variants, revision records, run records, and active variant.
- Reset to `Draft Variants`: keep inputs, packet, brief, and existing variants for that draft step; clear copy metadata and later review state.

If the user wants to restore an older generated text, use Revision History. If the user wants to invalidate a stage and all later derived artifacts, use Reset to Step.

### Core Controls

| Control | Default | Notes |
| --- | --- | --- |
| User Prompt | empty | What the opener should accomplish. |
| Prose Style | pre-populated from detected fandom/context | Editable free-text input or textarea. Clearing it means no prose-style guidance. |
| Opening Shape | empty or last used | Text input with quick-populate buttons: `Scene-setting`, `Dialogue first`, `Action first`, `Introspective`, `Cold open`, `First message`. |
| Character Focus | empty | Optional text box. The user can name one or more characters, factions, or relationships. |
| PoV and Tense | `3rd person limited, past tense` | Editable text input with quick-populate buttons later if needed. |
| Target Length | `Scene` | Three bands/flavors instead of exact word counts: `Hook`, `Scene`, `First Message`. |
| Variants | off | When enabled, Saga generates three independent variants and shows them in a carousel. |

The controls should remain visible while output is shown. Revision should be a first-class action on the same session, not a separate dialog.

### Prose Style Pre-Population

Auto-detection should fill the Prose Style field with an editable seed, not lock the user into a mode.

Example seed:

```text
Use a Harry Potter Book 6-era school-year prose profile: close third-person narration, grounded magical-school detail, restrained humor, rising unease, and character-level uncertainty. Match this era's story position without revealing later discoveries.
```

For a mixed stack:

```text
Blend the active fandoms only where the prompt asks for crossover texture: Harry Potter Book 6-era school mystery and Star Wars Legends political-adventure pacing. Keep the current Context boundaries for each stack item.
```

Users can replace this with anything, including a fandom or style not present in the active Loredecks.

## Fandom And Style Detection

Detection should be deterministic first and model-free:

1. Resolve the enabled source stack using the same Library/Context stack path used by Context Workbench.
2. Read pack metadata from Library records and bundled index records.
3. Extract signals from:
   - `fandom`
   - `era`
   - `title`
   - `description`
   - `tags` such as `fandom:*`, `era:*`, `canon:*`, and `scope:*`
   - selected Context rows, including arc, phase, chapter, episode, issue, quest, game stage, anchor/window labels, branch, and notes
   - Context Brief `fandomHints`, if present
4. Score fandom candidates by:
   - resolved stack priority/order
   - enabled deck count per fandom
   - selected Context confidence
   - explicit user prompt mentions
   - Character Focus matches against eligible lore

The result should be a small `proseStyleSeed` string and structured `styleDetection` metadata stored in the session file. The seed is only a starting value. Once the user edits Prose Style, Saga should mark it as user-edited and stop overwriting it unless the user asks to refresh the seed.

## Session Storage

Story Opener Creator should follow the Creator project pattern: compact index plus external payload files.

Opener sessions are global user data. They are not scoped to, keyed by, or deleted with the active chat. A generation run may record compact lore-source diagnostics, but the session identity should not depend on a chat ID or chat name.

The storage contract should optimize for two alpha realities:

- old opener sessions must keep opening even when Loredeck/Card/Context schemas and IDs change
- new generation/revision must use latest resolved lore, not stale frozen facts from the old file

Each opener session should therefore store:

- saved generated artifacts: variants, revision history, brief summaries, copy history, and compact run diagnostics
- a **source intent manifest** that describes what the opener was meant to use
- latest source resolution metadata that records whether the intent currently resolves cleanly
- historical compact packet/brief diagnostics for explaining old generations

The source intent manifest is a rebinding hint, not a frozen authority. The historical compact packet is useful for loading old output, debugging, and showing what changed, but every new provider generation or revision should rebuild the Context Packet from latest resolved source files.

Resuming an opener must not mutate the user's active Saga state. Do not temporarily replace the active Loredeck stack, active Context rows, active chat, or accepted Lorecards. Resolve sources virtually for the opener panel only.

### Files

```text
/user/files/saga-story-opener-index.v1.json
/user/files/saga-story-opener-session-<sessionId>.v1.json
```

The master Saga storage index should register each opener file as Saga-owned JSON. Total Saga Cleanup should remove opener indexes and sessions. Deleting an opener session from the UI should delete the session payload and remove its index record.

### Index Shape

```json
{
  "schemaVersion": 1,
  "kind": "story_opener_index",
  "revision": 1,
  "updatedAt": 0,
  "activeSessionId": "opener_...",
  "sessions": {
    "opener_...": {
      "sessionId": "opener_...",
      "title": "Book 6 January opener",
      "status": "idle",
      "createdAt": 0,
      "updatedAt": 0,
      "lastGeneratedAt": 0,
      "revisionCount": 3,
      "variantCount": 3,
      "activeVariantId": "variant_...",
      "lastLoreSourceMode": "chat_enriched",
      "sourceStatus": "changed",
      "storagePath": "/user/files/saga-story-opener-session-opener_....v1.json"
    }
  }
}
```

The index should be a shelf and routing layer only. It should not carry generated opener text, prompt payloads, full guardrail packets, or revision bodies.

### Session Payload Shape

```json
{
  "schemaVersion": 1,
  "kind": "story_opener_session",
  "sessionId": "opener_...",
  "title": "Book 6 January opener",
  "status": "idle",
  "currentStage": "inputs",
  "revision": 1,
  "createdAt": 0,
  "updatedAt": 0,
  "source": {
    "scope": "global",
    "createdInRoute": "session"
  },
  "sourceIntent": {
    "stack": [
      {
        "deckId": "",
        "packId": "",
        "title": "",
        "storagePath": "",
        "revision": 0,
        "contentHash": "",
        "order": 0
      }
    ],
    "contexts": [
      {
        "deckId": "",
        "contextId": "",
        "anchorKey": "",
        "branch": "",
        "positionKey": "",
        "label": ""
      }
    ],
    "chatOverlay": {
      "mode": "none",
      "acceptedLorecardRefs": []
    }
  },
  "lastSourceResolution": {
    "status": "current",
    "resolvedAt": 0,
    "loreSourceMode": "loredeck_only",
    "changedSourceCount": 0,
    "missingSourceCount": 0,
    "contextPacketFingerprint": ""
  },
  "inputs": {
    "userPrompt": "",
    "proseStyle": "",
    "proseStyleUserEdited": false,
    "openingShape": "",
    "characterFocus": "",
    "povAndTense": "3rd person limited, past tense",
    "targetLength": "scene",
    "variantsEnabled": false
  },
  "snapshots": {
    "styleDetection": {},
    "loreSources": {
      "mode": "loredeck_only",
      "activeChatAvailable": false,
      "acceptedLorecardCount": 0,
      "eligibleLoredeckFactCount": 0
    },
    "guardrailSummary": {},
    "contextPacketFingerprint": ""
  },
  "briefs": {},
  "activeVariantId": "",
  "copyHistory": [],
  "revisions": [],
  "runs": []
}
```

### Source Intent Manifest

The source intent manifest captures the source configuration the opener was meant to use:

- deck IDs, pack IDs, titles, storage paths, order, revisions, and content hashes when available
- Context IDs, anchor keys, branch labels, position keys, and human-readable labels
- prior chat overlay references when a generation used `chat_enriched` mode
- fallback matching hints such as titles/slugs/paths so alpha ID churn can be reconciled where possible

The manifest should be portable enough to survive common alpha changes:

- deck IDs change but titles/paths/hashes still identify the source
- Context row IDs change but anchor/branch/position labels still match
- accepted chat Lorecards are deleted or no longer belong to the current chat
- a Loredeck is updated in place with a new revision or content hash

Do not store full Loredeck payloads in the opener file. Store enough intent and provenance to rebind against the latest Library/Loredeck state, explain source drift, and keep existing opener text loadable.

### Source Resolution On Resume

Opening an existing opener should read the session payload, display saved variants/revisions, and compute source health in memory:

| Status | Meaning | Generation behavior |
| --- | --- | --- |
| `current` | Saved source intent resolves to latest files with no meaningful changes. | Generation/revision may continue after rebuilding the Context Packet. |
| `changed` | Saved sources still resolve, but revisions, hashes, Context rows, or accepted Lorecards changed. | Show `Sources changed`; rebuild Context Packet and Opener Brief before drafting. |
| `partial` | Some saved sources resolve and others do not, or chat overlay is unavailable. | Old text remains copyable; generation requires rebind, downgrade to latest `loredeck_only`, or explicit use of current active stack. |
| `missing` | The intended source stack or required Context cannot be resolved. | Old text remains copyable; block generation until the user rebinds sources or uses the current active stack. |

Opening a session should not write the file just because source health changed. Persist source resolution updates only when the user takes a meaningful action such as refresh, rebind, generate, revise, copy/select, or delete.

### Latest-Lore Rebinding Actions

The opener should provide source actions only when needed:

- `Refresh From Saved Sources`: resolve the opener's source intent against the latest available Loredeck/Context/Lorecard files, then rebuild Context Packet and downstream stages as needed.
- `Use Current Active Stack`: intentionally replace the opener's source intent with the current Session stack and current Context.
- `Rebind Missing Sources`: choose replacements when saved decks, Context rows, or important chat-overlay Lorecards no longer resolve.

Latest lore means the latest version of the opener's intended source stack, not blindly whatever stack the user currently has active. `Use Current Active Stack` is the explicit escape hatch when the user wants to retarget the opener.

### Revision Records

Each generation or revision appends a compact revision record:

```json
{
  "revisionId": "rev_...",
  "type": "generate",
  "createdAt": 0,
  "inputSnapshot": {
    "userPrompt": "",
    "proseStyle": "",
    "openingShape": "",
    "characterFocus": "",
    "povAndTense": "",
    "targetLength": "scene",
    "revisionPrompt": ""
  },
  "briefId": "brief_...",
  "contextFingerprint": "sha256...",
  "variantIds": ["variant_..."],
  "selectedVariantId": "variant_...",
  "notes": ""
}
```

Variant text can live inside the revision record or a `variants` map on the session payload. Keep it simple for alpha unless files become large enough to justify variant sub-files.

### Stale Write Protection

Use revision/updatedAt checks for both index and session payload writes. If the stored file changed after the UI loaded it, block the write and ask the user to reload the opener session. Alpha should prefer explicit reload over silent merge.

Writes should happen only on meaningful user actions:

- create session
- edit inputs
- refresh or rebind sources
- rebuild Context Packet
- generate or repair Opener Brief
- generate, revise, select, or copy variants
- reset to a stage
- delete session

When updating both payload and index, write the session payload first, then update the index summary. `/user/files` writes are not transactional, so load and cleanup paths should reconcile:

- index entries whose session payload file is missing
- session payloads missing from the opener index
- master storage index records that no longer match opener index/session files
- failed writes that left the session payload newer than the index summary

## Session Lifecycle

1. User creates a new opener session from Session.
2. Saga creates an index entry and session payload file.
3. Saga captures source intent from the current active stack, Context rows, and optional chat overlay.
4. Saga resolves that intent against latest Loredeck/Context/Lorecard files for each generation.
5. User generates, revises, copies, or returns later.
6. On resume, Saga displays saved variants/revisions first, then computes source health without mutating active app state.
7. If sources are current, changed, partial, or missing, Saga follows the source-resolution behavior above.
8. User can delete the session.
9. Deletion removes:
   - session payload file
   - opener index entry
   - master storage index record
   - active session pointer if it pointed to that session

Open sessions are global user data. They should survive reloads, chat switches, empty-chat states, and mode changes until explicitly deleted or Total Saga Cleanup runs.

New generation or revision always uses latest resolved sources. Saved historical packets and briefs remain attached to old revisions for inspection, copy, and debugging, but they do not authorize stale facts for future provider calls.

## Context And Lore Guardrail Strategy

The opener has to know what characters should know, what is newly important, and what is still future-only.

The generation service should build an **Opener Context Packet** for every generation and revision. This packet is internal, not a new required UI panel.

### Lore Source Modes

The opener should support two source modes without adding another visible user control:

- `loredeck_only`: no active chat is available, or the active chat has no usable accepted/current Lorecards. Saga uses the active Loredeck stack, selected Context rows, Context index summaries, source Loredeck facts, and suggested/eligible Lorecards derived from the active packs.
- `chat_enriched`: an active chat is available and has accepted/current Lorecards. Saga uses those Lorecards as a branch-specific overlay, while still using the active Loredeck stack and Context as the canonical source boundary.

For a new opener, the initial source intent is captured from the current active stack, selected Context, and optional active-chat overlay. For a resumed opener, source resolution starts from the saved source intent manifest. It should not automatically switch to whatever stack happens to be active now.

Do not block generation only because no chat is open. If no active chat exists, show a compact status such as `Loredeck-only sources` in diagnostics or the current-task card, not as a required decision.

Generation should require enough Saga state to be meaningful:

- If a new opener has no active Loredeck stack, block generation and ask the user to choose Loredecks.
- If a resumed opener's saved source stack is missing, block generation until the user rebinds sources or chooses `Use Current Active Stack`.
- If Context is missing or stale, warn and route the user toward Browse Context before generation.
- If a chat is open but has no accepted/current Lorecards, continue in `loredeck_only` mode.

### Source Priority

Local deterministic rules should choose the candidate set before any provider call sees it:

1. Context gates and hard exclusions always win.
2. Accepted/current Lorecards from the active chat, when available, outrank source Loredeck facts because they represent the user's live branch.
3. Source Loredeck entries and suggested/eligible Lorecards from the resolved source stack provide the fallback and canonical base.
4. Fandom/style/context metadata informs Prose Style and scene register.
5. Blocked or future-only facts may appear only as compact `mustAvoid` labels/reasons.

Provider calls may refine emphasis inside this eligible set. They must not introduce new facts or override local gates.

### Packet Inputs

- Latest resolved source stack records.
- Per-Loredeck Context rows.
- Context index summaries for selected anchors/windows.
- Eligible source Loredeck entries.
- Suggested/eligible Lorecards from the resolved Loredeck packs.
- Accepted/current Lorecards from the active chat, when available.
- User prompt, Character Focus, Opening Shape, PoV/Tense, Target Length, and Prose Style.

### Hard Gates

Before any provider prompt is built:

- Exclude disabled decks and disabled entries.
- Exclude entries blocked by current Context gates.
- Exclude future-only entries whose `validFrom`, anchor, window, sort key, chapter, episode, arc, or branch is after the selected Context.
- Exclude entries from a different branch unless the user prompt explicitly asks for crossover/AU blending and the branch policy allows it.
- Treat missing or stale Context as a blocking warning state. The UI should route the user to Browse Context instead of generating from uncertain story position.

### Salience

After hard gates, rank eligible facts by:

- direct match to User Prompt
- direct match to Character Focus
- proximity to selected Context anchor/window
- recent discoveries or state changes near the selected Context
- high-priority lore entries
- accepted/current-chat Lorecards
- resolved source stack priority

The packet should separate:

- `mustUse`: compact facts that should strongly shape the opener
- `mayUse`: optional supporting texture
- `mustAvoid`: future-only or out-of-context topics, stored as compact labels/reasons rather than full future spoilers where possible
- `freshContext`: discoveries or plot conditions that are newly important at the selected story position

### Example: Harry Potter Book 6 In January

If the selected Context is before the Horcrux discovery:

- `mustAvoid` should include a compact future-knowledge guardrail such as "Do not let characters know about Horcruxes yet."
- eligible facts can still include current school-year pressures, Draco suspicion, Slughorn context, lessons, relationships, and immediate January plot state.

If the selected Context is exactly at or after the Horcrux reveal:

- Horcrux-related eligible facts should move into `freshContext` or `mustUse`.
- The opener should let that discovery dominate if the prompt does not ask for a quieter unrelated scene.

The same rule applies across fandoms: newly discovered high-salience facts near the current Context should be stronger than old background facts, while future facts should become avoidance constraints.

## Provider Calls

Use the Reasoning Provider route, internally `providerKind: "lore"`.

Saga should support a quality-first generation pipeline with one required brief call and optional provider-assisted candidate refinement:

1. **Build Local Context Packet**: local code resolves source intent against latest available lore, applies hard gates, source priority, salience ranking, and future exclusions. No provider can override this packet.
2. **Refine Candidate Facts**: when the eligible candidate pool is large or ambiguous, a Reasoning Provider call may rank, compress, and select facts from the already-eligible packet.
3. **Build Opener Brief**: a Reasoning Provider call turns the refined packet and user controls into a compact, inspectable writing brief.
4. **Write Opener**: one or more Reasoning Provider calls generate opener text from that brief.

This is worth doing because opener quality depends on correct emphasis. The refinement and brief calls can decide which allowed facts should dominate the opener, which future topics must stay absent, how the Prose Style and Opening Shape should translate into actual writing instructions, and how Target Length should affect pacing.

The provider-assisted steps must not be unconstrained "make a better prompt" steps. They can only select, compress, and prioritize facts from the local Opener Context Packet. They must not introduce new canon claims, new timeline facts, or new character knowledge.

### Candidate Refinement

Candidate refinement is an internal quality step, not a user-facing control.

Use it automatically when:

- the resolved source stack produces more eligible facts than should fit into a clean Opener Brief
- multiple fandoms or arcs are active
- Character Focus matches several competing fact clusters
- the selected Context has many nearby discoveries or state changes
- the user prompt is broad and needs stronger scene emphasis

Skip it for small, obvious packets where local salience already produces a compact fact set.

The refinement request should pass:

- candidate IDs
- compact fact text
- source type: `accepted_lorecard`, `source_loredeck_entry`, `suggested_lorecard`, `context_summary`, or `avoid_label`
- Context proximity and salience hints
- User Prompt, Character Focus, Opening Shape, Target Length, and Prose Style

The refinement response should return only IDs and compact directives, for example:

```json
{
  "selectedMustUseIds": [],
  "selectedMayUseIds": [],
  "selectedFreshContextIds": [],
  "selectedMustAvoidIds": [],
  "emphasisNotes": "",
  "continuityRisks": []
}
```

After parsing, Saga must validate every returned ID against the eligible local packet. Unknown IDs, future-blocked IDs, and wrong-branch IDs are ignored and recorded as sanitized diagnostics. If refinement fails, Saga can fall back to local salience ranking and continue unless the failure reveals a provider or packet-size problem that would also block the Opener Brief.

Diagnostics can show compact status text such as `Reasoner refined 42 eligible facts into 9 opener facts`, but the UI should not add a toggle or advanced source-selection panel for alpha.

### Provider Failure Reporting

Story Opener Creator must never collapse provider failures into a generic "generation failed" message.

Reuse Saga's shared provider error boundaries and preserve stable failure codes in each run/variant record. At minimum, opener runs should distinguish:

| Failure | Likely cause | User-facing recovery |
| --- | --- | --- |
| `provider_token_limit` | Provider stopped before returning complete visible output. Output max tokens may be too low, reasoning consumed the budget, or the requested output is too large. | Increase Reasoning Provider Max Tokens, lower Target Length, reduce variant count, or use a model/provider with a larger output budget. |
| `provider_context_limit` | Request/prompt is too large for the selected model context window or provider input limit. | Reduce source scope, compact the Context packet, use a shorter Character Focus/User Prompt, or use a larger-context model. |
| `provider_reasoning_only` | Thinking/reasoning model returned hidden reasoning but no visible answer. | Increase max tokens, lower reasoning effort in the provider/profile, or use a non-thinking model. |
| `provider_empty_content` | Provider returned no visible content. | Check provider routing/model settings and retry. |
| `json_invalid` | Opener Brief stage returned malformed JSON that repair could not recover. | Retry the brief stage; if repeated, reduce packet size or lower requested complexity. |
| `stage_contract_failed` | Brief JSON parsed but omitted required fields or introduced unsupported facts. | Retry with a smaller packet or inspect diagnostics. Do not proceed to opener drafting. |
| `opener_empty_or_rejected` | Final opener text was empty, only commentary, or violated the plain-text opener contract. | Retry the opener stage; if repeated, lower Target Length or simplify Prose Style/Opening Shape. |

The UI should show:

- failed stage name
- stable failure kind
- concise human explanation
- specific next action
- provider/model label when available
- whether any partial variants were preserved

For candidate refinement failures, Saga should distinguish between recoverable refinement failure and a hard provider/prompt-size failure:

- If refinement returns malformed or unsupported selections, fall back to local salience and continue, while recording sanitized diagnostics.
- If refinement proves the packet is too large for the selected model/provider, surface `provider_context_limit` before attempting the Opener Brief.
- If refinement hits an output/token limit, surface `provider_token_limit` with the same Max Tokens guidance as brief generation.

Examples:

```text
Opener Brief hit the Reasoning Provider output limit before Saga received complete JSON. Increase Reasoning Provider Max Tokens or reduce the opener scope, then retry Build Opener Brief.
```

```text
Variant B returned hidden reasoning but no visible opener text. Increase max tokens, lower reasoning effort, or use a non-thinking model. Variants A and C were preserved.
```

For token-limit failures, the message should be explicit about whether the evidence points to output budget (`provider_token_limit`) or request/input size (`provider_context_limit`). If Saga cannot tell, say so and present both likely fixes.

### Output Parsing And Repair

The Opener Brief stage should reuse Saga's existing generation-hardening approach rather than adding a one-off parser.

The implementation should share or extract the same concepts used by Loredeck Creator and Story Lore generation:

- normalize provider-shaped responses before parsing visible text
- strip markdown fences and likely reasoning tags
- attempt balanced JSON object extraction before giving up
- run one stage-specific JSON repair pass when parsing fails
- validate the repaired/parsed object against the Opener Brief contract
- reject unsupported facts or missing required fields as `stage_contract_failed`
- persist compact sanitized diagnostics without raw provider responses

The repair prompt should be Opener Brief-specific:

```text
Repair this malformed Saga Story Opener Brief response into valid JSON.

Required shape:
{
  "briefId": "string",
  "sceneObjective": "string",
  "styleDirective": "string",
  "lengthDirective": "string",
  "openingShapeDirective": "string",
  "povAndTenseDirective": "string",
  "characterFocusDirective": "string",
  "mustUse": [],
  "mayUse": [],
  "mustAvoid": [],
  "freshContext": [],
  "continuityChecks": []
}

Rules:
- Preserve only information present in the malformed response and the supplied allowed-facts packet.
- Do not invent canon facts, timeline facts, character knowledge, or future events.
- Return only the repaired JSON object. No markdown fences or commentary.
```

Repair is allowed for syntax and shape problems. It is not allowed to bypass guardrails. After repair, stage validation still has to prove every `mustUse`, `mayUse`, `mustAvoid`, and `freshContext` item maps back to the local Opener Context Packet or its compact labels.

For the final opener text stage, parsing should be lighter:

- normalize provider-shaped visible text
- strip markdown fences if a model wraps the opener
- reject empty output, JSON-only output, or meta-commentary-only output
- do not run JSON repair because the expected output is plain prose

If opener text is recoverable after fence stripping, keep it. If it is not recoverable, report `opener_empty_or_rejected` with a concrete retry action.

### Opener Brief

The brief should be durable enough to inspect, reuse, and debug:

```json
{
  "briefId": "brief_...",
  "createdAt": 0,
  "contextFingerprint": "sha256...",
  "sceneObjective": "",
  "styleDirective": "",
  "lengthDirective": "",
  "openingShapeDirective": "",
  "povAndTenseDirective": "",
  "characterFocusDirective": "",
  "mustUse": [],
  "mayUse": [],
  "mustAvoid": [],
  "freshContext": [],
  "continuityChecks": []
}
```

The UI does not need to expose the full brief by default. A collapsed diagnostics drawer can show it later for debugging.

Brief reuse rule:

- Reuse the existing brief when only browsing/copying variants.
- Rebuild the brief when User Prompt, Prose Style, Opening Shape, Character Focus, PoV/Tense, Target Length, source intent, source resolution status, Context, or eligible lore fingerprint changes.
- For a revision prompt, rebuild the brief only if the revision asks for different emphasis, different characters, different length, or a different opening shape. Otherwise, revise directly against the selected variant and existing brief.

### Target Length

Target Length is a banded flavor, not a raw word count:

| Length | Intent | Generation guidance |
| --- | --- | --- |
| `Hook` | A compact opener for quickly starting chat. | Tight scene entry, usually one focused beat, minimal exposition. |
| `Scene` | Default balanced opener. | Enough setup, character grounding, and immediate momentum for a strong first response. |
| `First Message` | Fuller character-card or scenario first message. | More complete staging, relationship/context setup, and a stronger handoff to the user. |

The provider prompt can include soft approximate ranges for consistency, but the visible control should stay flavor-based.

### Opener Text Contract

The final opener output contract should request plain opener text only:

- no markdown fence
- no JSON
- no analysis
- no commentary
- no alternate endings unless Variants is enabled

### Generate

Generate uses:

- current inputs
- latest resolved Opener Context Packet
- generated Opener Brief
- selected variant count
- stable generation instructions

### Revise

Revise uses:

- selected previous variant text
- revision prompt
- current inputs
- latest Opener Context Packet
- existing or rebuilt Opener Brief
- prior revision metadata

The provider should preserve what works unless the revision prompt asks for a broader rewrite.

### Variants

When Variants is enabled, Saga should run optional candidate refinement if needed, make one Opener Brief call, then make three independent opener-writing provider calls rather than asking one provider call for three variants.

Reasons:

- independent calls produce more meaningful variation
- one failed call should not lose all variants
- each variant can carry its own progress/error state
- users can browse partial successes

Each call receives the same guardrails but a small variation directive:

- Variant A: direct/default opener
- Variant B: alternate opening angle
- Variant C: stronger hook or different first beat

Run the calls with a bounded concurrency cap of three for alpha. If provider rate limits become common, reduce the cap to two without changing the stored session schema.

If the brief call fails, do not start variant generation. If one variant call fails after the brief succeeds, preserve the successful variants and record the failed variant status.

Each failed brief or variant run should persist compact diagnostics:

```json
{
  "runId": "run_...",
  "stage": "opener_brief",
  "status": "failed",
  "failure": {
    "code": "provider_token_limit",
    "message": "Reasoning Provider hit the response token limit.",
    "recovery": "Increase Reasoning Provider Max Tokens or reduce opener scope.",
    "providerKind": "lore",
    "providerLabel": "Reasoning Provider",
    "model": "selected-model-if-known"
  },
  "updatedAt": 0
}
```

Do not store raw provider responses in the session payload. Store only compact sanitized diagnostics and the visible error category needed for recovery.

### Variant Carousel

The UI should show one variant at a time with:

- previous/next controls
- `1 / 3` style position
- active variant status
- Copy
- Revise This Variant

Selecting a variant updates `activeVariantId` in the session payload.

## Revision History

Revision history should be durable and session-scoped.

The history list should show:

- timestamp
- generation vs revision
- input summary
- variant count
- selected variant

Users should be able to restore/select an older variant as the active variant. Do not delete old revisions automatically in the first implementation unless the payload approaches a storage safety limit. If a limit is needed, keep the most recent 50 revisions and never prune the active variant without user confirmation.

Revision history and Reset to Step have different jobs:

- Revision history browses or restores generated text.
- Reset to Step invalidates later stage outputs after the user changes an earlier decision.

## Implementation Plan

### Phase 1: Planning And Contracts

- Add this planning document.
- Decide final file names, storage kind strings, and cleanup policy.
- Define the opener stage map and Reset to Step clearing rules.
- Define global session scope and lore-source modes.
- Define source intent manifest shape and latest-lore rebinding behavior.
- Define the Opener Context Packet shape.
- Define the Opener Brief shape.
- Define provider prompt contracts and output normalization for candidate refinement, brief, and final opener stages.

### Phase 2: Storage

- Add Story Opener storage adapter.
- Add opener index read/write helpers.
- Add session payload read/write helpers.
- Add source intent manifest read/write helpers.
- Add source health/status computation without writing on open.
- Register opener files in the master storage index.
- Add delete-session cleanup.
- Add stale-write checks.
- Add write ordering: session payload first, then index summary.
- Add orphan/mismatch reconciliation for index, session payloads, and master storage index records.
- Add Total Saga Cleanup coverage.

### Phase 3: Session UI

- Add Story Opener Creator section to Session.
- Add session shelf/list and active session panel.
- Add Creator-style stage bar.
- Add current-task card.
- Add Reset to Step controls for eligible completed opener stages.
- Add controls for User Prompt, Prose Style, Opening Shape, Character Focus, PoV/Tense, and Variants.
- Add Target Length bands: `Hook`, `Scene`, and `First Message`.
- Add Prose Style seed generation from current or resolved source stack/context.
- Add source status display for `current`, `changed`, `partial`, and `missing`.
- Add source actions when needed: `Refresh From Saved Sources`, `Use Current Active Stack`, and `Rebind Missing Sources`.
- Add Copy button.
- Add Browse Context route when Context is unset.

### Phase 4: Guardrail Packet

- Build local fandom/style detection.
- Build lore-source mode detection: `loredeck_only` vs `chat_enriched`.
- Build source intent capture for new sessions.
- Build latest-lore source resolution for resumed sessions.
- Build Context-aware eligible lore collection.
- Prefer accepted/current chat Lorecards when present, after Context gates.
- Fall back cleanly to source Loredeck facts and suggested/eligible Lorecards when no chat is open.
- Build hard future-lore exclusion.
- Build salience ranking.
- Add unit tests for before/at/after timeline boundary behavior.

### Phase 5: Generation And Revision

- Add generate action.
- Add revise action.
- Add optional provider-assisted candidate refinement with local fallback and ID validation.
- Add Opener Brief generation and reuse.
- Add provider progress status.
- Add typed provider failure reporting for brief and opener stages.
- Add candidate refinement and Opener Brief parse, repair, and stage-contract validation using the shared generation-hardening patterns.
- Add variant runs with partial success preservation.
- Add output/error normalization.
- Add revision history persistence.

### Phase 6: Verification

- Add storage-contract tests for index/session create, update, stale write, and delete.
- Add file-reconciliation tests for missing payloads, orphan payloads, stale index summaries, and master-index mismatches.
- Add source-resume tests for `current`, `changed`, `partial`, and `missing` source states.
- Add tests proving opening a resumed opener does not mutate active stack, Context, or active chat Lorecards.
- Add latest-lore generation tests proving new revisions rebuild from resolved current files rather than historical compact packets.
- Add reset-to-step tests for every opener stage.
- Add prompt-packet tests for Context gating and fresh-context salience.
- Add lore-source tests for no-chat `loredeck_only` mode and active-chat `chat_enriched` priority.
- Add candidate-refinement tests for valid ID selection, unknown-ID discard, future-ID discard, and local-salience fallback.
- Add brief-stage tests that ensure the first Reasoning Provider call cannot introduce unsupported canon facts.
- Add failure-message tests for token-limit, context-limit, reasoning-only, empty-content, malformed-brief, and stage-contract failures.
- Add parser/repair tests for fenced JSON, provider-shaped chat-completion objects, balanced-object extraction, malformed-but-repairable brief JSON, unrecoverable JSON, unsupported repaired facts, and final opener fence stripping.
- Add UI static smoke coverage for Session section and target markers.
- Add live-provider smoke coverage once the feature can run end to end.
- Update user docs after implementation, not before.

## Acceptance Criteria

- Story Opener Creator appears in Session without bloating the Session root mobile summary.
- Story Opener Creator uses a Creator-style stage bar and current-task card.
- Reset to Step keeps earlier opener data, clears downstream opener artifacts, and is disabled during active provider runs.
- Prose Style is an editable text field pre-populated from current or resolved source stack and Context signals.
- Target Length offers `Hook`, `Scene`, and `First Message` bands without requiring exact word counts.
- Users can create, resume, revise, copy, and delete opener sessions.
- Opener sessions persist in external `/user/files` payloads with compact index summaries.
- Opener sessions are global and remain available across chat switches and empty-chat states.
- Opening a resumed opener never mutates the active Loredeck stack, active Context, active chat, or accepted Lorecards.
- Resumed openers display saved variants/revisions even when their original sources changed or disappeared.
- New generation/revision resolves the opener's saved source intent against latest available lore before building a Context Packet.
- Historical compact packets and briefs are retained for diagnostics/history, but they are not source authority for new provider calls.
- Source status reports `current`, `changed`, `partial`, or `missing` and gives the user the right source action.
- Deleting a session deletes its payload and removes index/master-index records.
- Generation can run in `loredeck_only` mode when no chat is open, as long as active Loredecks and usable Context exist.
- Generation uses `chat_enriched` mode when accepted/current chat Lorecards are available, preferring those Lorecards after Context gates.
- Generation uses the Reasoning Provider route.
- Generation uses a bounded quality-first pipeline: local Context Packet, optional candidate refinement, Opener Brief, and opener text.
- Candidate refinement can only rank/select eligible local fact IDs and must fall back or fail clearly if the provider output is unusable.
- Opener Brief output uses the shared parse -> repair -> validate flow and never commits repaired facts that are not supported by the local Context packet.
- Provider failures tell the user what failed and how to recover, especially when Reasoning Provider Max Tokens or model context limits are likely too low.
- Revision history persists across reloads.
- Variants produce three independently browseable outputs and preserve partial successes.
- Context-gated future lore is excluded from prompt facts and represented as avoid constraints when needed.
- Fresh high-salience discoveries near the selected Context can dominate the opener.
- Missing or stale Context routes the user toward Browse Context instead of silently inventing certainty.
- File handling writes payloads before index summaries, uses stale-write checks, and reconciles missing/orphaned opener files on load or cleanup.

## Open Decisions

- What exact eligible-fact count or ambiguity signal should trigger candidate refinement automatically?
- What makes a missing prior chat overlay important enough to require rebind instead of automatically downgrading to latest `loredeck_only` mode?
- Should Prose Style seed refresh overwrite only when `proseStyleUserEdited` is false, or should it always ask first?
- Should revision history have a visible prune/delete control in alpha, or only delete via whole-session deletion?

## Resolved Planning Decisions

- Opener sessions are global user data, not chat-scoped.
- No active chat is required; use `loredeck_only` mode from active Loredecks plus Context.
- When an active chat has accepted/current Lorecards, use `chat_enriched` mode and prefer those Lorecards after Context gates.
- Resuming an opener does not mutate or temporarily replace the active Loredeck stack, active Context, active chat, or accepted Lorecards.
- Opener files store source intent plus historical diagnostics, not full Loredeck payloads.
- Existing variants/revisions must remain loadable and copyable even when sources have changed or gone missing.
- New generation/revision uses latest lore resolved from the opener's source intent, not historical compact packet facts.
- `Refresh From Saved Sources`, `Use Current Active Stack`, and `Rebind Missing Sources` are the explicit source-retargeting actions.
- Opening a session computes source health without writing the file; writes happen only on meaningful user actions.
- Session payload writes happen before index summary writes, with reconciliation for orphaned/missing files.
- Provider cost is not a primary constraint for this feature. Prefer the pipeline that produces the best opener quality within a small bounded call count.
- Variant generation defaults to three concurrent opener-writing calls after any required candidate refinement and one Opener Brief call.
- Candidate refinement is automatic and internal, not another visible control.
- Provider-assisted selection can refine emphasis but cannot override deterministic hard gates or introduce facts outside the local Context packet.
