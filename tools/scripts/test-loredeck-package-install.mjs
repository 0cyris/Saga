import assert from 'node:assert/strict';

const ctx = {
  chatMetadata: {},
  extensionSettings: {},
  saveMetadata() {},
  saveSettingsDebounced() {},
};
globalThis.SillyTavern = {
  getContext() {
    return ctx;
  },
};

const {
  createLoredeckZipPackage,
} = await import('../../src/loredecks/loredeck-package-service.js');
const {
  buildLoredeckPackageRegistryForInstall,
  readLoredeckZipPackageInstallFile,
} = await import('../../src/runtime/loredeck-package-install.js');
const {
  createFolderIdFromPath,
  normalizeLoredeckLibraryIndex,
} = await import('../../src/loredecks/loredeck-library-index.js');
const {
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  getExternalLoredeckLibraryRegistry,
  mergeExternalLoredeckLibraryRegistry,
  resetSagaLorepackLibraryStorageCache,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  configureSagaLorepackPayloadStorage,
  flushSagaLorepackPayloadStorageWrites,
  resetSagaLorepackPayloadStorageCache,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  importLoredeckLibraryRegistry,
} = await import('../../src/state/state-manager.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

const stored = new Map();

function response(ok, status, body = '') {
  return {
    ok,
    status,
    async text() {
      return body;
    },
  };
}

const fileApi = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'package-install-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path }));
    }
    if (url === '/api/files/delete' && method === 'POST') {
      stored.delete(body.path);
      return response(true, 200, JSON.stringify({ ok: true }));
    }
    if (url === '/api/files/verify' && method === 'POST') {
      return response(true, 200, JSON.stringify(Object.fromEntries((body.urls || []).map(path => [path, stored.has(path)]))));
    }
    if (method === 'GET') {
      if (!stored.has(url)) return response(false, 404, 'missing');
      return response(true, 200, stored.get(url));
    }
    return response(false, 404, 'unexpected request');
  },
});

let clock = 1000;
const now = () => clock;
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureSagaLorepackLibraryStorage({ fileApi, now });
configureSagaLorepackPayloadStorage({ fileApi, now });

function deckEntryFile(id, fact) {
  return JSON.stringify({
    schemaVersion: 3,
    entries: [{
      id,
      schemaVersion: 3,
      title: id,
      category: 'knowledge',
      content: { fact, injection: fact },
    }],
  }, null, 2);
}

const packageFiles = [
  {
    path: 'saga-package.json',
    data: JSON.stringify({
      packageSchemaVersion: 1,
      packageType: 'saga_loredeck_package',
      title: 'Placement Fixture Package',
      version: '1.0.0',
      deckCount: 2,
    }, null, 2),
  },
  {
    path: 'loredecks/index.json',
    data: JSON.stringify({
      schemaVersion: 2,
      packageType: 'saga_loredeck_index',
      loredecks: [
        {
          packId: 'deck-a',
          manifest: 'deck-a/loredeck.json',
          type: 'custom',
          title: 'Deck A',
          entrySchemaVersion: 3,
          stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
        },
        {
          packId: 'deck-b',
          manifest: 'deck-b/loredeck.json',
          type: 'bundled',
          title: 'Deck B',
          library: {
            suggestedPath: ['Fixtures', 'Zip Packages'],
          },
          entrySchemaVersion: 3,
          stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
        },
      ],
      folders: [
        { id: 'pkg-root', title: 'Package Decks', parentId: '' },
        { id: 'pkg-root-nested', title: 'Campaign', parentId: 'pkg-root' },
        { id: 'pkg-unused', title: 'Extras', parentId: '' },
      ],
      deckPlacements: [
        { deckId: 'deck-a', folderId: 'pkg-root-nested', sortOrder: 100 },
      ],
    }, null, 2),
  },
  {
    path: 'loredecks/deck-a/loredeck.json',
    data: JSON.stringify({
      id: 'deck-a',
      type: 'custom',
      title: 'Deck A',
      entrySchemaVersion: 3,
      files: ['entries/core.json'],
      stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
    }, null, 2),
  },
  {
    path: 'loredecks/deck-a/entries/core.json',
    data: deckEntryFile('deck_a.fact', 'Deck A lore.'),
  },
  {
    path: 'loredecks/deck-b/loredeck.json',
    data: JSON.stringify({
      id: 'deck-b',
      type: 'bundled',
      title: 'Deck B',
      library: {
        suggestedPath: ['Fixtures', 'Zip Packages'],
      },
      entrySchemaVersion: 3,
      files: ['entries/core.json'],
      stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
    }, null, 2),
  },
  {
    path: 'loredecks/deck-b/entries/core.json',
    data: deckEntryFile('deck_b.fact', 'Deck B lore.'),
  },
];

const zipBytes = await createLoredeckZipPackage(packageFiles, { date: new Date('2026-07-05T00:00:00Z') });
const packageInstall = await readLoredeckZipPackageInstallFile(zipBytes);
assert.equal(packageInstall.ok, true, packageInstall.error || 'Package should be installable.');
assert.equal(packageInstall.installs.length, 2);

const installA = packageInstall.installs.find(install => install.originalPackId === 'deck-a');
const installB = packageInstall.installs.find(install => install.originalPackId === 'deck-b');
assert.ok(installA && installB, 'Both fixture decks should produce installs.');

// (d) PIN — type coercion + provenance.
assert.equal(installA.record.type, 'custom');
assert.equal(installB.record.type, 'custom', 'A package-declared bundled deck must still install as Custom.');
assert.equal(installB.record.derivedFrom.type, 'bundled', 'Original declared type must be preserved in derivedFrom.');
assert.equal(installA.record.source.kind, 'imported_zip');
assert.equal(installA.record.source.bundleType, 'saga_loredeck_zip_package');
assert.equal(installA.record.derivedFrom.kind, 'imported_loredeck_package');
assert.ok(installA.record.tags.includes('origin:zip-package'));

const registry = buildLoredeckPackageRegistryForInstall(packageInstall, packageInstall.installs);
assert.equal(Object.keys(registry.packs).length, 2);

// (b) RED — explicit index folders/deckPlacements survive into the install registry.
assert.ok(
  (registry.deckPlacements || []).some(placement => placement.deckId === 'deck-a' && placement.folderId === 'pkg-root-nested'),
  'Explicit package deck placements must survive into the install registry.',
);
assert.ok(
  (registry.folders || []).some(folder => folder.id === 'pkg-root-nested'),
  'Folders used by package placements must survive into the install registry.',
);
assert.ok(
  (registry.folders || []).some(folder => folder.id === 'pkg-root'),
  'Ancestor folders of used package folders must be retained.',
);
assert.ok(
  !(registry.folders || []).some(folder => folder.id === 'pkg-unused'),
  'Package folders unused by any selected placement must be excluded.',
);

// (a) RED — suggestedPath materialization for decks without an explicit placement.
const suggestedParentId = createFolderIdFromPath(['Fixtures']);
const suggestedFolderId = createFolderIdFromPath(['Fixtures', 'Zip Packages']);
assert.ok(
  (registry.deckPlacements || []).some(placement => placement.deckId === 'deck-b' && placement.folderId === suggestedFolderId),
  'library.suggestedPath must materialize into an explicit placement at install time.',
);
const suggestedFolder = (registry.folders || []).find(folder => folder.id === suggestedFolderId);
assert.ok(suggestedFolder, 'suggestedPath chain folders must be created.');
assert.equal(suggestedFolder.parentId, suggestedParentId, 'suggestedPath chain folders must keep their parent chain.');
assert.ok((registry.folders || []).some(folder => folder.id === suggestedParentId));

// (f) RED — partial selection scopes placements and folders to selected decks.
const registryOnlyA = buildLoredeckPackageRegistryForInstall(packageInstall, [installA]);
assert.deepEqual(Object.keys(registryOnlyA.packs), ['deck-a']);
assert.ok(
  !(registryOnlyA.deckPlacements || []).some(placement => placement.deckId === 'deck-b'),
  'Placements for unselected decks must not be imported.',
);
assert.ok(
  !(registryOnlyA.folders || []).some(folder => folder.id === suggestedFolderId),
  'Folders exclusive to unselected decks must not be imported.',
);
const registryOnlyB = buildLoredeckPackageRegistryForInstall(packageInstall, [installB]);
assert.ok(
  !(registryOnlyB.folders || []).some(folder => folder.id === 'pkg-root-nested'),
  'Explicit package folders exclusive to unselected decks must not be imported.',
);
assert.ok(
  (registryOnlyB.deckPlacements || []).some(placement => placement.deckId === 'deck-b' && placement.folderId === suggestedFolderId),
);

// Import the full registry, then inspect storage and the merged runtime view.
const importResult = importLoredeckLibraryRegistry(registry, { replace: false });
assert.equal(importResult.ok, true, importResult.error || 'Registry import should succeed.');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

// (e) PIN — payload-storage routing: compact library row + externalized payload.
const externalRegistry = getExternalLoredeckLibraryRegistry();
const externalDeckA = externalRegistry.packs['deck-a'];
assert.ok(externalDeckA, 'Imported deck must land in the external library registry.');
assert.ok(externalDeckA.payloadFile, 'Imported deck must be payload-backed.');
assert.equal(externalDeckA.manifestData, undefined, 'Compact library rows must not retain manifest data.');
assert.equal(externalDeckA.library, undefined, 'Compact library rows must not retain library metadata.');
assert.equal(externalDeckA.entryOverrides, undefined, 'Compact library rows must not retain entry overrides.');
const storedPayloads = [...stored.values()].filter(text => String(text).includes('deck_a.fact'));
assert.ok(storedPayloads.length >= 1, 'The deck payload with its Lorecards must be written to storage.');

// (g) RED — headline end-to-end: placements survive into the merged runtime view.
const merged = mergeExternalLoredeckLibraryRegistry({ schemaVersion: 1, packs: {} }, {});
assert.ok(
  (merged.deckPlacements || []).some(placement => placement.deckId === 'deck-a' && placement.folderId === 'pkg-root-nested'),
  'Imported deck placements must survive into the merged runtime registry.',
);
assert.ok(
  (merged.deckPlacements || []).some(placement => placement.deckId === 'deck-b' && placement.folderId === suggestedFolderId),
  'Materialized suggestedPath placements must survive into the merged runtime registry.',
);
assert.ok((merged.folders || []).some(folder => folder.id === 'pkg-root-nested'));
assert.ok((merged.folders || []).some(folder => folder.id === suggestedFolderId));
const mergedIndex = normalizeLoredeckLibraryIndex(merged, { packs: merged.packs });
assert.ok(
  (mergedIndex.deckPlacements || []).some(placement => placement.deckId === 'deck-a' && placement.folderId === 'pkg-root-nested'),
  'The Library index view must show the imported deck inside its package folder.',
);

// (h) GUARD — reinstalling the same registry must not duplicate placements or folders.
const reimportResult = importLoredeckLibraryRegistry(registry, { replace: false });
assert.equal(reimportResult.ok, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
const afterReimport = getExternalLoredeckLibraryRegistry();
const placementsForA = (afterReimport.deckPlacements || []).filter(placement => placement.deckId === 'deck-a');
assert.equal(placementsForA.length, 1, 'Reinstall must not duplicate deck placements.');
const folderIds = (afterReimport.folders || []).map(folder => folder.id);
assert.equal(new Set(folderIds).size, folderIds.length, 'Reinstall must not duplicate folders.');

// (c) RED — collision rename remaps placement deck ids to the renamed pack id.
const collisionInstallFile = await readLoredeckZipPackageInstallFile(zipBytes);
assert.equal(collisionInstallFile.ok, true);
const collisionInstallA = collisionInstallFile.installs.find(install => install.originalPackId === 'deck-a');
assert.ok(collisionInstallA);
assert.equal(collisionInstallA.collision, true, 'Reinstalling an existing deck id must be flagged as a collision.');
assert.ok(collisionInstallA.record.packId.startsWith('deck-a-custom'), `Collision must rename the pack id (got ${collisionInstallA.record.packId}).`);
const collisionRegistry = buildLoredeckPackageRegistryForInstall(collisionInstallFile, collisionInstallFile.installs);
assert.ok(
  (collisionRegistry.deckPlacements || []).some(placement => placement.deckId === collisionInstallA.record.packId && placement.folderId === 'pkg-root-nested'),
  'Package placements must be remapped to the collision-renamed pack id.',
);
assert.ok(
  !(collisionRegistry.deckPlacements || []).some(placement => placement.deckId === 'deck-a'),
  'Package placements must not reference the original colliding pack id.',
);

console.log('Loredeck package install tests passed.');
