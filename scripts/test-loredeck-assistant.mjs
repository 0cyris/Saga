import assert from 'node:assert/strict';
import {
  buildLoredeckAssistantSystemPrompt,
  buildLoredeckAssistantUserPrompt,
  buildLoredeckCreatorBriefSystemPrompt,
  buildLoredeckCreatorBriefUserPrompt,
  buildLoredeckCreatorTitleSystemPrompt,
  buildLoredeckCreatorTitleUserPrompt,
  buildLoredeckCreatorPlanningSystemPrompt,
  buildLoredeckCreatorPlanningUserPrompt,
  buildLoredeckCreatorEntrySystemPrompt,
  buildLoredeckCreatorEntryUserPrompt,
  parseLoredeckAssistantResponse,
  parseLoredeckCreatorBriefResponse,
  parseLoredeckCreatorTitleResponse,
} from '../loredeck-assistant.js';

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
assert.equal(creatorUserJson.previousBrief.packId, 'one-piece-arlong-park');

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
assert.equal(creatorTitlePass.batch.nextBatchHint, 'Faction and setting constraints.');

const creatorTitleSystemPrompt = buildLoredeckCreatorTitleSystemPrompt();
assert.ok(creatorTitleSystemPrompt.includes('Generate titles only'));
assert.ok(creatorTitleSystemPrompt.includes('Do not generate full Lorecards'));
assert.ok(creatorTitleSystemPrompt.includes('selectedTitleDrafts'));

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
assert.equal(creatorTitleUserJson.selectedTitleDrafts[0].titleId, 'nami-hides-her-bargain');

const creatorPlanningSystemPrompt = buildLoredeckCreatorPlanningSystemPrompt();
assert.ok(creatorPlanningSystemPrompt.includes('Do not generate full Lorecards'));
assert.ok(creatorPlanningSystemPrompt.includes('upsert_timeline_anchor'));
assert.ok(creatorPlanningSystemPrompt.includes('upsert_tag_definition'));

const creatorPlanningUserPrompt = buildLoredeckCreatorPlanningUserPrompt({
  generatedPackId: 'one-piece-arlong-park',
  brief: creatorBrief.brief,
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
assert.equal(creatorPlanningUserJson.approvedTitleDrafts[0].titleId, 'nami-hides-her-bargain');
assert.equal(creatorPlanningUserJson.existingTagIds[0], 'character:nami');

const creatorEntrySystemPrompt = buildLoredeckCreatorEntrySystemPrompt();
assert.ok(creatorEntrySystemPrompt.includes('Return only upsert_entry proposals'));
assert.ok(creatorEntrySystemPrompt.includes('schemaVersion 3'));
assert.ok(creatorEntrySystemPrompt.includes('content.fact'));
assert.ok(creatorEntrySystemPrompt.includes('content.injection'));

const creatorEntryUserPrompt = buildLoredeckCreatorEntryUserPrompt({
  generatedPackId: 'one-piece-arlong-park',
  brief: creatorBrief.brief,
  targetTitleDrafts: [{
    ...creatorTitlePass.titleDrafts[0],
    targetEntryId: 'nami-hides-her-bargain',
  }],
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
assert.equal(creatorEntryUserJson.constraints.requirePosition, true);
assert.equal(creatorEntryUserJson.targetTitleDrafts[0].targetEntryId, 'nami-hides-her-bargain');
assert.equal(creatorEntryUserJson.acceptedTagRegistry.tags['character:nami'].label, 'Nami');

console.log('Loredeck assistant tests passed.');
