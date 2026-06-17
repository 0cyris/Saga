import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorEmbeddedGeneratedManifest,
  buildLoredeckCreatorGeneratedManifestSeed,
  buildLoredeckCreatorGeneratedPackRecord,
  buildLoredeckCreatorGeneratedTags,
  getLoredeckCreatorGeneratedPackId,
  normalizeLoredeckCreatorGeneratedPackId,
} from '../../src/loredecks/loredeck-creator-generated-pack.js';

const brief = {
  title: 'Arlong Park Pressure',
  packId: 'One Piece: Arlong Park!',
  fandom: 'One Piece',
  scope: 'Arlong Park',
  granularity: 'focused',
  coverage: 'Nami, Arlong, Cocoyasi Village, and the emotional pressure around the betrayal reveal.',
};

assert.equal(
  normalizeLoredeckCreatorGeneratedPackId(' One Piece: Arlong Park! '),
  'one-piece-arlong-park',
  'Generated pack ids should use the same storage-safe slug contract as Loredeck package ids.',
);
assert.equal(
  getLoredeckCreatorGeneratedPackId({ brief }),
  'one-piece-arlong-park',
  'Generated pack ids should prefer the approved brief packId.',
);
assert.equal(
  getLoredeckCreatorGeneratedPackId({ generatedPackId: 'custom-generated-id', brief }),
  'custom-generated-id',
  'Generated pack ids should preserve an existing generatedPackId when one is already linked.',
);

assert.deepEqual(
  buildLoredeckCreatorGeneratedTags(brief),
  ['origin:generated', 'quality:model-drafted', 'saga:creator', 'fandom:one-piece'],
  'Generated Loredeck tags should include origin, quality, creator, and normalized fandom tags.',
);

assert.deepEqual(
  buildLoredeckCreatorGeneratedManifestSeed('one-piece-arlong-park', brief),
  {
    schemaVersion: 3,
    id: 'one-piece-arlong-park',
    type: 'generated',
    title: 'Arlong Park Pressure',
    description: brief.coverage,
    fandom: 'One Piece',
    era: 'Arlong Park',
    author: 'Saga Deck Maker',
    version: '0.1.0',
    entrySchemaVersion: 3,
    files: [],
    registries: {
      timeline: 'timeline.json',
      tags: 'tags.json',
    },
    tags: ['origin:generated', 'quality:model-drafted', 'saga:creator', 'fandom:one-piece'],
    stats: {
      entryCount: 0,
      categoryCounts: {},
    },
    health: {
      status: 'draft',
    },
  },
  'Generated manifest seeds should describe a draft generated Loredeck shell with empty file refs.',
);

{
  const manifest = buildLoredeckCreatorEmbeddedGeneratedManifest(
    {
      id: 'old-id',
      type: 'generated',
      title: 'Old Title',
      entries: [{ id: 'must-not-embed' }],
      files: null,
    },
    {
      packId: 'new-id',
      type: 'generated',
      title: 'New Title',
      description: 'New description',
      fandom: 'One Piece',
      era: 'Arlong Park',
      author: 'Saga Deck Maker',
      version: '0.1.0',
      tags: ['origin:generated'],
      source: { kind: 'generated' },
      derivedFrom: { kind: 'saga_creator' },
      stats: { entryCount: 0 },
      entrySchemaVersion: 3,
    },
  );
  assert.equal(manifest.id, 'new-id');
  assert.equal(manifest.type, 'generated');
  assert.equal(manifest.title, 'New Title');
  assert.equal(manifest.entries, undefined, 'Embedded generated manifests should not inline entries.');
  assert.deepEqual(manifest.files, [], 'Embedded generated manifests should normalize missing file refs.');
  assert.deepEqual(manifest.update, { checkForUpdates: false, url: '' });
}

{
  const record = buildLoredeckCreatorGeneratedPackRecord(
    { brief },
    'one-piece-arlong-park',
    null,
    { now: 12345 },
  );

  assert.equal(record.packId, 'one-piece-arlong-park');
  assert.equal(record.type, 'generated');
  assert.equal(record.title, 'Arlong Park Pressure');
  assert.equal(record.description, brief.coverage);
  assert.equal(record.fandom, 'One Piece');
  assert.equal(record.era, 'Arlong Park');
  assert.equal(record.author, 'Saga Deck Maker');
  assert.equal(record.version, '0.1.0');
  assert.deepEqual(record.tags, ['origin:generated', 'quality:model-drafted', 'saga:creator', 'fandom:one-piece']);
  assert.deepEqual(record.stats, { entryCount: 0, categoryCounts: {} });
  assert.equal(record.healthStatus, 'draft');
  assert.deepEqual(record.derivedFrom, {
    kind: 'saga_creator',
    title: 'Arlong Park Pressure',
    fandom: 'One Piece',
    scope: 'Arlong Park',
    granularity: 'focused',
    createdAt: 12345,
  });
  assert.deepEqual(record.entryOverrides, {});
  assert.deepEqual(record.disabledEntryIds, []);
  assert.equal(record.tagRegistry, null);
  assert.equal(record.timelineRegistry, null);
  assert.deepEqual(record.pendingChanges, []);
  assert.equal(record.installedAt, 12345);
  assert.equal(record.updatedAt, 12345);
  assert.equal(record.manifestData.id, 'one-piece-arlong-park');
  assert.equal(record.manifestData.type, 'generated');
  assert.equal(record.manifestData.entries, undefined);
}

{
  const existing = {
    packId: 'existing-id',
    type: 'generated',
    title: 'Existing Title',
    description: 'Existing description',
    fandom: 'Existing fandom',
    era: 'Existing era',
    author: 'Existing author',
    version: '9.9.9',
    manifest: 'existing-manifest-url',
    source: { importedFrom: 'test' },
    tags: ['existing:tag'],
    stats: { entryCount: 2, categoryCounts: { character: 2 } },
    healthStatus: 'warning',
    derivedFrom: { kind: 'existing_source', createdAt: 10 },
    entryOverrides: { nami: { title: 'Nami' } },
    disabledEntryIds: ['disabled-entry'],
    pendingChanges: [{ changeId: 'pending-a', targetKind: 'entry', affectedEntryIds: ['nami'] }],
    installedAt: 222,
  };
  const record = buildLoredeckCreatorGeneratedPackRecord(
    { brief: { ...brief, title: '', coverage: '' } },
    'existing-id',
    existing,
    { now: 333 },
  );

  assert.equal(record.title, 'Existing Title');
  assert.equal(record.description, 'Existing description');
  assert.equal(record.author, 'Existing author');
  assert.equal(record.version, '9.9.9');
  assert.deepEqual(record.source, { importedFrom: 'test', kind: 'generated', url: '', updateUrl: '' });
  assert.deepEqual(record.tags, ['existing:tag']);
  assert.deepEqual(record.stats, { entryCount: 2, categoryCounts: { character: 2 } });
  assert.equal(record.healthStatus, 'warning');
  assert.deepEqual(record.derivedFrom, { kind: 'existing_source', createdAt: 10 });
  assert.deepEqual(record.entryOverrides, { nami: { title: 'Nami' } });
  assert.deepEqual(record.disabledEntryIds, ['disabled-entry']);
  assert.equal(record.pendingChanges.length, 1);
  assert.equal(record.installedAt, 222);
  assert.equal(record.updatedAt, 333);
}

{
  const record = buildLoredeckCreatorGeneratedPackRecord(
    { brief: {} },
    '$$$',
    null,
    { createUniquePackId: base => `${base}-unique`, now: 1 },
  );
  assert.equal(record.packId, 'generated-loredeck-unique', 'Generated record builder should delegate invalid id fallback to the caller when provided.');
}

console.log('Deck Maker generated-pack builder tests passed.');
