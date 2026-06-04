import assert from 'node:assert/strict';
import {
  buildLorepackAssistantSystemPrompt,
  buildLorepackAssistantUserPrompt,
  parseLorepackAssistantResponse,
} from '../lorepack-assistant.js';

const parsed = parseLorepackAssistantResponse(`\`\`\`json
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
        "storyPositionFit": "medium",
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

const clarification = parseLorepackAssistantResponse({
  toString() {
    return '{"clarifyingQuestions":["More violent or more manipulative?"],"proposals":[]}';
  },
});
assert.equal(clarification.clarifyingQuestions[0], 'More violent or more manipulative?');
assert.equal(clarification.proposals.length, 0);

const systemPrompt = buildLorepackAssistantSystemPrompt();
assert.ok(systemPrompt.includes('high-value scene context'));
assert.ok(systemPrompt.includes('Pending Review'));
assert.ok(systemPrompt.includes('Lore Value Rubric'));
assert.ok(systemPrompt.includes('selectedDraftProposals'));

const userPrompt = buildLorepackAssistantUserPrompt({
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

console.log('Lorepack assistant tests passed.');
