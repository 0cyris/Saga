import assert from 'node:assert/strict';

import { loadContextIndexForState, rankContextAnchors } from '../../src/context/context-index.js';
import { __contextResolverTestHooks } from '../../src/context/context-resolver.js';

const {
  buildContextModelPrompt,
  buildContextModelCandidatesForPack,
  resolveContextsFromContext,
} = __contextResolverTestHooks;

const ONE_PIECE_ID = 'synthetic-one-piece-arlong-park';
const TNG_ID = 'synthetic-star-trek-tng-s5';

const registry = {
  schemaVersion: 1,
  packs: {
    [ONE_PIECE_ID]: {
      packId: ONE_PIECE_ID,
      type: 'custom',
      title: 'Synthetic One Piece: Arlong Park',
      manifestData: {
        id: ONE_PIECE_ID,
        type: 'custom',
        title: 'Synthetic One Piece: Arlong Park',
        files: [],
      },
      timelineRegistry: {
        timelineMode: 'arc',
        defaultContextType: 'arc',
        anchors: [
          {
            id: 'op.east-blue.arlong.nami-asks-luffy',
            label: 'Nami asks Luffy for help',
            contextType: 'anchor',
            sortKey: 430,
            arc: 'Arlong Park',
            phase: 'Cocoyasi Village',
            chapter: '81',
            episode: '37',
            aliases: ['Nami asks for help', 'Luffy gives Nami his hat'],
            tags: ['saga:east-blue', 'arc:arlong-park'],
            coordinates: [{ axis: 'saga', id: 'east-blue' }, { axis: 'island', id: 'cocoyasi' }],
          },
          {
            id: 'op.east-blue.arlong.march-to-arlong-park',
            label: 'The march to Arlong Park',
            contextType: 'anchor',
            sortKey: 440,
            arc: 'Arlong Park',
            phase: 'Arlong confrontation',
            chapter: '82',
            episode: '38',
            aliases: ['walk to Arlong Park', 'march on Arlong Park'],
            tags: ['saga:east-blue', 'arc:arlong-park'],
            coordinates: [{ axis: 'saga', id: 'east-blue' }, { axis: 'island', id: 'cocoyasi' }],
          },
        ],
        windows: [
          {
            id: 'op.east-blue.arlong.full-arc',
            label: 'Arlong Park Arc',
            contextType: 'arc',
            anchorFrom: 'op.east-blue.arlong.nami-asks-luffy',
            anchorTo: 'op.east-blue.arlong.march-to-arlong-park',
            sortKeyFrom: 400,
            sortKeyTo: 470,
            arc: 'Arlong Park',
            phase: 'Cocoyasi conflict',
            chapter: '69-95',
            episode: '31-44',
            aliases: ['Arlong Park', 'Cocoyasi conflict', 'Nami arc'],
            tags: ['saga:east-blue', 'arc:arlong-park'],
            coordinates: [{ axis: 'saga', id: 'east-blue' }, { axis: 'island', id: 'cocoyasi' }],
          },
        ],
      },
    },
    [TNG_ID]: {
      packId: TNG_ID,
      type: 'custom',
      title: 'Synthetic Star Trek TNG Season 5',
      manifestData: {
        id: TNG_ID,
        type: 'custom',
        title: 'Synthetic Star Trek TNG Season 5',
        files: [],
      },
      timelineRegistry: {
        timelineMode: 'season_episode',
        defaultContextType: 'season_episode',
        anchors: [
          {
            id: 'tng.s05e01.redemption-ii',
            label: 'Redemption II',
            contextType: 'season_episode',
            sortKey: 501,
            arc: 'TNG Season 5',
            season: '5',
            episode: '1',
            stardate: '45020.4',
            aliases: ['Season 5 premiere'],
            tags: ['series:tng', 'season:5'],
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
            aliases: ['Darmok and Jalad', 'Stardate 45047.2'],
            tags: ['series:tng', 'season:5', 'episode:darmok'],
            coordinates: [{ axis: 'series', id: 'tng' }],
          },
        ],
        windows: [
          {
            id: 'tng.s05.window',
            label: 'TNG Season 5',
            contextType: 'season_episode',
            anchorFrom: 'tng.s05e01.redemption-ii',
            anchorTo: 'tng.s05e02.darmok',
            sortKeyFrom: 501,
            sortKeyTo: 526,
            arc: 'TNG Season 5',
            season: '5',
            stardateFrom: '45001.0',
            stardateTo: '45999.9',
            aliases: ['TNG season five', 'season 5 of TNG'],
            tags: ['series:tng', 'season:5'],
            coordinates: [{ axis: 'series', id: 'tng' }],
          },
        ],
      },
    },
  },
};

const state = {
  loredeckStack: [
    { packId: ONE_PIECE_ID, enabled: true, priority: 100, addedAt: 0 },
    { packId: TNG_ID, enabled: true, priority: 90, addedAt: 1 },
  ],
  loredeckContexts: {
    [ONE_PIECE_ID]: { packId: ONE_PIECE_ID, manualLock: false },
    [TNG_ID]: { packId: TNG_ID, manualLock: false },
  },
};

const index = await loadContextIndexForState(state, { registry, force: true });

const arlongAnchorRank = rankContextAnchors('Nami asks Luffy for help in Arlong Park', {
  index,
  packId: ONE_PIECE_ID,
  limit: 3,
});
assert.equal(arlongAnchorRank[0].anchor.id, 'op.east-blue.arlong.nami-asks-luffy');

const darmokRank = rankContextAnchors('Darmok stardate 45047.2', {
  index,
  packId: TNG_ID,
  limit: 3,
});
assert.equal(darmokRank[0].anchor.id, 'tng.s05e02.darmok');

const arlongCandidates = buildContextModelCandidatesForPack(ONE_PIECE_ID, {
  arc: 'Arlong Park',
  chapter: '82',
  summary: 'During the Cocoyasi confrontation after Nami asks Luffy for help.',
}, { state, index, candidateLimit: 6 });
assert.equal(arlongCandidates[0].candidateId, 'window:op.east-blue.arlong.full-arc');

const arlongResolution = resolveContextsFromContext({
  arc: 'Arlong Park',
  chapter: '82',
  summary: 'During the Cocoyasi confrontation after Nami asks Luffy for help.',
  branchId: 'main',
}, {
  state,
  index,
  contextSource: 'local_alias',
});
const opResult = arlongResolution.results.find(result => result.packId === ONE_PIECE_ID);
assert.equal(opResult.status, 'resolved');
assert.equal(opResult.window.id, 'op.east-blue.arlong.full-arc');
assert.equal(opResult.patch.arc, 'Arlong Park');
assert.equal(opResult.patch.chapter, '69-95');
assert.deepEqual(opResult.patch.coordinates, { saga: 'east-blue', island: 'cocoyasi' });

const tngResolution = resolveContextsFromContext({
  stardate: '45047.2',
  season: '5',
  episode: '2',
  summary: 'Darmok and Jalad at Tanagra.',
  branchId: 'main',
}, {
  state,
  index,
  contextSource: 'local_alias',
});
const tngResult = tngResolution.results.find(result => result.packId === TNG_ID);
assert.equal(tngResult.status, 'resolved');
assert.equal(tngResult.anchor.id, 'tng.s05e02.darmok');
assert.equal(tngResult.patch.stardate, '45047.2');
assert.equal(tngResult.patch.season, '5');
assert.equal(tngResult.patch.episode, '2');

const tngSeasonCandidates = buildContextModelCandidatesForPack(TNG_ID, {
  season: '5',
  coordinates: { series: 'tng' },
  summary: 'During TNG season five.',
}, { state, index, candidateLimit: 6 });
assert.equal(tngSeasonCandidates[0].candidateId, 'window:tng.s05.window');

const prompt = JSON.parse(buildContextModelPrompt({
  stardate: '45047.2',
  season: '5',
  episode: '2',
  coordinates: { series: 'tng' },
  summary: 'Darmok and Jalad at Tanagra.',
}, {
  state,
  index,
  targetPackIds: [TNG_ID],
  candidateLimit: 6,
}));
assert.equal(prompt.targetPacks[0].candidates[0].candidateId, 'anchor:tng.s05e02.darmok');
assert.equal(prompt.targetPacks[0].candidates[0].stardate, '45047.2');

console.log('Context media scoring tests passed.');
