import assert from 'node:assert/strict';
import { MODULE_KEY, DEFAULT_SETTINGS, getDefaultState } from '../../src/state/constants.js';
import * as stateManager from '../../src/state/state-manager.js';
import { runContinuityScan } from '../../src/continuity/continuity-scanner.js';
import { runAutoRelevance, onGenerationEndedAutoRelevance, __autoRelevanceTestHooks as relevanceHooks } from '../../src/context/auto-relevance.js';
import { handleGenerationEnded, handleChatChanged, handleExtensionDisabled } from '../../src/extension/events.js';
import { registerRuntimeAction } from '../../src/runtime/runtime-actions.js';
import { runLoreContextDetection, runStoryLoreScan } from '../../src/lorecards/lore-generator.js';
import { setChatOperationsEnabled } from '../../src/state/chat-operation.js';

const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
let current;
globalThis.SillyTavern = { getContext: () => current };
let promptSyncs = 0;
registerRuntimeAction('prompt.sync', () => { promptSyncs++; });
registerRuntimeAction('runtime.refresh', () => {});
registerRuntimeAction('runtime.hide', () => {});
function chat(id, overrides = {}) {
  setChatOperationsEnabled(true);
  const state = getDefaultState();
  state.scene.location = id;
  return {
    chatId: id, chat: [{ name: 'User', is_user: true, mes: 'Alice enters the harbor.' }],
    chatMetadata: { [MODULE_KEY]: state },
    extensionSettings: { [MODULE_KEY]: { ...clone(DEFAULT_SETTINGS), enabled: true, continuityProvider: 'st',
      continuityScanStrategy: 'fast', continuityScanRetryAttempts: 0, loreAutomationProviderRouting: 'utility',
      loreAutomationMode: 'ar', autoRelevanceEnabled: true, ...overrides } },
    saveMetadata() {}, generateRaw: async () => '{"summary":"harbor","changes":{"scene":{"location":"Harbor"}}}',
  };
}
const failures = [];
async function test(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
}

await test('late continuity delta cannot mutate B after A switches', async () => {
  const gate = deferred(); const started = deferred(); const a = chat('A'); const b = chat('B');
  current = a; a.generateRaw = async () => { started.resolve(); return gate.promise; };
  const job = runContinuityScan({ strategy: 'fast', applyImmediately: true });
  await started.promise; current = b; handleChatChanged();
  const before = clone(stateManager.getState());
  gate.resolve('{"summary":"A result","changes":{"scene":{"location":"A harbor"}}}');
  await job;
  assert.deepEqual(stateManager.getState(), before);
});

await test('late relevance adjudicator cannot replace B state', async () => {
  const gate = deferred(); const started = deferred(); const a = chat('A'); const b = chat('B');
  a.chatMetadata[MODULE_KEY].loreMatrix = [{ id: 'alice', title: 'Alice', relevance: 'low', kind: 'event_anchor',
    scope: { characters: ['Alice'], locations: ['harbor'] }, content: { fact: 'Alice enters the harbor.', injection: 'Alice is here.' } }];
  a.chatMetadata[MODULE_KEY].scene.presentCharacters = ['Alice'];
  current = a; a.generateRaw = async () => { started.resolve(); return gate.promise; };
  const job = runAutoRelevance({ force: true, forceProvider: true });
  await started.promise; current = b; handleChatChanged(); const before = clone(stateManager.getState());
  gate.resolve('{"changes":[{"id":"alice","relevance":"high","confidence":1}]}'); await job;
  assert.deepEqual(stateManager.getState(), before);
});

await test('rapid automatic events run the first and latest turn serially', async () => {
  const gate = deferred(); const started = deferred(); current = chat('queue', {
    continuityTrackingMode: 'automatic', continuityAutoInterval: 1, loreAutomationMode: 'off', contextDetectionMode: 'manual',
  });
  const seen = []; let active = 0; let maximum = 0;
  current.generateRaw = async args => { active++; maximum = Math.max(maximum, active); seen.push(args.prompt);
    if (seen.length === 1) { started.resolve(); await gate.promise; } active--; return '{"summary":"none","changes":{}}'; };
  const first = handleGenerationEnded(); await started.promise;
  current.chat.push({ name: 'User', is_user: true, mes: 'Middle turn.' }); const middle = handleGenerationEnded();
  current.chat.push({ name: 'User', is_user: true, mes: 'Latest turn.' }); const last = handleGenerationEnded();
  gate.resolve(); await Promise.all([first, middle, last]); await tick();
  assert.equal(maximum, 1); assert.equal(seen.length, 2); assert.match(seen[1], /Latest turn/);
});

await test('durable save reports rejected metadata and synchronous caller consumes it', async () => {
  current = chat('save'); current.saveMetadata = () => Promise.reject(new Error('disk full'));
  const unhandled = []; const listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
  try {
    stateManager.saveState(stateManager.getState(), { syncPrompt: false }); await tick();
    assert.deepEqual(unhandled, []);
    const outcome = await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
    assert.equal(outcome.ok, false); assert.equal(outcome.persisted, false); assert.match(outcome.error, /disk full/);
  } finally { process.off('unhandledRejection', listener); }
});

await test('backup and restore refuse durable success after metadata rejection', async () => {
  current = chat('backup'); const backup = stateManager.createStateBackup('manual');
  current.saveMetadata = () => Promise.reject(new Error('backup disk full'));
  const result = await stateManager.createStateBackupDurable('manual'); assert.equal(result.ok, false);
  const restored = await stateManager.restoreStateFromBackupDurable(backup.id); assert.equal(restored.ok, false);
  assert.equal(restored.persisted, false);
});

await test('disable revokes an in-flight continuity job', async () => {
  const gate = deferred(); const started = deferred(); current = chat('disable');
  current.generateRaw = async () => { started.resolve(); return gate.promise; };
  const job = runContinuityScan({ strategy: 'fast', applyImmediately: true }); await started.promise;
  handleExtensionDisabled(); const before = clone(stateManager.getState());
  gate.resolve('{"changes":{"scene":{"location":"late disabled result"}}}'); await job;
  assert.deepEqual(stateManager.getState(), before);
});

await test('saving a state read in A refuses to write it into B', async () => {
  current = chat('save A'); const originState = stateManager.getState();
  current = chat('save B'); const before = clone(stateManager.getState());
  const result = stateManager.saveState(originState, { syncPrompt: false });
  assert.equal(result.ok, false); assert.deepEqual(stateManager.getState(), before);
});

await test('late classifier leaves B cadence and prompt untouched', async () => {
  const gate = deferred(); const started = deferred(); current = chat('classifier A', {
    loreAutomationMode: 'armpc', loreAutomationProviderRouting: 'utility', loreAutomationRemapWordBudget: 900,
    loreAutomationCurationWordBudget: 2400, loreAutomationCadenceMode: 'auto',
  });
  current.chat = [{ name: 'User', is_user: true, mes: Array(200).fill('harbor').join(' ') }];
  const state = stateManager.getState(); const settings = stateManager.getSettings();
  state.loreAutomationCadence = {
    lastContextHash: relevanceHooks.buildContextAutomationHash(state),
    lastDeckStackHash: relevanceHooks.buildDeckStackAutomationHash(state),
    lastAcceptedAutomationHash: relevanceHooks.buildAcceptedAutomationHash(state),
    lastRecentNarrativeHash: relevanceHooks.buildRecentNarrativeAutomationHash(settings),
  };
  // Classifier minimum is 405 words at the default budget; keep the run below remapping.
  current.chat[0].mes = Array(450).fill('harbor').join(' ');
  state.loreAutomationCadence.lastRecentNarrativeHash = relevanceHooks.buildRecentNarrativeAutomationHash(settings);
  current.generateRaw = async () => { started.resolve(); return gate.promise; };
  const scheduled = onGenerationEndedAutoRelevance(); assert.equal(scheduled.status, 'scheduled_classifier');
  await started.promise; current = chat('classifier B'); handleChatChanged(); const before = clone(stateManager.getState());
  const syncs = promptSyncs;
  gate.resolve('{"edge":"hard_scene_shift","confidence":1,"changed":["location"]}');
  await scheduled.completion; await tick();
  assert.deepEqual(stateManager.getState(), before); assert.equal(promptSyncs, syncs);
});

for (const phase of ['observation', 'reducer']) {
  await test(`late bulk ${phase} cannot checkpoint into B`, async () => {
    const gate = deferred(); const started = deferred(); current = chat(`bulk ${phase} A`, { continuityScanStrategy: 'bulk' });
    const state = stateManager.getState();
    state.continuityConfig = { canon: false, scene: true, characters: false, inventory: false, objectives: false, threads: false };
    let calls = 0;
    current.generateRaw = async () => {
      calls++;
      if (calls === (phase === 'observation' ? 1 : 2)) { started.resolve(); return gate.promise; }
      return '{"observations":[{"section":"scene","observation":"Alice arrived","subject":"Alice"}]}';
    };
    const job = runContinuityScan({ strategyOverride: 'bulk', applyImmediately: true }); await started.promise;
    current = chat(`bulk ${phase} B`); handleChatChanged(); const before = clone(stateManager.getState());
    gate.resolve(phase === 'observation' ? '{"observations":[{"section":"scene","observation":"late A"}]}'
      : '{"changes":{"scene":{"location":"late A reducer"}}}');
    await job; assert.deepEqual(stateManager.getState(), before);
  });
}

await test('durable persistence refuses unavailable or throwing host capability', async () => {
  current = chat('unavailable'); delete current.saveMetadata;
  assert.equal((await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false })).ok, false);
  current.saveMetadata = () => { throw new Error('sync disk full'); };
  const result = await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
  assert.equal(result.ok, false); assert.match(result.error, /sync disk full/);
});

await test('metadata completion after switch acknowledges only origin and does not sync B', async () => {
  current = chat('persist A'); const gate = deferred(); current.saveMetadata = () => gate.promise;
  const job = stateManager.saveStateDurable(stateManager.getState());
  current = chat('persist B'); handleChatChanged(); const before = clone(stateManager.getState()); const syncs = promptSyncs;
  gate.resolve(); const result = await job; await tick();
  assert.equal(result.ok, false); assert.equal(result.status, 'cancelled');
  assert.deepEqual(stateManager.getState(), before); assert.equal(promptSyncs, syncs);
});

await test('file restore waits for its backup and stops when that persistence fails', async () => {
  current = chat('file restore'); const before = current.chatMetadata[MODULE_KEY].scene.location;
  const exported = stateManager.exportState({ ...getDefaultState(), scene: { ...getDefaultState().scene, location: 'replacement' } });
  current.saveMetadata = () => Promise.reject(new Error('backup refused'));
  const result = await stateManager.restoreStateFromExportDurable(exported);
  assert.equal(result.ok, false); assert.equal(stateManager.getState().scene.location, before);
});

for (const kind of ['Context', 'Story lore']) {
  await test(`late ${kind} scan does not mutate B`, async () => {
    const gate = deferred(); const started = deferred(); current = chat(`${kind} A`, { loreProvider: 'st', canonLoreAutoPropose: false });
    const state = stateManager.getState(); state.loreContext.lastDetectedAt = Date.now();
    current.generateRaw = async () => { started.resolve(); return gate.promise; };
    const job = kind === 'Context' ? runLoreContextDetection()
      : runStoryLoreScan({ force: false, source: 'auto', automationSafe: true });
    await started.promise; current = chat(`${kind} B`); handleChatChanged(); const before = clone(stateManager.getState());
    gate.resolve(kind === 'Context' ? '{"sceneDate":"1997-03-01","canonBoundary":"A only","location":"A harbor"}'
      : '{"facts":[{"fact":"Alice enters A harbor","title":"A arrival","kind":"event_anchor"}],"chunkSummary":"A only"}');
    await job; assert.deepEqual(stateManager.getState(), before);
  });
}

await test('queued prompt sync is revoked before its microtask runs', async () => {
  let syncs = 0; globalThis.Saga = { promptInjection: { sync: () => { syncs++; } } };
  current = chat('microtask A'); stateManager.saveState(stateManager.getState());
  current = chat('microtask B'); await tick(); assert.equal(syncs, 0);
});

for (const response of [false, { ok: false, error: 'metadata refused' }]) {
  for (const asynchronous of [false, true]) {
    await test(`${asynchronous ? 'async' : 'sync'} returned metadata refusal cannot acknowledge save, backup or restore`, async () => {
      current = chat('returned refusal');
      let durable = clone(current.chatMetadata);
      current.saveMetadata = () => { durable = clone(current.chatMetadata); };
      const backup = stateManager.createStateBackup('seed'); const previous = clone(durable);
      current.saveMetadata = () => asynchronous ? Promise.resolve(response) : response;
      const saved = await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
      assert.equal(saved.ok, false); assert.equal(saved.persisted, false);
      assert.equal((await stateManager.createStateBackupDurable('refused')).ok, false);
      assert.equal((await stateManager.restoreStateFromBackupDurable(backup.id)).ok, false);
      assert.deepEqual(durable, previous);
    });
  }
}

await test('shared metadata object does not authorize saving an A-owned state under B identity', async () => {
  const origin = chat('shared metadata A'); current = origin; const stateA = stateManager.getState();
  const next = chat('shared metadata B'); next.chatMetadata = origin.chatMetadata;
  next.chatMetadata[MODULE_KEY] = getDefaultState(); next.chatMetadata[MODULE_KEY].scene.location = 'B contents';
  current = next; const before = clone(next.chatMetadata); let saves = 0; next.saveMetadata = () => { saves++; };
  const result = stateManager.saveState(stateA, { syncPrompt: false });
  assert.equal(result.ok, false); assert.equal(saves, 0); assert.deepEqual(next.chatMetadata, before);
});

await test('legacy void and swallowed failures remain unverified for durable APIs', async () => {
  for (const saveMetadata of [() => {}, async () => { try { throw new Error('host swallowed disk full'); } catch (_) {} }]) {
    current = chat('legacy host'); current.saveMetadata = saveMetadata;
    const outcome = await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
    assert.equal(outcome.ok, false); assert.equal(outcome.persisted, false); assert.equal(outcome.status, 'unverified');
    const backup = await stateManager.createStateBackupDurable('legacy'); assert.equal(backup.ok, false);
    const restored = await stateManager.restoreStateFromBackupDurable(backup.backup.id); assert.equal(restored.ok, false);
  }
});

await test('legacy host waiting across a switch cannot attest A persistence', async () => {
  current = chat('legacy waiting A'); const gate = deferred(); let hostSavedChat;
  current.saveMetadata = async () => { await gate.promise; hostSavedChat = current.chatId; };
  const job = stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
  current = chat('legacy waiting B'); const before = clone(current.chatMetadata); gate.resolve();
  const result = await job; assert.equal(hostSavedChat, 'legacy waiting B');
  assert.equal(result.ok, false); assert.equal(result.persisted, false); assert.deepEqual(current.chatMetadata, before);
});

await test('origin-bound capability persists an immutable snapshot and acknowledges durability', async () => {
  current = chat('capable A'); const gate = deferred(); let request; const origin = current;
  current.saveMetadata = () => { throw new Error('legacy save must not be called'); };
  current.sagaPersistence = { originBound: true, async saveState(input) { request = input; await gate.promise; return { ok: true, persisted: true }; } };
  const state = stateManager.getState(); const pending = stateManager.saveStateDurable(state, { syncPrompt: false });
  state.scene.location = 'later optimistic edit';
  assert.equal(request.origin.chatId, 'capable A'); assert.equal(request.snapshot[MODULE_KEY].scene.location, 'capable A');
  assert.equal(request.signal instanceof AbortSignal, true); assert.equal(request.origin.operationId.startsWith('chat-operation-'), true);
  gate.resolve(); const result = await pending; assert.equal(result.ok, true); assert.equal(result.persisted, true);
  assert.equal(origin.chatMetadata[MODULE_KEY].scene.location, 'later optimistic edit');
});

await test('capable backup and restore preserve the previous durable version on replacement refusal', async () => {
  current = chat('durable original'); let durable;
  current.sagaPersistence = { originBound: true, saveState({ snapshot, origin }) {
    assert.equal(origin.chatId, 'durable original'); durable = clone(snapshot); return { ok: true, persisted: true };
  } };
  const backup = await stateManager.createStateBackupDurable('original'); assert.equal(backup.ok, true);
  stateManager.getState().scene.location = 'durable newer';
  assert.equal((await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false })).ok, true);
  const restored = await stateManager.restoreStateFromBackupDurable(backup.backup.id);
  assert.equal(restored.ok, true); assert.equal(durable[MODULE_KEY].scene.location, 'durable original');
  stateManager.getState().scene.location = 'keep previous durable contents';
  await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
  const save = current.sagaPersistence.saveState; let calls = 0;
  current.sagaPersistence.saveState = input => ++calls === 2 ? { ok: false, error: 'restore replacement refused' } : save(input);
  const refused = await stateManager.restoreStateFromBackupDurable(backup.backup.id);
  assert.equal(refused.ok, false); assert.equal(refused.persisted, false);
  assert.equal(durable[MODULE_KEY].scene.location, 'keep previous durable contents');
  assert.ok(durable[MODULE_KEY].stateSafety.backups.some(item => item.reason === 'before_backup_restore'));
});

await test('superseded same-chat observation cannot publish into the newer generation', async () => {
  const originalNow = Date.now; Date.now = () => 123456789;
  const oldGate = deferred(); const newGate = deferred(); const oldStarted = deferred(); const newStarted = deferred();
  current = chat('same-chat generations', { continuityScanStrategy: 'bulk', continuityScanRescanMode: 'rescan_all' });
  const state = stateManager.getState(); state.continuityConfig = { canon: false, scene: true, characters: false, inventory: false, objectives: false, threads: false };
  let calls = 0;
  current.generateRaw = async () => { calls++;
    if (calls === 1) { oldStarted.resolve(); return oldGate.promise; }
    if (calls === 2) { newStarted.resolve(); return newGate.promise; }
    return '{"changes":{}}';
  };
  const oldJob = runContinuityScan({ strategyOverride: 'bulk' }); await oldStarted.promise;
  const newJob = runContinuityScan({ strategyOverride: 'bulk' }); await tick(); await tick();
  const before = clone(stateManager.getState());
  oldGate.resolve('{"observations":[{"section":"scene","observation":"old generation arrived"}]}');
  try { await oldJob; assert.deepEqual(stateManager.getState(), before); }
  finally { await newStarted.promise; newGate.resolve('{"observations":[]}'); await newJob; Date.now = originalNow; }
});

await test('bound persistence refuses a nonserializable snapshot before invoking transport', async () => {
  current = chat('cyclic metadata'); current.chatMetadata.otherExtension = {}; current.chatMetadata.otherExtension.self = current.chatMetadata.otherExtension;
  let calls = 0; current.sagaPersistence = { originBound: true, saveState() { calls++; return { ok: true, persisted: true }; } };
  const result = await stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
  assert.equal(result.ok, false); assert.equal(calls, 0);
});

await test('bound metadata writes serialize so a delayed older snapshot cannot overwrite newer state', async () => {
  current = chat('ordered adapter'); const gate = deferred(); let calls = 0; let durable;
  current.sagaPersistence = { originBound: true, saveState({ snapshot }) {
    calls++;
    if (calls === 1) return gate.promise.then(() => { durable = snapshot; return { ok: true, persisted: true }; });
    durable = snapshot; return { ok: true, persisted: true };
  } };
  const state = stateManager.getState(); const first = stateManager.saveStateDurable(state, { syncPrompt: false });
  state.scene.location = 'newer state'; const second = stateManager.saveStateDurable(state, { syncPrompt: false });
  try { assert.equal(calls, 1); }
  finally { gate.resolve(); await Promise.all([first, second]); }
  assert.equal(durable[MODULE_KEY].scene.location, 'newer state');
});

await test('rereading reused metadata under B detaches the old A state reference', async () => {
  current = chat('reused state A'); const stateA = stateManager.getState();
  current.chatId = 'reused state B'; const stateB = stateManager.getState(); const before = clone(stateB);
  stateA.scene.location = 'late A edit'; let calls = 0; current.saveMetadata = () => { calls++; };
  const result = stateManager.saveState(stateA, { syncPrompt: false });
  assert.equal(result.ok, false); assert.equal(calls, 0); assert.deepEqual(stateManager.getState(), before);
});

await test('queued bound write is revoked before its adapter invocation on chat switch', async () => {
  current = chat('queued origin A'); const gate = deferred(); let calls = 0;
  current.sagaPersistence = { originBound: true, saveState() { calls++; return gate.promise; } };
  const first = stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
  const second = stateManager.saveStateDurable(stateManager.getState(), { syncPrompt: false });
  current = chat('queued origin B'); handleChatChanged(); const before = clone(current.chatMetadata);
  gate.resolve({ ok: true, persisted: true }); const results = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(results[1].ok, false); assert.deepEqual(current.chatMetadata, before);
});

if (failures.length) throw new Error(`${failures.length} reliability failures: ${failures.join('; ')}`);
console.log('Chat operation reliability passed.');
