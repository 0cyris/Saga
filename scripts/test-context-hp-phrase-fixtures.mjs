import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadContextIndexForState } from '../context-index.js';
import { resolveContextsFromContext } from '../context-resolver.js';

const CASES = [
    {
        packId: 'hp-year-6-half-blood-prince',
        phrase: 'After Christmas in their 6th year',
        expectedAnchorId: 'hp.y6.post_christmas_return',
    },
    {
        packId: 'hp-year-6-half-blood-prince',
        phrase: 'Just before Ron is starting to date the blonde girl',
        expectedAnchorId: 'hp.y6.ron_lavender_start',
    },
    {
        packId: 'hp-year-3-prisoner-of-azkaban',
        phrase: 'The first time they go to Hogsmeade',
        expectedAnchorId: 'hp.y3.secret_hogsmeade_first',
    },
    {
        packId: 'hp-year-4-goblet-of-fire',
        phrase: 'Right before Harry meets Voldemort for the first time, when Voldemort comes back.',
        expectedAnchorId: 'hp.y4.voldemort_reborn',
    },
    {
        packId: 'hp-year-4-goblet-of-fire',
        phrase: 'When Cedrick dies. Just after.',
        expectedAnchorId: 'hp.y4.cedric_killed',
    },
];

async function readJson(relativePath) {
    return JSON.parse(await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

async function buildRegistryRecord(packId) {
    const manifest = await readJson(`Loredecks/${packId}/loredeck.json`);
    const timelineRegistry = await readJson(`Loredecks/${packId}/timeline.json`);
    return {
        packId,
        id: packId,
        type: manifest.type || 'bundled',
        title: manifest.title || packId,
        manifestData: manifest,
        timelineRegistry,
    };
}

const registry = { packs: {} };
for (const { packId } of CASES) {
    if (!registry.packs[packId]) registry.packs[packId] = await buildRegistryRecord(packId);
}

for (const testCase of CASES) {
    const state = {
        loredeckStack: [
            { packId: testCase.packId, enabled: true, priority: 100, addedAt: 0 },
        ],
        loredeckContexts: {
            [testCase.packId]: {
                packId: testCase.packId,
                manualLock: false,
                source: 'unknown',
            },
        },
    };
    const index = await loadContextIndexForState(state, { registry, force: true });
    const result = resolveContextsFromContext({
        summary: testCase.phrase,
        alias: testCase.phrase,
        notes: testCase.phrase,
        positionPhrases: [testCase.phrase],
    }, {
        state,
        index,
        targetPackIds: [testCase.packId],
        apply: false,
        minConfidence: 0,
    });
    const resolved = result.results.find(item => item.packId === testCase.packId);
    assert.equal(resolved?.status, 'resolved', `${testCase.phrase} should resolve.`);
    assert.equal(resolved?.anchor?.id, testCase.expectedAnchorId, `${testCase.phrase} should resolve to ${testCase.expectedAnchorId}.`);
    assert.equal(state.loredeckContexts[testCase.packId].anchorId, undefined, 'Local phrase fixture must not mutate Context when apply is false.');
}

console.log('Context HP phrase fixture tests passed.');
