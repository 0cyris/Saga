import assert from 'node:assert/strict';
import {
  buildLoreInjectionAudit,
  buildLoredeckRetrievalAudit,
  getLastLoreInjectionAudit,
  getLastLoredeckRetrievalAudit,
  recordLoreInjectionAudit,
  recordLoredeckRetrievalAudit,
  searchAcceptedLorecards,
} from '../../src/lorecards/retrieval-audit.js';

const YEAR_5_DECK_ID = 'hp-year-5-order-of-the-phoenix';

const state = {
  loredeckStack: [{ packId: YEAR_5_DECK_ID, enabled: true, priority: 100 }],
  loredeckContexts: {
    [YEAR_5_DECK_ID]: {
      contextType: 'calendar',
      label: 'Year 5',
      anchorId: 'hp.y5.year_5_hogwarts_return',
      contextSortKey: 9500,
      source: 'manual',
      confidence: 1,
    },
  },
  loreSelection: {
    pinnedIds: [],
    suppressedIds: ['muted_card'],
    elevated: {
      harry_secret: {
        elevatedAt: 1,
        previousRelevance: 'high',
        previousMuted: false,
        previousLoreAutomation: { enabled: true },
      },
    },
  },
  loreMatrix: [
    {
      id: 'harry_secret',
      title: 'Harry Secret',
      category: 'knowledge',
      relevance: 'high',
      priority: 90,
      content: { fact: 'Harry knows the hidden passage.' },
      extensions: { sagaLoredeck: { packId: YEAR_5_DECK_ID, stackIndex: 0, stackPriority: 100 } },
    },
    {
      id: 'muted_card',
      title: 'Muted Card',
      category: 'event',
      relevance: 'high',
      priority: 75,
      content: { fact: 'Muted fact should not inject.' },
    },
    {
      id: 'normal_card',
      title: 'Normal Card',
      category: 'character',
      relevance: 'normal',
      priority: 50,
      content: { fact: 'Hermione is studying arithmancy.' },
    },
  ],
};

const settings = {
  enabled: true,
  injectLore: true,
  loreHighInjectionEnabled: true,
  loreNormalInjectionEnabled: false,
  loreLowInjectionEnabled: true,
  loreHighMaxEntries: 10,
  loreNormalMaxEntries: 10,
  loreLowMaxEntries: 10,
};

const audit = buildLoreInjectionAudit(state, settings, {
  transport: 'extension_prompt',
  promptCharsByTier: { high: 120, normal: 0, low: 0 },
});

assert.equal(audit.summary.accepted, 3);
assert.equal(audit.summary.injected, 1);
assert.equal(audit.summary.elevatedInjected, 1);
assert.equal(audit.entries.find(entry => entry.id === 'harry_secret').decision, 'injected');
assert.equal(audit.entries.find(entry => entry.id === 'muted_card').decision, 'muted');
assert.equal(audit.entries.find(entry => entry.id === 'normal_card').decision, 'tier_disabled');

recordLoreInjectionAudit(audit);
assert.equal(getLastLoreInjectionAudit().summary.injected, 1);

const search = searchAcceptedLorecards(state, 'Hermione', { limit: 4 });
assert.equal(search.resultCount, 1);
assert.equal(search.results[0].id, 'normal_card');

const retrievalAudit = buildLoredeckRetrievalAudit({
  source: 'test',
  status: 'matched',
  databaseId: 'test-db',
  sceneIso: '1995-09-01',
  context: { sceneDate: '1995-09-01', canonBoundary: 'Year 5', branchId: 'main' },
  state,
  candidates: [{
    entry: state.loreMatrix[0],
    score: 88,
    eligibility: {
      matchedBy: 'context',
      contextGate: { status: 'match', reason: 'Context matched.' },
    },
  }],
  selectedCandidates: [{ entry: state.loreMatrix[0] }],
  maxEntries: 10,
});

recordLoredeckRetrievalAudit(retrievalAudit);
assert.equal(getLastLoredeckRetrievalAudit().summary.selected, 1);
assert.equal(getLastLoredeckRetrievalAudit().candidates[0].decision, 'selected');

console.log('Retrieval audit tests passed.');
