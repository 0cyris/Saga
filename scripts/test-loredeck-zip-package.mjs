import assert from 'node:assert/strict';

const {
  assertSafeZipEntryPath,
  createStoredZipArchive,
  readZipArchive,
} = await import('../loredeck-package-zip.js');
const {
  createLoredeckZipPackage,
  parseLoredeckZipPackage,
} = await import('../loredeck-package-service.js');

const packageFiles = [
  {
    path: 'saga-package.json',
    data: JSON.stringify({
      packageSchemaVersion: 1,
      packageType: 'saga_loredeck_package',
      title: 'Fixture Package',
      version: '1.0.0',
      deckCount: 1,
    }, null, 2),
  },
  {
    path: 'Loredecks/index.json',
    data: JSON.stringify({
      schemaVersion: 2,
      packageType: 'saga_loredeck_index',
      loredecks: [{
        packId: 'fixture-deck',
        manifest: 'fixture-deck/loredeck.json',
        type: 'custom',
        title: 'Fixture Deck',
        library: {
          suggestedPath: ['Fixtures', 'Zip Packages'],
        },
        assets: {
          cover: {
            path: 'assets/cover.png',
            alt: 'Fixture cover',
          },
        },
        entrySchemaVersion: 3,
        stats: {
          entryCount: 1,
          categoryCounts: { knowledge: 1 },
        },
      }],
      folders: [{
        id: 'fixtures',
        title: 'Fixtures',
        parentId: '',
      }],
      deckPlacements: [{
        deckId: 'fixture-deck',
        folderId: 'fixtures',
      }],
    }, null, 2),
  },
  {
    path: 'Loredecks/fixture-deck/loredeck.json',
    data: JSON.stringify({
      id: 'fixture-deck',
      type: 'custom',
      title: 'Fixture Deck',
      entrySchemaVersion: 3,
      files: ['entries/core.json'],
      assets: {
        cover: {
          path: 'assets/cover.png',
          alt: 'Fixture cover',
        },
      },
      stats: {
        entryCount: 1,
        categoryCounts: { knowledge: 1 },
      },
    }, null, 2),
  },
  {
    path: 'Loredecks/fixture-deck/entries/core.json',
    data: JSON.stringify({
      schemaVersion: 3,
      entries: [{
        id: 'fixture.fact',
        schemaVersion: 3,
        title: 'Fixture Fact',
        category: 'knowledge',
        content: {
          fact: 'Fixture lore.',
          injection: 'Fixture lore.',
        },
      }],
    }, null, 2),
  },
  {
    path: 'Loredecks/fixture-deck/assets/cover.png',
    data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  },
];

const zipBytes = await createLoredeckZipPackage(packageFiles, { date: new Date('2026-06-08T00:00:00Z') });
assert.ok(zipBytes.length > 100, 'zip package should contain data');

const archive = await readZipArchive(zipBytes);
assert.equal(archive.entries.length, packageFiles.length, 'zip archive should preserve every fixture file');
assert.equal(await archive.readText('Loredecks/fixture-deck/entries/core.json').then(text => JSON.parse(text).entries.length), 1);

const parsed = await parseLoredeckZipPackage(zipBytes);
assert.equal(parsed.packageMeta.title, 'Fixture Package');
assert.equal(parsed.deckCount, 1);
assert.equal(parsed.folderCount, 1);
assert.equal(parsed.entryCountHint, 1);
assert.equal(parsed.failures.length, 0);
assert.equal(parsed.decks[0].originalPackId, 'fixture-deck');
assert.equal(parsed.decks[0].manifestPath, 'Loredecks/fixture-deck/loredeck.json');
assert.deepEqual(parsed.decks[0].fileRefs, ['Loredecks/fixture-deck/entries/core.json']);
assert.equal(parsed.decks[0].assetRefs[0].resolvedPath, 'Loredecks/fixture-deck/assets/cover.png');

const objectIndexZip = await createLoredeckZipPackage([
  {
    path: 'Loredecks/index.json',
    data: JSON.stringify({
      schemaVersion: 2,
      loredecks: {
        fixture: {
          packId: 'object-index-deck',
          manifest: 'object-index-deck/loredeck.json',
          title: 'Object Index Deck',
        },
      },
      folders: {
        root: {
          id: 'object-root',
          title: 'Object Root',
        },
      },
    }, null, 2),
  },
  {
    path: 'Loredecks/object-index-deck/loredeck.json',
    data: JSON.stringify({
      id: 'object-index-deck',
      title: 'Object Index Deck',
      entrySchemaVersion: 3,
      files: ['entries/core.json'],
      stats: { entryCount: 1 },
    }, null, 2),
  },
  {
    path: 'Loredecks/object-index-deck/entries/core.json',
    data: JSON.stringify({
      schemaVersion: 3,
      entries: [{ id: 'object.fact', title: 'Object Fact', content: { fact: 'Object lore.' } }],
    }, null, 2),
  },
]);
const objectParsed = await parseLoredeckZipPackage(objectIndexZip);
assert.equal(objectParsed.deckCount, 1);
assert.equal(objectParsed.folderCount, 1);
assert.equal(objectParsed.decks[0].originalPackId, 'object-index-deck');

assert.throws(() => assertSafeZipEntryPath('../evil.json'), /Unsafe zip entry path/);
assert.throws(() => assertSafeZipEntryPath('Loredecks/deck/script.js'), /Unsupported executable/);
assert.equal(assertSafeZipEntryPath('Loredecks/fixture-deck/'), 'Loredecks/fixture-deck/');

const unsafeZip = await createStoredZipArchive([
  { path: 'Loredecks/fixture-deck/loredeck.json', data: '{}' },
]);
const unsafeArchive = await readZipArchive(unsafeZip);
await assert.rejects(() => unsafeArchive.readText('Loredecks/fixture-deck/missing.json'), /missing file/);

console.log('Loredeck zip package tests passed.');
