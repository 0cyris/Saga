# Addendum 06: Hybrid Retrieval And Archive Recall

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga's Loredeck stack should retrieve the right lore, rules, and prior-scene context without forcing every important card into the prompt all the time. This addendum defines hybrid retrieval, archive recall, and explicit activation modes.

The goal is not to port Narrative Engine's server/vector stack. The goal is to import the method: combine deterministic retrieval, source-backed archive recall, optional semantic selection, and auditable omission reasons inside Saga's frontend-first architecture.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\context\context-resolver.js`
- `F:\git\Saga\src\context\auto-relevance.js`
- `F:\git\Saga\src\context\context-index.js`
- `F:\git\Saga\src\lorecards\lore-relevance.js`
- `F:\git\Saga\src\lorecards\retrieval-audit.js`
- `F:\git\Saga\src\lorecards\lore-injection-filter.js`
- `F:\git\Saga\src\continuity\memo-builder.js`
- `F:\git\Saga\src\loredecks\loredeck-health-engine.js`

Saga already has relevance tiers and automation plans. Retrieval should become the shared explanation layer under those features.

## Retrieval Domains

Retrieval should run across separate domains:

| Domain | Content |
| --- | --- |
| `lore` | Setting facts, character facts, locations, items, history. |
| `rules` | Mechanics, constraints, abilities, canon rules, safety gates. |
| `timeline` | Era, date, phase, arc, chapter, school year, episode range. |
| `entities` | Characters, groups, species, locations, organizations. |
| `archive` | Source-backed summaries and prior scene recall. |
| `package` | Story Package setup and scenario overlays. |
| `session` | Current scene, player role, accepted session facts. |

Rules should not be treated as ordinary lore. A rule can be short and critical even when its keyword score is low.

## Activation Modes

Lorecards and facts should declare activation modes:

| Mode | Meaning |
| --- | --- |
| `always` | Include when deck/package is active unless blocked by audience or budget policy. |
| `keyword` | Activate on primary or secondary trigger matches. |
| `entityOverlap` | Activate when current context references linked entities. |
| `timelineOverlap` | Activate when current scene falls within linked time/phase range. |
| `semanticHint` | Candidate for model/embedding semantic selection. |
| `rule` | Treat as operating rule with rule-priority handling. |
| `manual` | Only include when user pins/elevates/selects it. |
| `sourceRequired` | Include only when a source frame or selected text justifies it. |
| `packageActive` | Include only when a referencing Story Package/playthrough is active. |

Pack Health should reject or warn about cards with no viable activation path.

## Candidate Pipeline

The retrieval pipeline should be deterministic first:

```text
Build query context
  -> collect direct pins/manual/elevated cards
  -> collect always/rule/package candidates
  -> lexical keyword search
  -> entity/timeline overlap
  -> source-frame/sourceRequired matches
  -> archive recall candidates
  -> optional semantic curation
  -> rank and diversify
  -> budget into context packet
  -> record included and omitted candidates
```

Semantic curation can be a Utility model call or an optional embedding-backed index later. The system should work without embeddings.

## Scoring

Each candidate should carry score components:

```json
{
  "candidateId": "lorecard:hp-year-2:chamber-location",
  "domain": "lore",
  "score": 0.86,
  "components": {
    "manualBoost": 0,
    "keyword": 0.34,
    "entityOverlap": 0.22,
    "timelineOverlap": 0.15,
    "sourceProximity": 0,
    "recency": 0.05,
    "priority": 0.1
  },
  "activationModes": ["keyword", "entityOverlap", "timelineOverlap"],
  "matchedTriggers": ["Chamber of Secrets", "Hogwarts"],
  "omissionReason": ""
}
```

This gives the UI and tests something better than "the model thought so."

## Diversification

Ranking should prevent one topic from filling the entire prompt. Use a simple diversification policy:

- reserve floors for critical rules and continuity;
- cap repeated entity clusters;
- prefer one high-quality summary over many duplicate cards;
- keep player-selected/pinned content above automatic candidates;
- include conflict winners and omit conflict losers;
- prefer current timeline/phase over broad era cards when both are available.

## Archive Recall

Archive recall should summarize accepted source frames and prior scene facts. It should not require a database server.

Initial implementation can use:

- source-frame summaries stored in playthrough state;
- lexical search over summary/excerpt fields;
- entity and timeline links;
- recency windows;
- source hash validation.

Later implementation can add embeddings if a host/provider supports them.

Archive recall records should look like:

```json
{
  "id": "archive-recall-20260630-0003",
  "sourceFrameIds": ["source-frame-chat-20260622-0010"],
  "summary": "Harry promised not to tell Ron about the diary yet.",
  "entityIds": ["entity:harry-potter", "entity:ron-weasley", "entity:tom-riddle-diary"],
  "timelineIds": ["timeline:hp-year-2:winter"],
  "textHash": "sha256:...",
  "createdByRole": "source.summarize",
  "status": "current"
}
```

## Lore Check

Lore Check should become a retrieval consumer. Given selected text or a source frame, it should gather:

- related Lorecards;
- rules;
- continuity graph facts;
- archive recall;
- known conflicts;
- reveal gates.

It should return:

- no issue;
- possible issue with evidence;
- contradiction with evidence;
- spoiler/reveal leak;
- suggested rewrite proposal.

Lore Check does not mutate content by itself.

## Loredeck And Lorecard Implications

Lorecards need retrieval metadata:

- `activationModes`;
- `primaryTriggers`;
- `secondaryTriggers`;
- `semanticHints`;
- `relatedEntityIds`;
- `relatedLocationIds`;
- `timelineIds`;
- `ruleType`;
- `retrievalWeight`;
- `alwaysIncludeReason`;
- `sourceRequiredPolicy`.

Bundled decks need cleanup so critical cards are not all `always`. Generated decks need Deck Maker prompts that produce triggers and entity links while drafting the card.

## Required Updates

Implementation of this addendum will require updates to:

- new `F:\git\Saga\src\retrieval\retrieval-engine.js`;
- new `F:\git\Saga\src\retrieval\retrieval-candidate.js`;
- new `F:\git\Saga\src\retrieval\retrieval-scoring.js`;
- new `F:\git\Saga\src\retrieval\archive-recall.js`;
- `F:\git\Saga\src\context\context-resolver.js`;
- `F:\git\Saga\src\context\auto-relevance.js`;
- `F:\git\Saga\src\lorecards\retrieval-audit.js`;
- Loredeck normalizer and health engine;
- Deck Maker generation prompts;
- Context Workbench retrieval diagnostics.

## Verification

The slice is complete when:

1. A fixture query can explain every included and omitted candidate.
2. Retrieval works without embeddings or external server support.
3. Rule cards receive rule-priority handling.
4. Archive recall returns source-backed summaries and excludes stale source summaries.
5. Lore Check can gather evidence from Lorecards, rules, graph facts, and archive recall.
6. Pack Health catches cards with dead triggers or unsafe always-on behavior.

