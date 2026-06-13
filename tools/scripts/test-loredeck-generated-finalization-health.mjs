import assert from 'node:assert/strict';

import {
  configureLoredeckEditorActions,
  finalizeGeneratedLoredeckAsCustom,
} from '../../src/runtime/loredeck-editor-actions.js';
import {
  configureGeneratedLoredeckReadiness,
} from '../../src/runtime/loredeck-generated-readiness.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildGeneratedPack(packId = 'generated-finalization-health-pack') {
  return {
    packId,
    type: 'generated',
    title: 'Generated Finalization Health Pack',
    entrySchemaVersion: 3,
    manifestData: {
      id: packId,
      type: 'generated',
      title: 'Generated Finalization Health Pack',
      entrySchemaVersion: 3,
      files: [],
      stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
    },
    entryOverrides: {
      'nami.fact': {
        id: 'nami.fact',
        title: 'Nami Fact',
        schemaVersion: 3,
        category: 'knowledge',
        tags: ['character:nami'],
        context: {
          scope: 'window',
          validFromAnchor: 'arlong.start',
          validToAnchor: 'arlong.end',
          sortKeyFrom: 10,
          sortKeyTo: 20,
          precision: 'anchor_window',
          label: 'Arlong pressure phase',
        },
        retrieval: {
          activation: 'context_or_topic',
          frequency: 'normal',
          contextBoost: 'high',
        },
        content: {
          fact: 'Nami hides her buyback plan.',
          injection: 'Treat Nami theft references as cover for the hidden buyback plan.',
        },
      },
    },
    disabledEntryIds: [],
    timelineRegistry: {
      schemaVersion: 1,
      timelineMode: 'hybrid',
      sortKeyScale: 'pack_local',
      anchors: [
        { id: 'arlong.start', label: 'Arlong starts pressuring Cocoyasi', sortKey: 10 },
        { id: 'arlong.end', label: 'Arlong betrays the buyback deal', sortKey: 20 },
      ],
      windows: [
        { id: 'arlong.pressure', label: 'Arlong pressure phase', anchorFrom: 'arlong.start', anchorTo: 'arlong.end', sortKeyFrom: 10, sortKeyTo: 20 },
      ],
    },
    tagRegistry: {
      schemaVersion: 1,
      tags: {
        'character:nami': { label: 'Nami' },
      },
    },
    healthStatus: 'draft',
    tags: ['origin:generated', 'quality:model-drafted', 'saga:creator'],
  };
}

const goodHealth = {
  status: 'good',
  errors: [],
  warnings: [],
  suggestions: [],
  summary: {
    errorCount: 0,
    warningCount: 0,
    suggestionCount: 0,
    entryCount: 1,
    categoryCounts: { knowledge: 1 },
  },
};

const errorHealth = {
  status: 'has_errors',
  errors: [{ code: 'schema_v3_missing_content', message: 'Missing content.' }],
  warnings: [{ code: 'undefined_tag', message: 'Undefined tag.' }],
  suggestions: [],
  summary: {
    errorCount: 1,
    warningCount: 1,
    suggestionCount: 0,
    entryCount: 1,
    categoryCounts: { knowledge: 1 },
  },
};

async function runFinalization(initialPack, firstHealth) {
  let savedPack = clone(initialPack);
  const savedRecords = [];
  const toasts = [];
  const confirmations = [];
  const openedMetadata = [];
  const selected = [];
  let backupCount = 0;
  let validateCount = 0;

  configureGeneratedLoredeckReadiness({
    getLoredeckPendingChanges: pack => (Array.isArray(pack.pendingChanges) ? pack.pendingChanges : []),
    getLoredeckAssistantDraftChanges: () => [],
    getLoredeckAssistantDraftCacheRecord: () => ({}),
    getLoredeckCreatorPipelineReadiness: () => ({
      warnings: [],
      coverage: {
        finalizeAcknowledgementRequired: false,
        finalizeAcknowledged: false,
      },
    }),
    isLoredeckHealthStatusStale: () => false,
  });

  configureLoredeckEditorActions({
    getState: () => ({}),
    getLoredeckLibrary: () => [savedPack, ...savedRecords],
    getLoredeckDefinition: packId => [savedPack, ...savedRecords].find(pack => pack.packId === packId) || null,
    getFreshLoredeckLibraryPack: (packId, fallback) => [savedPack, ...savedRecords].find(pack => pack.packId === packId) || fallback,
    validateLoredeckForEditor: async (pack) => {
      validateCount += 1;
      return {
        health: validateCount === 1 ? firstHealth : goodHealth,
        manifest: pack.manifestData || {},
        entryCache: {
          entries: Object.values(pack.entryOverrides || {}),
        },
      };
    },
    getLoredeckCreatorJobForPack: () => null,
    buildLoredeckCreatorCoverageFinalizationProvenance: () => null,
    confirmAction: async (title, message) => {
      confirmations.push({ title, message });
      return true;
    },
    createStateBackup: () => {
      backupCount += 1;
    },
    upsertLoredeckLibraryPack: record => {
      savedRecords.push(clone(record));
      return { ok: true };
    },
    setLoredeckManifestPreviewCacheRecord: () => {},
    selectLoredeckForDetails: packId => {
      selected.push(packId);
    },
    clearCanonLoreDatabaseCache: () => {},
    clearContextIndexCache: () => {},
    refreshLoredeckSurfaces: () => {},
    openLoredeckMetadataEditor: packId => {
      openedMetadata.push(packId);
    },
    isLoredeckLibraryOpen: () => false,
    renderLoredeckLibraryOverlay: () => {},
    toast: (message, type = 'info') => {
      toasts.push({ message, type });
    },
  });

  const result = await finalizeGeneratedLoredeckAsCustom(savedPack);
  return {
    result,
    savedRecords,
    toasts,
    confirmations,
    openedMetadata,
    selected,
    backupCount,
    validateCount,
  };
}

const blocked = await runFinalization(buildGeneratedPack('generated-finalization-blocked-pack'), errorHealth);
assert.equal(blocked.result, null);
assert.equal(blocked.savedRecords.length, 0);
assert.equal(blocked.backupCount, 0);
assert.equal(blocked.confirmations.length, 0);
assert.equal(blocked.openedMetadata.length, 0);
assert.equal(blocked.validateCount, 1);
assert.ok(blocked.toasts.some(toast => toast.type === 'error' && toast.message.includes('Pack Health: 1 error, 1 warning.')));

const clean = await runFinalization(buildGeneratedPack('generated-finalization-clean-pack'), goodHealth);
assert.ok(clean.result);
assert.equal(clean.savedRecords.length, 1);
assert.equal(clean.confirmations.length, 0);
assert.equal(clean.backupCount, 1);
assert.equal(clean.validateCount, 2);
assert.equal(clean.result.type, 'custom');
assert.equal(clean.result.source.kind, 'generated_finalized');
assert.equal(clean.result.source.originalPackId, 'generated-finalization-clean-pack');
assert.equal(clean.result.pendingChanges.length, 0);
assert.equal(clean.result.healthStatus, 'good');
assert.ok(clean.result.tags.includes('origin:custom'));
assert.ok(clean.result.tags.includes('source:generated'));
assert.equal(clean.result.entryOverrides['nami.fact'].extensions.sagaLoredeckFinalizedFrom.packId, 'generated-finalization-clean-pack');
assert.deepEqual(clean.selected, [clean.result.packId]);
assert.deepEqual(clean.openedMetadata, [clean.result.packId]);
assert.ok(clean.toasts.some(toast => toast.type === 'success' && toast.message.includes('finalized as a Custom Loredeck')));

console.log('Generated Loredeck finalization health tests passed.');
