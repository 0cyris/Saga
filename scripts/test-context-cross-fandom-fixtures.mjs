import assert from 'node:assert/strict';
import { loadContextIndexForState } from '../context-index.js';
import { resolveContextsFromContext, resolveContextsFromModelResponse, buildContextResolutionAudit } from '../context-resolver.js';
import { evaluateEntryContextGate, CONTEXT_GATE_STATUSES } from '../context-gating.js';

const OP_ID = 'synthetic-one-piece-arlong-park-slice8';
const TNG_ID = 'synthetic-star-trek-tng-s5-slice8';
const VOY_ID = 'synthetic-star-trek-voy-s4-slice8';

function makeRegistryRecord(packId, title, timelineRegistry) {
  return {
    packId,
    id: packId,
    type: 'generated',
    title,
    manifestData: {
      id: packId,
      type: 'generated',
      title,
      entrySchemaVersion: 3,
      files: [],
    },
    timelineRegistry,
  };
}

const registry = {
  packs: {
    [OP_ID]: makeRegistryRecord(OP_ID, 'One Piece: Arlong Park Arc', {
      schemaVersion: 1,
      timelineMode: 'arc_chapter',
      sortKeyScale: 'chapter_episode',
      axes: [
        { id: 'arc', type: 'arc', label: 'Arc' },
        { id: 'chapter', type: 'chapter', label: 'Chapter' },
        { id: 'episode', type: 'episode', label: 'Episode' },
      ],
      anchors: [
        {
          id: 'op.arlong.nami-asks-luffy',
          label: 'Nami asks Luffy for help',
          sortKey: 430,
          arc: 'Arlong Park',
          phase: 'Cocoyasi confrontation',
          chapter: '81',
          episode: '37',
          aliases: ['Nami asks Luffy for help', 'Luffy gives Nami his hat', 'Nami breaks down in Cocoyasi'],
          coordinates: [
            { axis: 'saga', value: 'East Blue' },
            { axis: 'island', value: 'Cocoyasi Village' },
          ],
        },
        {
          id: 'op.arlong.march-to-arlong-park',
          label: 'The Straw Hats march to Arlong Park',
          sortKey: 440,
          arc: 'Arlong Park',
          phase: 'Arlong Park assault',
          chapter: '82',
          episode: '38',
          aliases: ['walk to Arlong Park', 'march to Arlong Park', 'Straw Hats arrive at Arlong Park'],
          coordinates: [
            { axis: 'saga', value: 'East Blue' },
            { axis: 'island', value: 'Cocoyasi Village' },
          ],
        },
      ],
      windows: [
        {
          id: 'op.arlong.cocoyasi-confrontation',
          label: 'Cocoyasi confrontation before the march',
          anchorFrom: 'op.arlong.nami-asks-luffy',
          anchorTo: 'op.arlong.march-to-arlong-park',
          sortKeyFrom: 430,
          sortKeyTo: 440,
          arc: 'Arlong Park',
          phase: 'Cocoyasi confrontation',
          chapter: '81-82',
          episode: '37-38',
          aliases: ['Cocoyasi confrontation', 'after Nami asks for help', 'before the march to Arlong Park'],
          coordinates: [
            { axis: 'saga', value: 'East Blue' },
            { axis: 'island', value: 'Cocoyasi Village' },
          ],
        },
      ],
    }),
    [TNG_ID]: makeRegistryRecord(TNG_ID, 'Star Trek TNG: Season 5', {
      schemaVersion: 1,
      timelineMode: 'episode_stardate',
      sortKeyScale: 'season_episode',
      axes: [
        { id: 'series', type: 'series', label: 'Series' },
        { id: 'season', type: 'season', label: 'Season' },
        { id: 'episode', type: 'episode', label: 'Episode' },
        { id: 'stardate', type: 'stardate', label: 'Stardate' },
      ],
      anchors: [
        {
          id: 'tng.s05e02.darmok',
          label: 'Darmok',
          sortKey: 502,
          season: '5',
          episode: '2',
          stardate: '45047.2',
          aliases: ['Darmok and Jalad', 'Picard and Dathon at El-Adrel', 'Temba his arms wide'],
          coordinates: [
            { axis: 'series', value: 'tng' },
          ],
        },
      ],
      windows: [
        {
          id: 'tng.s05.full-season',
          label: 'TNG Season 5',
          anchorFrom: 'tng.s05e01.redemption-ii',
          anchorTo: 'tng.s05e26.times-arrow-i',
          sortKeyFrom: 501,
          sortKeyTo: 526,
          season: '5',
          stardateFrom: '45001.0',
          stardateTo: '45999.9',
          aliases: ['TNG Season 5', 'Enterprise-D season five'],
          coordinates: [
            { axis: 'series', value: 'tng' },
          ],
        },
      ],
    }),
    [VOY_ID]: makeRegistryRecord(VOY_ID, 'Star Trek VOY: Season 4', {
      schemaVersion: 1,
      timelineMode: 'episode_window',
      sortKeyScale: 'season_episode',
      axes: [
        { id: 'series', type: 'series', label: 'Series' },
        { id: 'season', type: 'season', label: 'Season' },
        { id: 'episode', type: 'episode', label: 'Episode' },
        { id: 'stardate', type: 'stardate', label: 'Stardate' },
      ],
      anchors: [
        {
          id: 'voy.s04e08.year-of-hell-i',
          label: 'Year of Hell, Part I',
          sortKey: 408,
          season: '4',
          episode: '8',
          stardate: '51268.4',
          aliases: ['Year of Hell Part One', 'Krenim temporal attacks begin'],
          coordinates: [
            { axis: 'series', value: 'voy' },
          ],
        },
        {
          id: 'voy.s04e09.year-of-hell-ii',
          label: 'Year of Hell, Part II',
          sortKey: 409,
          season: '4',
          episode: '9',
          stardate: '51425.4',
          aliases: ['Year of Hell Part Two', 'Voyager rams the Krenim weapon ship'],
          coordinates: [
            { axis: 'series', value: 'voy' },
          ],
        },
      ],
      windows: [
        {
          id: 'voy.s04.year-of-hell',
          label: 'Year of Hell two-part window',
          anchorFrom: 'voy.s04e08.year-of-hell-i',
          anchorTo: 'voy.s04e09.year-of-hell-ii',
          sortKeyFrom: 408,
          sortKeyTo: 409,
          season: '4',
          episode: '8-9',
          stardateFrom: '51268.4',
          stardateTo: '51425.4',
          aliases: ['Year of Hell', 'Krenim temporal war', 'Year of Hell two-parter'],
          coordinates: [
            { axis: 'series', value: 'voy' },
          ],
        },
      ],
    }),
  },
};

const state = {
  loredeckStack: [
    { packId: OP_ID, enabled: true, priority: 100, addedAt: 0 },
    { packId: TNG_ID, enabled: true, priority: 90, addedAt: 1 },
    { packId: VOY_ID, enabled: true, priority: 80, addedAt: 2 },
  ],
  loredeckContexts: {
    [OP_ID]: { packId: OP_ID, manualLock: false, source: 'unknown' },
    [TNG_ID]: { packId: TNG_ID, manualLock: false, source: 'unknown' },
    [VOY_ID]: { packId: VOY_ID, manualLock: false, source: 'unknown' },
  },
};

const index = await loadContextIndexForState(state, { registry, force: true });
assert.equal(index.summary.packCount, 3);
assert.equal(index.summary.anchorCount, 5);
assert.equal(index.summary.windowCount, 3);

const onePieceContext = {
  summary: 'After Nami asks Luffy for help, before the march to Arlong Park.',
  arc: 'Arlong Park',
  phase: 'Cocoyasi confrontation',
  chapter: '82',
  episode: '38',
  coordinates: { saga: 'East Blue', island: 'Cocoyasi Village' },
};
const opLocal = resolveContextsFromContext(onePieceContext, {
  state,
  index,
  targetPackIds: [OP_ID],
});
const opResult = opLocal.results.find(result => result.packId === OP_ID);
assert.equal(opResult.status, 'resolved');
assert.equal(opResult.window?.id, 'op.arlong.cocoyasi-confrontation');
assert.equal(opResult.patch.contextType, 'anchor_window');
assert.equal(opResult.patch.arc, 'Arlong Park');

const tngContext = {
  summary: 'During Darmok and Jalad at El-Adrel.',
  season: '5',
  episode: '2',
  stardate: '45047.2',
  coordinates: { series: 'tng' },
};
const tngLocal = resolveContextsFromContext(tngContext, {
  state,
  index,
  targetPackIds: [TNG_ID],
});
const tngResult = tngLocal.results.find(result => result.packId === TNG_ID);
assert.equal(tngResult.status, 'resolved');
assert.equal(tngResult.anchor?.id, 'tng.s05e02.darmok');
assert.equal(tngResult.patch.stardate, '45047.2');

const voyContext = {
  summary: 'During the Year of Hell two-parter and the Krenim temporal war.',
  arc: 'Year of Hell',
  season: '4',
  coordinates: { series: 'voy' },
};
const voyLocal = resolveContextsFromContext(voyContext, {
  state,
  index,
  targetPackIds: [VOY_ID],
});
const voyResult = voyLocal.results.find(result => result.packId === VOY_ID);
assert.equal(voyResult.status, 'resolved');
assert.equal(voyResult.window?.id, 'voy.s04.year-of-hell');
assert.equal(voyResult.patch.episode, '8-9');

const modelResponse = JSON.stringify({
  contexts: [
    {
      packId: OP_ID,
      status: 'resolved',
      candidateId: 'window:op.arlong.cocoyasi-confrontation',
      candidateType: 'window',
      confidence: 0.91,
      reason: 'The scene is after Nami asks for help and before the march to Arlong Park.',
    },
  ],
});
const modelResolution = resolveContextsFromModelResponse(modelResponse, {
  summary: 'Before the march to Arlong Park, after Nami asks for help.',
  branchId: 'main',
}, {
  state,
  index,
  targetPackIds: [OP_ID],
});
assert.equal(modelResolution.resolvedCount, 1);
assert.equal(modelResolution.proposals.length, 1);
assert.equal(modelResolution.proposals[0].candidateId, 'window:op.arlong.cocoyasi-confrontation');
assert.equal(state.loredeckContexts[OP_ID].anchorFrom, undefined, 'Model resolution must not mutate active Context without review/apply.');

const modelAudit = buildContextResolutionAudit({
  status: 'proposed',
  model: modelResolution,
  proposals: modelResolution.proposals,
  proposalCount: modelResolution.proposals.length,
  resolvedCount: modelResolution.resolvedCount,
  changedCount: modelResolution.changedCount,
  unresolvedCount: modelResolution.unresolvedCount,
}, onePieceContext, {
  source: 'cross_fandom_fixture_reasoner',
  sourceText: onePieceContext.summary,
});
assert.equal(modelAudit.counts.proposed, 1);

const lockedState = {
  ...state,
  loredeckContexts: {
    ...state.loredeckContexts,
    [OP_ID]: {
      packId: OP_ID,
      manualLock: true,
      source: 'manual',
      anchorId: 'op.arlong.nami-asks-luffy',
    },
  },
};
const lockedLocal = resolveContextsFromContext(onePieceContext, {
  state: lockedState,
  index,
  targetPackIds: [OP_ID],
});
const lockedLocalOp = lockedLocal.results.find(result => result.packId === OP_ID);
assert.equal(lockedLocalOp.status, 'skipped');
assert.equal(lockedLocalOp.reason, 'manual_lock');
const lockedModel = resolveContextsFromModelResponse(modelResponse, onePieceContext, {
  state: lockedState,
  index,
  targetPackIds: [OP_ID],
});
assert.equal(lockedModel.resolvedCount, 0);
assert.equal(lockedModel.skippedCount, 1);
assert.equal(lockedModel.proposals.length, 0);
assert.equal(lockedModel.results[0].reason, 'manual_lock');

const gatingState = {
  loredeckContexts: {
    [OP_ID]: {
      packId: OP_ID,
      ...opResult.patch,
    },
    [TNG_ID]: {
      packId: TNG_ID,
      ...tngResult.patch,
    },
    [VOY_ID]: {
      packId: VOY_ID,
      ...voyResult.patch,
    },
  },
};

const opEligible = evaluateEntryContextGate({
  id: 'op.nami.breakdown',
  title: 'Nami breakdown at Cocoyasi',
  extensions: { sagaLoredeck: { packId: OP_ID } },
  content: { fact: 'Nami asks Luffy for help at Cocoyasi.' },
  context: {
    validFromAnchor: 'op.arlong.nami-asks-luffy',
    validToAnchor: 'op.arlong.march-to-arlong-park',
    arc: 'Arlong Park',
    phase: 'Cocoyasi confrontation',
  },
}, gatingState, { index });
assert.equal(opEligible.status, CONTEXT_GATE_STATUSES.MATCH);
assert.equal(opEligible.eligible, true);

const opFuture = evaluateEntryContextGate({
  id: 'op.arlong.defeated',
  title: 'Arlong defeated after the assault',
  extensions: { sagaLoredeck: { packId: OP_ID } },
  content: { fact: 'Arlong is defeated after the fight at Arlong Park.' },
  context: {
    sortKeyFrom: 450,
  },
}, gatingState, { index });
assert.equal(opFuture.status, CONTEXT_GATE_STATUSES.MISMATCH);
assert.equal(opFuture.eligible, false);

const tngEligible = evaluateEntryContextGate({
  id: 'tng.darmok.translation',
  title: 'Darmok metaphor context',
  extensions: { sagaLoredeck: { packId: TNG_ID } },
  content: { fact: 'The Tamarian language is understood through metaphor.' },
  context: {
    season: '5',
    episode: '2',
    stardateFrom: 45047.0,
    stardateTo: 45048.0,
  },
}, gatingState, { index });
assert.equal(tngEligible.status, CONTEXT_GATE_STATUSES.MATCH);
assert.equal(tngEligible.eligible, true);

const voyEligible = evaluateEntryContextGate({
  id: 'voy.year-of-hell.krenim',
  title: 'Krenim temporal war',
  extensions: { sagaLoredeck: { packId: VOY_ID } },
  content: { fact: 'Voyager is trapped in the Krenim temporal conflict.' },
  context: {
    season: '4',
    episode: '8-9',
    stardateFrom: 51268.4,
    stardateTo: 51425.4,
  },
}, gatingState, { index });
assert.equal(voyEligible.status, CONTEXT_GATE_STATUSES.MATCH);
assert.equal(voyEligible.eligible, true);

console.log('Context cross-fandom fixture tests passed.');
