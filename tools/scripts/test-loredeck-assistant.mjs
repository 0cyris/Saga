import assert from 'node:assert/strict';
import {
  buildLoredeckAssistantSystemPrompt,
  buildLoredeckAssistantUserPrompt,
  buildLoredeckCreatorBriefSystemPrompt,
  buildLoredeckCreatorBriefUserPrompt,
  buildLoredeckCreatorTitleSystemPrompt,
  buildLoredeckCreatorTitleUserPrompt,
  buildLoredeckCreatorOutlineSystemPrompt,
  buildLoredeckCreatorOutlineUserPrompt,
  buildLoredeckCreatorPlanningSystemPrompt,
  buildLoredeckCreatorPlanningUserPrompt,
  buildLoredeckCreatorEntrySystemPrompt,
  buildLoredeckCreatorEntryUserPrompt,
  LOREDECK_ASSISTANT_RESPONSE_CODES,
  parseLoredeckAssistantResponse,
  parseLoredeckCreatorBriefResponse,
  parseLoredeckCreatorOutlineResponse,
  parseLoredeckCreatorTitleResponse,
} from '../../src/loredecks/loredeck-assistant.js';

const parsed = parseLoredeckAssistantResponse(`\`\`\`json
{
  "summary": "Drafted changes.",
  "clarifyingQuestions": [],
  "proposals": [
    {
      "action": "upsert_entry",
      "title": "Save entry: Nami hides the bargain",
      "entryId": "nami_bargain",
      "entry": {
        "id": "nami_bargain",
        "title": "Nami hides the bargain",
        "content": {
          "fact": "Nami hides her bargain with Arlong from the crew.",
          "injection": "When Nami is pressed about Arlong, show evasive fear and practiced deflection."
        }
      },
      "reason": "Behavioral scene context.",
      "confidence": 0.82,
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "medium",
        "behavioralImpact": "high",
        "relationshipImpact": "n/a",
        "conflictStakes": "medium",
        "nonRedundancy": "high",
        "injectionQuality": "high",
        "contextFit": "medium",
        "wikiSummaryRisk": "low",
        "notes": ["Playable behavior, not biography."]
      }
    },
    {
      "action": "unsupported_action",
      "title": "Ignore me"
    }
  ]
}
\`\`\``);

assert.equal(parsed.summary, 'Drafted changes.');
assert.equal(parsed.proposals.length, 1);
assert.equal(parsed.proposals[0].action, 'upsert_entry');
assert.equal(parsed.proposals[0].entryId, 'nami_bargain');
assert.equal(parsed.proposals[0].confidence, 0.82);
assert.equal(parsed.proposals[0].risk, 'low');
assert.equal(parsed.proposals[0].rubric.sceneUtility, 'high');
assert.equal(parsed.proposals[0].rubric.relationshipImpact, 'not_applicable');
assert.equal(parsed.proposals[0].rubric.wikiSummaryRisk, 'low');
assert.equal(parsed.proposals[0].rubric.notes[0], 'Playable behavior, not biography.');
assert.equal(parsed.warnings.length, 1);

const planningChatContent = JSON.stringify({
  summary: "Timeline anchors for Nami's pressure beats and a core tag definition.",
  clarifyingQuestions: [],
  warnings: [],
  proposals: [
    {
      action: 'upsert_timeline_anchor',
      title: "Create anchor: Nami's Arlong allegiance exposed",
      timelineId: 'one-piece.arlong.nami-betrayal-reveal',
      timelineAnchor: {
        id: 'one-piece.arlong.nami-betrayal-reveal',
        label: "Nami's Arlong allegiance exposed",
        contextType: 'reveal',
        sortKey: 20,
        arc: 'Arlong Park',
        aliases: ['nami betrayal', 'crew sees nami as enemy'],
        tags: ['arc:arlong-park', 'character:nami'],
        notes: "Trust fracture start; before this, Nami's deal is unknown to crew.",
      },
      reason: "Critical before/after boundary for canon leakage on Nami's secret.",
      confidence: 0.9,
      risk: 'low',
      rubric: { sceneUtility: 'high', contextFit: 'high', wikiSummaryRisk: 'low' },
    },
    {
      action: 'upsert_tag_definition',
      title: 'Define tag: character:nami',
      tagDefinition: {
        id: 'character:nami',
        label: 'Nami',
        category: 'character',
        description: 'Navigator of the Straw Hats; central pressure point of the Arlong Park arc.',
        aliases: ['cat burglar'],
        parentTagId: null,
        coverageDimensionIds: ['character-pressure'],
      },
      reason: 'Core character for this batch.',
      confidence: 0.95,
      risk: 'low',
    },
  ],
});
const planningFromChatCompletion = parseLoredeckAssistantResponse({
  id: 'chatcmpl-planning-fixture',
  object: 'chat.completion',
  choices: [{
    index: 0,
    message: {
      role: 'assistant',
      content: planningChatContent,
    },
    finish_reason: 'stop',
  }],
});
assert.equal(planningFromChatCompletion.summary, "Timeline anchors for Nami's pressure beats and a core tag definition.");
assert.equal(planningFromChatCompletion.proposals.length, 2);
assert.equal(planningFromChatCompletion.proposals[0].action, 'upsert_timeline_anchor');
assert.equal(planningFromChatCompletion.proposals[0].timelineId, 'one-piece.arlong.nami-betrayal-reveal');
assert.equal(planningFromChatCompletion.proposals[0].timelineAnchor.label, "Nami's Arlong allegiance exposed");
assert.equal(planningFromChatCompletion.proposals[1].tagId, 'character:nami');

const clarification = parseLoredeckAssistantResponse({
  toString() {
    return '{"clarifyingQuestions":["More violent or more manipulative?"],"proposals":[]}';
  },
});
assert.equal(clarification.clarifyingQuestions[0], 'More violent or more manipulative?');
assert.equal(clarification.proposals.length, 0);

const systemPrompt = buildLoredeckAssistantSystemPrompt();
assert.ok(systemPrompt.includes('high-value scene context'));
assert.ok(systemPrompt.includes('Pending Review'));
assert.ok(systemPrompt.includes('Lore Value Rubric'));
assert.ok(systemPrompt.includes('selectedDraftProposals'));

const userPrompt = buildLoredeckAssistantUserPrompt({
  instruction: 'Make the villains more coercive.',
  mode: 'revise_entries',
  pack: { packId: 'one-piece-arlong-park' },
  allowedTimelineAnchorIds: ['op.arlong.start'],
  knownTags: ['character:nami'],
  selectedDraftProposals: [{ changeId: 'lpchg_1', action: 'assistant_upsert_entry', title: 'Draft Nami' }],
  selectedHealthIssues: [{ issueId: 'health_1', severity: 'warning', code: 'undefined_tag', tagIds: ['character:nami'] }],
  targetEntries: [{ id: 'nami_bargain', title: 'Nami hides the bargain' }],
});
const userJson = JSON.parse(userPrompt);
assert.equal(userJson.instruction, 'Make the villains more coercive.');
assert.equal(userJson.allowedTimelineAnchorIds[0], 'op.arlong.start');
assert.equal(userJson.loreValueRubric.target, 'High-value scene context, not wiki completeness.');
assert.ok(userJson.loreValueRubric.rubricKeys.includes('behavioralImpact'));
assert.equal(userJson.selectedDraftProposals[0].changeId, 'lpchg_1');
assert.equal(userJson.selectedHealthIssues[0].code, 'undefined_tag');

const creatorBrief = parseLoredeckCreatorBriefResponse(`{
  "summary": "Arlong Park is a workable focused arc.",
  "clarifyingQuestions": [],
  "brief": {
    "title": "Arlong Park Arc",
    "packId": "one-piece-arlong-park",
    "fandom": "One Piece",
    "scope": "Arlong Park Arc",
    "granularity": "focused",
    "coverage": "Covers Nami's bargain, Arlong's control, Cocoyasi pressure, and Straw Hat intervention.",
    "creatorCoverage": {
      "storyShape": "single arc",
      "storyDensity": "dense",
      "scopeKind": "arc",
      "status": "thin",
      "rationale": "Arlong Park needs character, faction, village, and battle pressure coverage.",
      "expectedCoverage": "Dense enough for arc roleplay without a fixed entry threshold.",
      "likelyNotApplicable": ["Tournament mechanics"],
      "dimensions": [
        {
          "id": "character-pressure",
          "label": "Character pressure",
          "kind": "characters",
          "status": "missing",
          "priority": 90,
          "rationale": "Nami, Arlong, villagers, and the crew carry the playable pressure.",
          "evidenceTargets": ["Nami secrecy", "Arlong coercion"]
        }
      ]
    },
    "contextApproach": "Use arc windows plus anchors for arrival, Nami reveal, battle, and aftermath.",
    "estimatedEntryRange": { "min": 70, "max": 120, "rationale": "Focused arc with several factions and relationship states." },
    "timelinePlan": ["Draft arc start/reveal/battle/aftermath anchors."],
    "tagPlan": ["character:nami", "faction:arlong-pirates"],
    "titlePassPlan": ["Generate character pressure titles first."],
    "assumptions": ["Anime/manga broad canon treated together."],
    "exclusions": ["Post-Arlong Park material."],
    "risks": ["Avoid broad biography."],
    "nextStage": "Draft timeline anchors/windows."
  }
}`);
assert.equal(creatorBrief.brief.title, 'Arlong Park Arc');
assert.equal(creatorBrief.brief.estimatedEntryRange.min, 70);
assert.equal(creatorBrief.brief.timelinePlan[0], 'Draft arc start/reveal/battle/aftermath anchors.');
assert.equal(creatorBrief.brief.creatorCoverage.storyDensity, 'dense');
assert.equal(creatorBrief.brief.creatorCoverage.dimensions[0].id, 'character-pressure');

const creatorClarification = parseLoredeckCreatorBriefResponse(`{
  "summary": "Scope is too broad.",
  "clarifyingQuestions": ["Which One Piece arc should this cover?"],
  "brief": null
}`);
assert.equal(creatorClarification.brief, null);
assert.equal(creatorClarification.clarifyingQuestions[0], 'Which One Piece arc should this cover?');

const creatorSystemPrompt = buildLoredeckCreatorBriefSystemPrompt();
assert.ok(creatorSystemPrompt.includes('Do not generate Lorecards'));
assert.ok(creatorSystemPrompt.includes('Lorecard count is derived from granularity'));
assert.ok(creatorSystemPrompt.includes('adaptive creatorCoverage plan'));

const creatorUserPrompt = buildLoredeckCreatorBriefUserPrompt({
  fandom: 'One Piece',
  scope: 'Arlong Park Arc',
  granularity: 'focused',
  notes: 'Focus on pressure and secrets.',
  previousBrief: creatorBrief.brief,
  revisionInstruction: 'Narrow the title pass around Nami.',
});
const creatorUserJson = JSON.parse(creatorUserPrompt);
assert.equal(creatorUserJson.fandom, 'One Piece');
assert.equal(creatorUserJson.constraints.entryCountMustBeDerived, true);
assert.equal(creatorUserJson.constraints.adaptiveCoveragePlanRequired, true);
assert.equal(creatorUserJson.previousBrief.packId, 'one-piece-arlong-park');
assert.equal(creatorUserJson.previousBrief.creatorCoverage.dimensions[0].id, 'character-pressure');

const creatorOutline = parseLoredeckCreatorOutlineResponse(`{
  "summary": "Arlong Park outline drafted.",
  "clarifyingQuestions": [],
  "warnings": [],
  "outline": {
    "label": "Arlong Park Arc outline",
    "coverageSummary": "Nami's coercion, Arlong's regime, the Straw Hats' commitment, and Cocoyashi's liberation.",
    "creatorCoverage": {
      "storyShape": "single arc",
      "storyDensity": "dense",
      "scopeKind": "arc",
      "status": "thin",
      "rationale": "Outline preserves coverage around characters and setting pressure.",
      "expectedCoverage": "Title batches should cover every applicable dimension without padding.",
      "dimensions": [
        {
          "id": "character-pressure",
          "label": "Character pressure",
          "kind": "characters",
          "status": "thin",
          "priority": 90,
          "rationale": "Needs titles for Nami, Arlong, villagers, and crew commitment.",
          "evidenceTargets": ["Nami secrecy", "Arlong coercion"],
          "titleBatchIds": ["characters-pressure"]
        }
      ]
    },
    "beats": [
      {
        "id": "nami-asks-for-help",
        "label": "Nami asks Luffy for help",
        "type": "emotional_pivot",
        "order": 50,
        "summary": "Nami breaks under Arlong's betrayal and asks Luffy to help.",
        "contextRole": "Boundary between Nami alone and crew committed.",
        "titleTargets": ["Nami coercion", "Luffy promise"]
      }
    ],
    "contextMilestones": [
      {
        "id": "after-broken-deal",
        "label": "After Arlong's betrayal",
        "type": "before_after",
        "order": 40,
        "summary": "Nami's savings are confiscated and her bargain collapses.",
        "contextRole": "Useful for despair, rage, or rescue scenes."
      }
    ],
    "titleBatches": [
      {
        "id": "characters-pressure",
        "label": "Characters and pressure",
        "type": "title_batch",
        "order": 10,
        "summary": "Future title slice for coercion, loyalties, and obligations.",
        "coverageDimensionIds": ["character-pressure"]
      }
    ],
    "assumptions": ["Broad manga/anime canon blend."],
    "risks": ["Avoid leaking later crew history."]
  }
}`);
assert.equal(creatorOutline.outline.beats.length, 1);
assert.equal(creatorOutline.outline.contextMilestones[0].id, 'after-broken-deal');
assert.equal(creatorOutline.outline.titleBatches[0].id, 'characters-pressure');
assert.equal(creatorOutline.outline.creatorCoverage.dimensions[0].titleBatchIds[0], 'characters-pressure');
assert.equal(creatorOutline.outline.titleBatches[0].coverageDimensionIds[0], 'character-pressure');

assert.throws(
  () => parseLoredeckCreatorOutlineResponse('{"summary":"Cut off","outline":{"label":"Arlong","beats":[{"id":"nami"'),
  /truncated JSON/,
);

const creatorOutlineSystemPrompt = buildLoredeckCreatorOutlineSystemPrompt();
assert.ok(creatorOutlineSystemPrompt.includes('Aim for under 1600 visible JSON tokens'));
assert.ok(creatorOutlineSystemPrompt.includes('coverageDimensionIds'));
const creatorOutlineUserPrompt = buildLoredeckCreatorOutlineUserPrompt({
  brief: creatorBrief.brief,
  notes: 'Keep the outline compact.',
});
const creatorOutlineUserJson = JSON.parse(creatorOutlineUserPrompt);
assert.equal(creatorOutlineUserJson.approvedBrief.packId, 'one-piece-arlong-park');
assert.equal(creatorOutlineUserJson.constraints.compactJson, true);
assert.equal(creatorOutlineUserJson.constraints.titleBatchesMustReferenceCoverageDimensions, true);

const creatorTitlePass = parseLoredeckCreatorTitleResponse(`{
  "summary": "Drafted character pressure titles.",
  "clarifyingQuestions": [],
  "batch": {
    "label": "Character pressure",
    "coverage": "Nami, Arlong, villagers, and Straw Hat pressure points.",
    "nextBatchHint": "Faction and setting constraints.",
    "complete": false
  },
  "titleDrafts": [
    {
      "titleId": "nami-hides-her-bargain",
      "title": "Nami hides her bargain with Arlong",
      "category": "character_pressure",
      "priority": 88,
      "relevance": "high",
      "contextHint": "From Cocoyasi arrival until Nami asks for help.",
      "tags": ["character:nami", "faction:arlong-pirates"],
      "reason": "Creates secrecy, pressure, and timing.",
      "coverageDimensionIds": ["character-pressure"],
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "high",
        "behavioralImpact": "high",
        "relationshipImpact": "medium",
        "conflictStakes": "high",
        "nonRedundancy": "high",
        "injectionQuality": "medium",
        "contextFit": "high",
        "wikiSummaryRisk": "low",
        "notes": ["Playable pressure, not biography."]
      }
    }
  ]
}`);
assert.equal(creatorTitlePass.titleDrafts.length, 1);
assert.equal(creatorTitlePass.titleDrafts[0].titleId, 'nami-hides-her-bargain');
assert.equal(creatorTitlePass.titleDrafts[0].rubric.wikiSummaryRisk, 'low');
assert.equal(creatorTitlePass.titleDrafts[0].coverageDimensionIds[0], 'character-pressure');
assert.equal(creatorTitlePass.batch.nextBatchHint, 'Faction and setting constraints.');
assert.deepEqual(creatorTitlePass.warningCodes, []);

const truncatedCreatorTitlePass = parseLoredeckCreatorTitleResponse(`\`\`\`json
{
  "summary": "Drafted character pressure titles.",
  "clarifyingQuestions": [],
  "warnings": [],
  "batch": {
    "label": "Character pressure",
    "coverage": "Nami, Arlong, villagers, and occupation pressure.",
    "nextBatchHint": "Locations next.",
    "complete": false
  },
  "titleDrafts": [
    {
      "titleId": "nami-coerced-cartography",
      "title": "Nami's coerced cartography",
      "category": "character_pressure",
      "priority": 90,
      "relevance": "high",
      "contextHint": "From occupation through the betrayal reveal.",
      "tags": ["character:nami"],
      "reason": "Turns Nami's talent into playable coercion.",
      "rubric": { "wikiSummaryRisk": "low" }
    },
    {
      "titleId": "arlong-iron-tribute",
      "title": "Arlong's iron tribute",
      "category": "faction_control",
      "priority": 85,
      "relevance": "high",
      "contextHint": "Ongoing under Arlong's rule.",
      "tags": ["character:arlong"],
      "reason": "Creates recurring survival pressure.",
      "rubric": { "wikiSummaryRisk": "low" }
    },
    {
      "titleId": "cut-off-row",
      "title": "This row never finishes"
`);
assert.equal(truncatedCreatorTitlePass.titleDrafts.length, 2);
assert.equal(truncatedCreatorTitlePass.titleDrafts[1].titleId, 'arlong-iron-tribute');
assert.ok(truncatedCreatorTitlePass.warnings.some(item => item.includes('salvaged complete title drafts')));
assert.deepEqual(truncatedCreatorTitlePass.warningCodes, [LOREDECK_ASSISTANT_RESPONSE_CODES.JSON_TRUNCATED_SALVAGED]);
assert.equal(truncatedCreatorTitlePass.batch.nextBatchHint, 'Locations next.');

const creatorTitleSystemPrompt = buildLoredeckCreatorTitleSystemPrompt();
assert.ok(creatorTitleSystemPrompt.includes('Generate titles only'));
assert.ok(creatorTitleSystemPrompt.includes('Do not generate full Lorecards'));
assert.ok(creatorTitleSystemPrompt.includes('selectedTitleDrafts'));
assert.ok(creatorTitleSystemPrompt.includes('Generate no more than titlePassLimit titles'));
assert.ok(creatorTitleSystemPrompt.includes('Keep the whole JSON compact'));
assert.ok(creatorTitleSystemPrompt.includes('coverageDimensionIds'));

const creatorTitleUserPrompt = buildLoredeckCreatorTitleUserPrompt({
  brief: creatorBrief.brief,
  notes: 'Keep titles practical.',
  previousTitleDrafts: creatorTitlePass.titleDrafts,
  selectedTitleDrafts: creatorTitlePass.titleDrafts,
  revisionInstruction: 'Make the title more coercive.',
  titlePassLimit: 80,
});
const creatorTitleUserJson = JSON.parse(creatorTitleUserPrompt);
assert.equal(creatorTitleUserJson.approvedBrief.packId, 'one-piece-arlong-park');
assert.equal(creatorTitleUserJson.constraints.titlesOnly, true);
assert.equal(creatorTitleUserJson.constraints.entryCountMustBeDerived, true);
assert.equal(creatorTitleUserJson.constraints.coverageDimensionIdsRequired, true);
assert.equal(creatorTitleUserJson.selectedTitleDrafts[0].titleId, 'nami-hides-her-bargain');
assert.equal(creatorTitleUserJson.selectedTitleDrafts[0].coverageDimensionIds[0], 'character-pressure');

const creatorCoverageTitleUserPrompt = buildLoredeckCreatorTitleUserPrompt({
  brief: creatorBrief.brief,
  outline: creatorOutline.outline,
  targetTitleBatch: {
    id: 'coverage-character-pressure',
    label: 'Coverage: Character pressure',
    type: 'coverage_gap',
    summary: 'Generate more title drafts for character-pressure coverage.',
    coverageDimensionIds: ['character-pressure'],
  },
  titlePassLimit: 8,
});
const creatorCoverageTitleUserJson = JSON.parse(creatorCoverageTitleUserPrompt);
assert.equal(creatorCoverageTitleUserJson.targetTitleBatch.id, 'coverage-character-pressure');
assert.equal(creatorCoverageTitleUserJson.targetTitleBatch.coverageDimensionIds[0], 'character-pressure');

const creatorPlanningSystemPrompt = buildLoredeckCreatorPlanningSystemPrompt();
assert.ok(creatorPlanningSystemPrompt.includes('Do not generate full Lorecards'));
assert.ok(creatorPlanningSystemPrompt.includes('upsert_timeline_anchor'));
assert.ok(creatorPlanningSystemPrompt.includes('upsert_tag_definition'));
assert.ok(creatorPlanningSystemPrompt.includes('Return no more than proposalLimit proposals'));
assert.ok(creatorPlanningSystemPrompt.includes('Prefer 6-10 strong proposals'));
assert.ok(creatorPlanningSystemPrompt.includes('final answer first'));
assert.ok(creatorPlanningSystemPrompt.includes('Keep the whole JSON compact'));

const truncatedPlanningPass = parseLoredeckAssistantResponse(`\`\`\`json
{
  "summary": "Drafted planning proposals.",
  "clarifyingQuestions": [],
  "warnings": [],
  "proposals": [
    {
      "action": "upsert_timeline_anchor",
      "title": "Create anchor: Cocoyasi arrival",
      "timelineId": "one-piece.arlong.cocoyasi-arrival",
      "timelineAnchor": {
        "id": "one-piece.arlong.cocoyasi-arrival",
        "label": "Cocoyasi arrival",
        "sortKey": 120
      },
      "reason": "Gives Context a clear early boundary.",
      "confidence": 0.82,
      "risk": "low"
    },
    {
      "action": "upsert_tag_definition",
      "title": "This row never finishes"
`);
assert.equal(truncatedPlanningPass.proposals.length, 1);
assert.equal(truncatedPlanningPass.proposals[0].action, 'upsert_timeline_anchor');
assert.ok(truncatedPlanningPass.warnings.some(item => item.includes('salvaged complete proposals')));
assert.deepEqual(truncatedPlanningPass.warningCodes, [LOREDECK_ASSISTANT_RESPONSE_CODES.JSON_TRUNCATED_SALVAGED]);

const creatorPlanningUserPrompt = buildLoredeckCreatorPlanningUserPrompt({
  generatedPackId: 'one-piece-arlong-park',
  brief: creatorBrief.brief,
  targetPlanningBatch: {
    id: 'characters-pressure',
    label: 'Characters and pressure',
    coverageDimensionIds: ['character-pressure'],
  },
  approvedTitleDrafts: creatorTitlePass.titleDrafts,
  notes: 'Draft a compact registry foundation.',
  existingTimelineIds: ['one-piece.arlong.start'],
  existingTagIds: ['character:nami'],
  proposalLimit: 40,
});
const creatorPlanningUserJson = JSON.parse(creatorPlanningUserPrompt);
assert.equal(creatorPlanningUserJson.generatedPackId, 'one-piece-arlong-park');
assert.equal(creatorPlanningUserJson.constraints.timelineAndTagsOnly, true);
assert.equal(creatorPlanningUserJson.constraints.noEntryGenerationYet, true);
assert.equal(creatorPlanningUserJson.constraints.preserveCoverageDimensionIds, true);
assert.equal(creatorPlanningUserJson.targetPlanningBatch.coverageDimensionIds[0], 'character-pressure');
assert.equal(creatorPlanningUserJson.approvedTitleDrafts[0].titleId, 'nami-hides-her-bargain');
assert.equal(creatorPlanningUserJson.approvedTitleDrafts[0].coverageDimensionIds[0], 'character-pressure');
assert.equal(creatorPlanningUserJson.existingTagIds[0], 'character:nami');

const creatorEntrySystemPrompt = buildLoredeckCreatorEntrySystemPrompt();
assert.ok(creatorEntrySystemPrompt.includes('Return only upsert_entry proposals'));
assert.ok(creatorEntrySystemPrompt.includes('schemaVersion 3'));
assert.ok(creatorEntrySystemPrompt.includes('content.fact'));
assert.ok(creatorEntrySystemPrompt.includes('content.injection'));
assert.ok(creatorEntrySystemPrompt.includes('Keep the whole JSON compact'));

const truncatedCreatorEntryPass = parseLoredeckAssistantResponse(`{
  "summary": "Drafted Lorecard proposals.",
  "clarifyingQuestions": [],
  "warnings": [],
  "proposals": [
    {
      "action": "upsert_entry",
      "title": "Draft entry: Nami hides her bargain",
      "entryId": "nami-hides-her-bargain",
      "entry": {
        "id": "nami-hides-her-bargain",
        "schemaVersion": 3,
        "title": "Nami hides her bargain",
        "category": "secret",
        "canon": "canon",
        "canonStatus": "canon",
        "relevance": "high",
        "priority": 88,
        "tags": ["character:nami"],
        "context": { "scope": "window", "sortKeyFrom": 120, "sortKeyTo": 180, "precision": "anchor_window", "label": "Cocoyasi reveal window" },
        "retrieval": { "activation": "context_or_topic", "frequency": "normal", "contextBoost": "high" },
        "content": {
          "fact": "Nami hides the bargain because Arlong holds Cocoyasi hostage.",
          "injection": "During this window, show Nami deflecting trust to protect Cocoyasi.",
          "notes": "Playable pressure."
        }
      },
      "reason": "Creates secrecy pressure.",
      "confidence": 0.84,
      "risk": "low"
    },
    {
      "action": "upsert_entry",
      "title": "This row never finishes"
`);
assert.equal(truncatedCreatorEntryPass.proposals.length, 1);
assert.equal(truncatedCreatorEntryPass.proposals[0].entryId, 'nami-hides-her-bargain');
assert.ok(truncatedCreatorEntryPass.warnings.some(item => item.includes('salvaged complete proposals')));
assert.deepEqual(truncatedCreatorEntryPass.warningCodes, [LOREDECK_ASSISTANT_RESPONSE_CODES.JSON_TRUNCATED_SALVAGED]);

const creatorEntryUserPrompt = buildLoredeckCreatorEntryUserPrompt({
  generatedPackId: 'one-piece-arlong-park',
  brief: creatorBrief.brief,
  targetTitleDrafts: [{
    ...creatorTitlePass.titleDrafts[0],
    targetEntryId: 'nami-hides-her-bargain',
  }],
  targetPlanningBatch: {
    id: 'characters-pressure',
    label: 'Characters and pressure',
    coverageDimensionIds: ['character-pressure'],
  },
  timelineRegistry: {
    anchors: [{ id: 'one-piece.arlong.cocoyasi-arrival', label: 'Cocoyasi arrival', sortKey: 120 }],
    windows: [{ id: 'one-piece.arlong.nami-secret', label: 'Nami secret', anchorFrom: 'one-piece.arlong.cocoyasi-arrival', anchorTo: 'one-piece.arlong.nami-asks-for-help' }],
  },
  tagRegistry: {
    tags: {
      'character:nami': { label: 'Nami', description: 'Navigator under pressure.' },
      'faction:arlong-pirates': { label: 'Arlong Pirates' },
    },
  },
  existingEntryIds: ['already-drafted'],
  notes: 'Keep this playable.',
  entryBatchLimit: 1,
});
const creatorEntryUserJson = JSON.parse(creatorEntryUserPrompt);
assert.equal(creatorEntryUserJson.generatedPackId, 'one-piece-arlong-park');
assert.equal(creatorEntryUserJson.constraints.upsertEntriesOnly, true);
assert.equal(creatorEntryUserJson.constraints.schemaVersion, 3);
assert.equal(creatorEntryUserJson.constraints.requireContext, true);
assert.equal(creatorEntryUserJson.constraints.preserveCoverageDimensionIds, true);
assert.equal(creatorEntryUserJson.targetTitleDrafts[0].targetEntryId, 'nami-hides-her-bargain');
assert.equal(creatorEntryUserJson.targetTitleDrafts[0].coverageDimensionIds[0], 'character-pressure');
assert.equal(creatorEntryUserJson.targetPlanningBatch.coverageDimensionIds[0], 'character-pressure');
assert.equal(creatorEntryUserJson.acceptedTagRegistry.tags['character:nami'].label, 'Nami');

console.log('Loredeck assistant tests passed.');
