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
      "confidence": 0.82
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

const userPrompt = buildLorepackAssistantUserPrompt({
  instruction: 'Make the villains more coercive.',
  mode: 'revise_entries',
  pack: { packId: 'one-piece-arlong-park' },
  allowedTimelineAnchorIds: ['op.arlong.start'],
  knownTags: ['character:nami'],
  targetEntries: [{ id: 'nami_bargain', title: 'Nami hides the bargain' }],
});
const userJson = JSON.parse(userPrompt);
assert.equal(userJson.instruction, 'Make the villains more coercive.');
assert.equal(userJson.allowedTimelineAnchorIds[0], 'op.arlong.start');

console.log('Lorepack assistant tests passed.');
