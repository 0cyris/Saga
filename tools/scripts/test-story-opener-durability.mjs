import assert from 'node:assert/strict';
import test from 'node:test';
import { writeStoryOpenerVariants, __storyOpenerGenerationTestHooks } from '../../src/story-openers/story-opener-generation.js';
import { normalizeStoryOpenerSession } from '../../src/story-openers/story-opener-state.js';
import { __storyOpenerPanelTestHooks } from '../../src/runtime/story-opener-panel.js';
import { createSagaFileApi, __sagaFileApiTestHooks } from '../../src/storage/saga-file-api.js';
import * as storyStorage from '../../src/storage/saga-story-opener-storage.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const session = normalizeStoryOpenerSession({ sessionId: 'durable-story', controls: { userPrompt: 'Open in the library.', context: 'January', variantCount: 2 } });
const packet = { mustAvoid: [] };
const brief = { variantAngles: ['fast angle', 'slow angle'] };

test('fast variants are checkpointed before a slow sibling and reload skips their provider calls', async () => {
    let release; const slow = new Promise(resolve => { release = resolve; });
    const saved = []; let slowDone = false;
    const restore = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async (_s, user) => user.includes('Variant angle: slow angle') ? slow : 'Fast saved prose.');
    const pending = writeStoryOpenerVariants(session, packet, brief, { maxConcurrency: 2, checkpointVariant: async variant => { saved.push(variant); return { ok: true, persisted: true }; } }).then(result => { slowDone = true; return result; });
    await pause(15);
    const savedBeforeSlow = saved.length;
    release('Slow saved prose.');
    const result = await pending; restore();
    assert.equal(savedBeforeSlow, 1, 'a completed variant must become durable while sibling is still running');
    assert.equal(result.ok, true); assert.equal(slowDone, true);
    const reloaded = normalizeStoryOpenerSession({ ...session, variants: saved });
    assert(reloaded.variants.every(variant => variant.generationKey && variant.inputHash && variant.unitId));
    let calls = 0;
    const undo = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async () => { calls += 1; return 'duplicate'; });
    try {
        const resumed = await writeStoryOpenerVariants(reloaded, packet, brief, { maxConcurrency: 2 });
        assert.equal(resumed.ok, true); assert.equal(calls, 0);
        assert.deepEqual(resumed.variants.map(variant => variant.id), saved.map(variant => variant.id));
    } finally { undo(); }
});

test('a refused variant checkpoint never replays successful provider work', async () => {
    let calls = 0;
    const restore = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async () => { calls += 1; return 'Completed prose.'; });
    try {
        const result = await writeStoryOpenerVariants({ ...session, controls: { ...session.controls, variantCount: 1 } }, packet, brief, { retryDelayMs: 0, checkpointVariant: async () => ({ ok: false, persisted: false, error: 'disk refused' }) });
        assert.equal(calls, 1); assert.equal(result.ok, false);
        assert.equal(result.failures[0].code, 'checkpoint_failed');
        assert.equal(result.pendingVariants[0].text, 'Completed prose.');
        const resumed = await writeStoryOpenerVariants({ ...session, controls: { ...session.controls, variantCount: 1 }, variants: result.pendingVariants }, packet, brief, { checkpointVariant: async () => ({ ok: true, persisted: true }) });
        assert.equal(resumed.ok, true); assert.equal(calls, 1, 'checkpoint retry must reuse the pending completed prose');
    } finally { restore(); }
});

test('revision inputs create a new identity while resumed unchanged requests reuse saved results', async () => {
    const restore = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async () => 'Draft prose.');
    try {
        const first = await writeStoryOpenerVariants(session, packet, brief, { maxConcurrency: 2 });
        const reloaded = normalizeStoryOpenerSession({ ...session, variants: first.variants, selectedVariantId: first.variants[0].id });
        const revised = await writeStoryOpenerVariants(reloaded, packet, brief, { revisionPrompt: 'Make it quieter.', maxConcurrency: 2 });
        assert(first.variants[0].generationKey);
        assert.notEqual(first.variants[0].generationKey, revised.variants[0].generationKey);
    } finally { restore(); }
});

test('Story fanout obeys the current raw host capability despite a larger caller override', async () => {
    let active = 0; let peak = 0;
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { saga: { loreProvider: 'st' } }, chatMetadata: {}, generateRaw: async () => { active += 1; peak = Math.max(peak, active); await pause(5); active -= 1; return 'Serialized host prose.'; } }) };
    const result = await writeStoryOpenerVariants({ ...session, controls: { ...session.controls, variantCount: 5 } }, packet, brief, { maxConcurrency: 99 });
    assert.equal(result.ok, true); assert.equal(result.variants.length, 5); assert.equal(peak, 1);
});

test('production Story panel saves a fast variant durably, preserves it on cancellation and resumes after reload', async () => {
    const files = new Map();
    let refuseCompletion = false;
    const response = (ok, status, text) => ({ ok, status, text: async () => text });
    const fileApi = createSagaFileApi({ storageBackendIdentity: {}, fetchImpl: async (url, init = {}) => {
        const body = init.body ? JSON.parse(init.body) : null;
        if (url === '/api/files/upload') {
            const path = `/user/files/${body.name}`; const text = __sagaFileApiTestHooks.base64ToUtf8(body.data);
            if (refuseCompletion && body.name === 'saga-story-opener-session-durable-story.v1.json' && JSON.parse(text).lastGenerationResult?.status === 'complete') { refuseCompletion = false; return response(false, 500, 'completion checkpoint refused'); }
            files.set(path, text); return response(true, 200, JSON.stringify({ path }));
        }
        if (url === '/api/files/delete') { files.delete(body.path); return response(true, 200, '{}'); }
        if (url === '/api/files/verify') return response(true, 200, JSON.stringify(Object.fromEntries(body.urls.map(path => [path, files.has(path)]))));
        return response(files.has(url), files.has(url) ? 200 : 404, files.get(url) || 'missing');
    } });
    storyStorage.resetSagaStoryOpenerStorageCache();
    storyStorage.configureSagaStoryOpenerStorage({ fileApi, staleCheck: false, onWriteError() {} });
    const initial = normalizeStoryOpenerSession({ ...session, openerBrief: brief, snapshots: { contextPacket: packet } });
    await storyStorage.upsertExternalStoryOpenerSessionSync(initial).completion;
    let release; const slow = new Promise(resolve => { release = resolve; });
    const undo = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async (_system, user) => user.includes('Variant angle: slow angle') ? slow : 'Durable fast prose.');
    const controller = new AbortController();
    const pending = __storyOpenerPanelTestHooks.runDraftStage(initial, {}, { signal: controller.signal, timeoutMs: 1000 });
    await pause(30); await storyStorage.flushSagaStoryOpenerStorageWrites();
    const path = '/user/files/saga-story-opener-session-durable-story.v1.json';
    const beforeCancel = JSON.parse(files.get(path));
    controller.abort(); const cancelled = await pending; release('late slow'); undo();
    assert.equal(beforeCancel.variants.length, 1, 'the actual transaction must contain the fast variant before its sibling finishes');
    assert.equal(cancelled.ok, false); assert.equal(cancelled.session.variants.length, 1);
    assert.equal((await storyStorage.flushSagaStoryOpenerStorageWrites()).ok, true);
    storyStorage.resetSagaStoryOpenerStorageCache();
    await storyStorage.hydrateSagaStoryOpenerStorage({ fileApi });
    const reloaded = await storyStorage.hydrateExternalStoryOpenerSessionRecord(storyStorage.getExternalStoryOpenerIndex().sessions['durable-story'], { fileApi });
    let fastCalls = 0; let slowCalls = 0;
    const restore = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async (_system, user) => {
        if (user.includes('Variant angle: fast angle')) fastCalls += 1; else slowCalls += 1;
        return 'Resumed slow prose.';
    });
    try {
        const resumed = await __storyOpenerPanelTestHooks.runDraftStage(reloaded, {}, { timeoutMs: 1000 });
        assert.equal(resumed.ok, true, JSON.stringify(resumed.failure)); assert.equal(fastCalls, 0); assert.equal(slowCalls, 1);
        assert.equal(resumed.variants.find(variant => variant.variantIndex === 0).text, 'Durable fast prose.');
        refuseCompletion = true;
        const checkpointFailure = await __storyOpenerPanelTestHooks.runDraftStage(resumed.session, {}, { resume: true, timeoutMs: 1000 });
        assert.equal(checkpointFailure.ok, false); assert.equal(checkpointFailure.failure.code, 'checkpoint_failed');
        assert.equal(storyStorage.getCachedExternalStoryOpenerSession('durable-story').lastGenerationResult.status, 'error', 'completion save failure must be visible to the UI');
        storyStorage.resetSagaStoryOpenerStorageCache(); await storyStorage.hydrateSagaStoryOpenerStorage({ fileApi });
        const checkpointReload = await storyStorage.hydrateExternalStoryOpenerSessionRecord(storyStorage.getExternalStoryOpenerIndex().sessions['durable-story'], { fileApi });
        const recovered = await __storyOpenerPanelTestHooks.runDraftStage(checkpointReload, {}, { timeoutMs: 1000 });
        assert.equal(recovered.ok, true); assert.equal(fastCalls, 0); assert.equal(slowCalls, 1, 'completion checkpoint recovery must not replay either durable variant');
        let finishRevision; const slowRevision = new Promise(resolve => { finishRevision = resolve; });
        const revisionProvider = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async (_system, user) => user.includes('Variant angle: slow angle') ? slowRevision : 'Revised fast prose.');
        const revisionController = new AbortController();
        const revising = __storyOpenerPanelTestHooks.runDraftStage(recovered.session, {}, { revisionPrompt: 'Make it quieter.', signal: revisionController.signal, timeoutMs: 1000 });
        await pause(20); await storyStorage.flushSagaStoryOpenerStorageWrites();
        revisionController.abort(); const interruptedRevision = await revising; finishRevision('late revision'); revisionProvider();
        assert.equal(interruptedRevision.session.snapshots.draftGeneration.revisionSourceText, 'Durable fast prose.');
        storyStorage.resetSagaStoryOpenerStorageCache(); await storyStorage.hydrateSagaStoryOpenerStorage({ fileApi });
        const revisionReload = await storyStorage.hydrateExternalStoryOpenerSessionRecord(storyStorage.getExternalStoryOpenerIndex().sessions['durable-story'], { fileApi });
        fastCalls = 0; slowCalls = 0;
        const revisionResume = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(async (_system, user) => {
            assert.match(user, /Revision instruction: Make it quieter\./);
            assert.match(user, /Previous opener to revise, if any:\nDurable fast prose\./);
            if (user.includes('Variant angle: fast angle')) fastCalls += 1; else slowCalls += 1;
            return 'Resumed revised slow prose.';
        });
        try {
            const finalRevision = await __storyOpenerPanelTestHooks.runDraftStage(revisionReload, {}, { timeoutMs: 1000 });
            assert.equal(finalRevision.ok, true); assert.equal(fastCalls, 0); assert.equal(slowCalls, 1);
            assert.equal(finalRevision.session.revisionHistory.at(-1).text, 'Durable fast prose.');
        } finally { revisionResume(); }
    } finally { restore(); }
});
