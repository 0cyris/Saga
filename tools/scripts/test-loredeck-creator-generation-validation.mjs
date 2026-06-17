import assert from 'node:assert/strict';
import {
  createLoredeckCreatorStageValidationFailure,
  hasLoredeckCreatorClarifyingQuestions,
  isLoredeckCreatorEntryDraftProposal,
  isLoredeckCreatorParsedArtifactUsable,
  isLoredeckCreatorParsedEntryDraftUsable,
  isLoredeckCreatorParsedPlanningUsable,
  isLoredeckCreatorParsedTitlePassUsable,
  isLoredeckCreatorPlanningProposal,
  validateLoredeckCreatorArtifactResult,
  validateLoredeckCreatorEntryDraftResult,
  validateLoredeckCreatorPlanningResult,
  validateLoredeckCreatorTitlePassResult,
} from '../../src/loredecks/loredeck-creator-generation-validation.js';

assert.deepEqual(
  createLoredeckCreatorStageValidationFailure(),
  {
    ok: false,
    code: 'creator_stage_contract_failed',
    message: 'Deck Maker response did not match the expected stage contract.',
  },
  'Default stage validation failures should use the shared Creator stage-contract code.',
);

assert.equal(hasLoredeckCreatorClarifyingQuestions({ clarifyingQuestions: ['Narrow the scope?'] }), true);
assert.equal(hasLoredeckCreatorClarifyingQuestions({ clarifyingQuestions: [] }), false);

assert.equal(isLoredeckCreatorParsedArtifactUsable({ brief: { title: 'East Blue' } }, 'brief'), true);
assert.equal(isLoredeckCreatorParsedArtifactUsable({ clarifyingQuestions: ['Which arc?'] }, 'brief'), true);
assert.equal(isLoredeckCreatorParsedArtifactUsable({ brief: null }, 'brief'), false);
assert.equal(
  validateLoredeckCreatorArtifactResult({ outline: null }, 'outline', 'Story Outline').code,
  'creator_outline_missing',
  'Missing stage artifacts should report the artifact-specific Creator code.',
);
assert.equal(validateLoredeckCreatorArtifactResult({ outline: { label: 'Arc' } }, 'outline', 'Story Outline'), true);

assert.equal(isLoredeckCreatorParsedTitlePassUsable({ titleDrafts: [{ title: 'Nami and Arlong' }] }), true);
assert.equal(isLoredeckCreatorParsedTitlePassUsable({ clarifyingQuestions: ['How dense?'] }), true);
assert.deepEqual(
  validateLoredeckCreatorTitlePassResult({ titleDrafts: [] }),
  {
    ok: false,
    code: 'creator_title_pass_no_title_drafts',
    message: 'Valid JSON returned no usable Deck Maker title drafts.',
  },
  'Title Pass should reject valid JSON with no title drafts or clarifying questions.',
);

assert.equal(isLoredeckCreatorPlanningProposal({ action: 'upsert_tag_definition' }), true);
assert.equal(isLoredeckCreatorPlanningProposal({ action: 'upsert_timeline_anchor' }), true);
assert.equal(isLoredeckCreatorPlanningProposal({ action: 'upsert_timeline_window' }), true);
assert.equal(isLoredeckCreatorPlanningProposal({ action: 'upsert_entry' }), false);
assert.equal(isLoredeckCreatorParsedPlanningUsable({ proposals: [{ action: 'upsert_tag_definition' }] }), true);
assert.equal(validateLoredeckCreatorPlanningResult({ clarifyingQuestions: ['Need timeline?'] }), true);
assert.deepEqual(
  validateLoredeckCreatorPlanningResult(null),
  {
    ok: false,
    code: 'creator_planning_invalid_result',
    message: 'Deck Maker Context and Tag planning returned no usable JSON object.',
  },
);
assert.deepEqual(
  validateLoredeckCreatorPlanningResult({ proposals: [{ action: 'upsert_entry' }] }),
  {
    ok: false,
    code: 'creator_planning_no_supported_actions',
    message: 'Valid JSON returned no supported Context or Tag planning proposals.',
  },
);
assert.deepEqual(
  validateLoredeckCreatorPlanningResult({ proposals: [] }),
  {
    ok: false,
    code: 'creator_planning_no_proposals',
    message: 'Valid JSON returned no Context or Tag planning proposals.',
  },
);

assert.equal(isLoredeckCreatorEntryDraftProposal({ action: 'upsert_entry' }), true);
assert.equal(isLoredeckCreatorEntryDraftProposal({ action: 'upsert_tag_definition' }), false);
assert.equal(isLoredeckCreatorParsedEntryDraftUsable({ proposals: [{ action: 'upsert_entry' }] }), true);
assert.equal(validateLoredeckCreatorEntryDraftResult({ clarifyingQuestions: ['Which titles?'] }), true);
assert.deepEqual(
  validateLoredeckCreatorEntryDraftResult([]),
  {
    ok: false,
    code: 'creator_entry_draft_invalid_result',
    message: 'Deck Maker Lorecard drafting returned no usable JSON object.',
  },
);
assert.deepEqual(
  validateLoredeckCreatorEntryDraftResult({ proposals: [{ action: 'upsert_tag_definition' }] }),
  {
    ok: false,
    code: 'creator_entry_draft_no_supported_actions',
    message: 'Valid JSON returned no supported Deck Maker Lorecard draft proposals.',
  },
);
assert.deepEqual(
  validateLoredeckCreatorEntryDraftResult({ proposals: [] }),
  {
    ok: false,
    code: 'creator_entry_draft_no_proposals',
    message: 'Valid JSON returned no Deck Maker Lorecard draft proposals.',
  },
);

console.log('Deck Maker generation validation tests passed.');
