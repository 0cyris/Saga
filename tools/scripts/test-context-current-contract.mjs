import assert from 'node:assert/strict';

import { getDefaultState, LORE_CONTEXT_DETECTION_SYSTEM_PROMPT } from '../../src/state/constants.js';
import { evaluateEntryContextGate, CONTEXT_GATE_STATUSES } from '../../src/context/context-gating.js';
import { loadContextIndexForState } from '../../src/context/context-index.js';
import { __contextResolverTestHooks } from '../../src/context/context-resolver.js';
import { __contextDetectionTestHooks } from '../../src/lorecards/lore-generator.js';
import { normalizeLoreContext } from '../../src/lorecards/lore-matrix.js';
import { getLoredeckContext, normalizeContextBrief } from '../../src/state/state-manager.js';

const { buildContextModelPrompt, buildContextPatchFromWindow, buildResolverText } = __contextResolverTestHooks;
const {
  buildContextBriefRepairPrompt,
  normalizeDetectedContextBrief,
  buildLoreContextFromContextBrief,
  buildResolverContextFromContextBrief,
  buildContextBriefFromLoreContext,
  hasUsableContextBrief,
} = __contextDetectionTestHooks;

const PACK_ID = 'synthetic-star-trek-tng-s5';

const registry = {
  schemaVersion: 1,
  packs: {
    [PACK_ID]: {
      packId: PACK_ID,
      type: 'custom',
      title: 'Synthetic Star Trek TNG Season 5',
      manifestData: {
        id: PACK_ID,
        type: 'custom',
        title: 'Synthetic Star Trek TNG Season 5',
        files: [],
      },
      timelineRegistry: {
        timelineMode: 'season_episode',
        defaultContextType: 'season_episode',
        anchors: [
          {
            id: 'tng.s05e01.redemption_ii',
            label: 'Redemption II',
            contextType: 'season_episode',
            sortKey: 501,
            arc: 'TNG Season 5',
            season: '5',
            episode: '1',
            aliases: ['Season 5 premiere'],
            coordinates: [{ axis: 'series', id: 'tng' }],
          },
          {
            id: 'tng.s05e02.darmok',
            label: 'Darmok',
            contextType: 'season_episode',
            sortKey: 502,
            arc: 'TNG Season 5',
            season: '5',
            episode: '2',
            stardate: '45047.2',
            stardateFrom: '45047.0',
            stardateTo: '45048.0',
            aliases: ['Darmok and Jalad', 'Stardate 45047.2'],
            tags: ['series:tng', 'episode:darmok'],
            coordinates: [{ axis: 'series', id: 'tng' }],
          },
        ],
        windows: [
          {
            id: 'tng.s05.window',
            label: 'TNG Season 5',
            contextType: 'season_episode',
            anchorFrom: 'tng.s05e01.redemption_ii',
            anchorTo: 'tng.s05e02.darmok',
            sortKeyFrom: 501,
            sortKeyTo: 526,
            arc: 'TNG Season 5',
            season: '5',
            stardateFrom: '45001.0',
            stardateTo: '45999.9',
            aliases: ['season five'],
            coordinates: [{ axis: 'series', id: 'tng' }],
          },
        ],
      },
    },
  },
};

const state = {
  loredeckStack: [
    { packId: PACK_ID, enabled: true, priority: 100, addedAt: 0 },
  ],
  loredeckContexts: {
    [PACK_ID]: {
      packId: PACK_ID,
      contextType: 'season_episode',
      label: 'Darmok',
      season: '5',
      episode: '2',
      stardate: '45047.2',
      coordinates: { series: 'tng' },
      manualLock: false,
      source: 'manual',
    },
  },
};

// Current detector contract: Context Brief extraction with media/story-position signals.
assert.match(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, /"sceneDate"/);
assert.match(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, /"canonBoundary"/);
assert.match(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, /"signals"/);
assert.match(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, /"arc"/);
assert.match(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, /"stardate"/);
assert.match(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, /"coordinates"/);

const globalContext = normalizeLoreContext({
  sceneDate: 'Stardate 45047.2',
  canonBoundary: 'TNG S05E02 Darmok',
  branchId: 'main',
  arc: 'TNG Season 5',
  season: '5',
  episode: '2',
  stardate: '45047.2',
});
assert.equal(globalContext.sceneDate, 'Stardate 45047.2');
assert.equal(globalContext.canonBoundary, 'TNG S05E02 Darmok');
assert.equal(globalContext.arc, undefined);
assert.equal(globalContext.season, undefined);
assert.equal(globalContext.episode, undefined);
assert.equal(globalContext.stardate, undefined);

const contextBrief = normalizeDetectedContextBrief({
  summary: 'Darmok and Jalad at Tanagra.',
  branchId: 'main',
  timeTravelMode: 'none',
  evidence: [{ quote: 'Darmok and Jalad', signal: 'episode' }],
  signals: {
    arc: 'TNG Season 5',
    season: '5',
    episode: '2',
    stardate: '45047.2',
    coordinates: { series: 'tng' },
    eventLabels: ['Darmok'],
  },
  uncertainty: { level: 'low', notes: [] },
}, globalContext, { source: 'model', updatedAt: 12345 });
assert.equal(contextBrief.summary, 'Darmok and Jalad at Tanagra.');
assert.equal(contextBrief.signals.arc, 'TNG Season 5');
assert.equal(contextBrief.signals.season, '5');
assert.equal(contextBrief.signals.episode, '2');
assert.equal(contextBrief.signals.stardate, '45047.2');
assert.deepEqual(contextBrief.signals.coordinates, { series: 'tng' });
assert.equal(contextBrief.updatedAt, 12345);
assert.equal(contextBrief.status.state, 'detected');
assert.equal(hasUsableContextBrief(contextBrief), true);

const legacyProjectedContext = buildLoreContextFromContextBrief(contextBrief, globalContext);
assert.equal(legacyProjectedContext.sceneDate, '');
assert.equal(legacyProjectedContext.canonBoundary, '');
assert.equal(legacyProjectedContext.branchId, 'main');

const resolverContext = buildResolverContextFromContextBrief(contextBrief, legacyProjectedContext);
assert.equal(resolverContext.arc, 'TNG Season 5');
assert.equal(resolverContext.season, '5');
assert.equal(resolverContext.episode, '2');
assert.equal(resolverContext.stardate, '45047.2');
assert.deepEqual(resolverContext.coordinates, { series: 'tng' });
assert.equal(resolverContext.contextBrief.summary, 'Darmok and Jalad at Tanagra.');
assert.equal(resolverContext.contextBrief.evidence[0].quote, 'Darmok and Jalad');

const fallbackBrief = buildContextBriefFromLoreContext({
  sceneDate: 'Saturday, Jan 25, 1997',
  canonBoundary: 'After Christmas Year 6',
  branchId: 'main',
  timeTravelMode: 'none',
}, { source: 'local', updatedAt: 999 });
assert.equal(fallbackBrief.signals.sceneDate, 'Saturday, Jan 25, 1997');
assert.deepEqual(fallbackBrief.signals.positionPhrases, ['After Christmas Year 6']);

const defaultState = getDefaultState();
assert.equal(defaultState.contextBrief.schemaVersion, 1);
assert.equal(defaultState.contextBrief.signals.stardate, '');
assert.deepEqual(defaultState.contextBrief.signals.coordinates, {});
assert.equal(defaultState.contextBrief.status.state, 'idle');
assert.equal(defaultState.contextBrief.status.repaired, false);

const normalizedBrief = normalizeContextBrief({
  status: {
    state: 'repaired',
    message: 'fixed',
    repaired: true,
    rawResponsePreview: 'bad json',
  },
  signals: {
    coordinates: [{ axis: 'series', id: 'tng' }],
  },
});
assert.deepEqual(normalizedBrief.signals.coordinates, { series: 'tng' });
assert.equal(normalizedBrief.status.state, 'repaired');
assert.equal(normalizedBrief.status.repaired, true);
assert.equal(normalizedBrief.status.rawResponsePreview, 'bad json');

const repairPrompt = buildContextBriefRepairPrompt('{ summary: "Darmok", signals: { stardate: 45047.2 }');
assert.match(repairPrompt, /Repair this malformed Saga Context Brief/);
assert.match(repairPrompt, /"signals"/);
assert.match(repairPrompt, /"stardate"/);
assert.match(repairPrompt, /Do not invent anchors/);

const normalizedDeckContext = getLoredeckContext(state, PACK_ID);
assert.equal(normalizedDeckContext.contextType, 'season_episode');
assert.equal(normalizedDeckContext.season, '5');
assert.equal(normalizedDeckContext.episode, '2');
assert.equal(normalizedDeckContext.stardate, '45047.2');
assert.deepEqual(normalizedDeckContext.coordinates, { series: 'tng' });

const index = await loadContextIndexForState(state, {
  registry,
  force: true,
});
assert.equal(index.summary.packCount, 1);
assert.equal(index.summary.anchorCount, 2);
assert.equal(index.summary.windowCount, 1);

const darmokAnchor = index.anchors.find(anchor => anchor.id === 'tng.s05e02.darmok');
assert.ok(darmokAnchor);
assert.equal(darmokAnchor.arc, 'TNG Season 5');
assert.equal(darmokAnchor.season, '5');
assert.equal(darmokAnchor.episode, '2');
assert.equal(darmokAnchor.stardate, '45047.2');
assert.equal(darmokAnchor.stardateFrom, '45047.0');
assert.equal(darmokAnchor.stardateTo, '45048.0');
assert.deepEqual(darmokAnchor.coordinates, [{ axis: 'series', value: 'tng', sortKey: null }]);

const seasonWindow = index.windows.find(windowDef => windowDef.id === 'tng.s05.window');
assert.ok(seasonWindow);
assert.equal(seasonWindow.label, 'TNG Season 5');
assert.equal(seasonWindow.arc, 'TNG Season 5');
assert.equal(seasonWindow.season, '5');
assert.equal(seasonWindow.stardateFrom, '45001.0');
assert.equal(seasonWindow.stardateTo, '45999.9');
assert.deepEqual(seasonWindow.coordinates, [{ axis: 'series', value: 'tng', sortKey: null }]);

const windowPatch = buildContextPatchFromWindow(seasonWindow, { contextSource: 'local_alias', confidence: 0.8 });
assert.equal(windowPatch.contextType, 'season_episode');
assert.equal(windowPatch.anchorFrom, 'tng.s05e01.redemption_ii');
assert.equal(windowPatch.anchorTo, 'tng.s05e02.darmok');
assert.equal(windowPatch.arc, 'TNG Season 5');
assert.equal(windowPatch.season, '5');
assert.equal(windowPatch.stardate, '45001.0');
assert.deepEqual(windowPatch.coordinates, { series: 'tng' });

const resolverText = buildResolverText({
  arc: 'TNG Season 5',
  season: '5',
  episode: '2',
  stardate: '45047.2',
  summary: 'Darmok and Jalad at Tanagra',
});
assert.match(resolverText, /TNG Season 5/);
assert.match(resolverText, /Darmok and Jalad/);
assert.match(resolverText, /45047\.2/);

const prompt = JSON.parse(buildContextModelPrompt({
  arc: 'TNG Season 5',
  season: '5',
  episode: '2',
  stardate: '45047.2',
  summary: 'Darmok and Jalad at Tanagra',
  contextBrief,
}, {
  state,
  index,
  targetPackIds: [PACK_ID],
  sourceText: 'The scene is during Darmok, stardate 45047.2.',
}));
assert.equal(prompt.currentStoryContext.summary, 'Darmok and Jalad at Tanagra');
assert.equal(prompt.currentStoryContext.stardate, '45047.2');
assert.equal(prompt.currentStoryContext.season, '5');
assert.equal(prompt.currentStoryContext.episode, '2');
assert.equal(prompt.currentStoryContext.contextBrief.evidence[0].quote, 'Darmok and Jalad');
assert.equal(prompt.currentStoryContext.contextBrief.uncertainty.level, 'low');
assert.equal(prompt.currentStoryContext.contextBrief.status.state, 'detected');
assert.ok(prompt.targetPacks[0].candidates.some(candidate => candidate.candidateId === 'anchor:tng.s05e02.darmok'));
const promptDarmok = prompt.targetPacks[0].candidates.find(candidate => candidate.candidateId === 'anchor:tng.s05e02.darmok');
assert.equal(promptDarmok.stardate, '45047.2');
assert.deepEqual(promptDarmok.coordinates, [{ axis: 'series', value: 'tng', sortKey: null }]);

const stardateEntry = {
  id: 'tng_darmok_current',
  title: 'Darmok Current Events',
  category: 'event',
  canon: 'canon',
  content: {
    fact: 'Picard is stranded with Dathon at El-Adrel IV during Darmok.',
  },
  context: {
    stardateFrom: '45047.0',
    stardateTo: '45048.0',
  },
  extensions: {
    sagaLoredeck: { packId: PACK_ID },
  },
};

const rawStardateMatch = evaluateEntryContextGate(stardateEntry, state, { index });
assert.equal(rawStardateMatch.status, CONTEXT_GATE_STATUSES.MATCH);
assert.equal(rawStardateMatch.eligible, true);

const normalizedStardateMatch = evaluateEntryContextGate(stardateEntry, {
  loredeckContexts: {
    [PACK_ID]: normalizedDeckContext,
  },
}, { index });
assert.equal(normalizedStardateMatch.status, CONTEXT_GATE_STATUSES.MATCH);
assert.equal(normalizedStardateMatch.eligible, true);

const missingStardateMatch = evaluateEntryContextGate(stardateEntry, {
  loredeckContexts: {
    [PACK_ID]: { ...normalizedDeckContext, stardate: '' },
  },
}, { index });
assert.equal(missingStardateMatch.status, CONTEXT_GATE_STATUSES.UNRESOLVED);
assert.match(missingStardateMatch.reason, /no stardate/);

const coordinateEntry = {
  id: 'tng_series_coordinate',
  title: 'TNG Series Coordinate',
  category: 'setting',
  canon: 'canon',
  content: {
    fact: 'This lore only applies to TNG series context.',
  },
  coordinates: [{ axis: 'series', id: 'tng' }],
  extensions: {
    sagaLoredeck: { packId: PACK_ID },
  },
};

const rawCoordinateMatch = evaluateEntryContextGate(coordinateEntry, state, { index });
assert.equal(rawCoordinateMatch.status, CONTEXT_GATE_STATUSES.MATCH);

const normalizedCoordinateMatch = evaluateEntryContextGate(coordinateEntry, {
  loredeckContexts: {
    [PACK_ID]: normalizedDeckContext,
  },
}, { index });
assert.equal(normalizedCoordinateMatch.status, CONTEXT_GATE_STATUSES.MATCH);

console.log('Context current-contract baseline passed.');
