import { buildLoredeckHealthForData } from '../../src/loredecks/loredeck-health-engine.js';

export function cloneRepairFixture(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildBadArlongEntry(overrides = {}) {
  return {
    schemaVersion: 3,
    id: 'nami-secret',
    title: "Nami's Secret",
    kind: 'fact',
    category: 'secret',
    fact: 'Legacy top-level fact should move into content.',
    date: { validFrom: 'one-piece.arlong.start' },
    whoKnowsTruth: ['Nami'],
    tags: ['characternami', 'fact', 'secret', 'other'],
    context: {
      scope: 'window',
      validFromAnchor: 'one-piece.arlong.start',
      validToAnchor: 'one-piece.arlong.end',
      sortKeyFrom: 10,
      sortKeyTo: 30,
      precision: 'anchor_window',
      windowKind: 'arc',
      label: 'Arlong Park',
    },
    retrieval: {
      activation: 'context_or_topic',
      frequency: 'normal',
      contextBoost: 'high',
    },
    content: {
      fact: 'Nami hides her buyback deal from Arlong.',
      injection: 'When Nami or Arlong pressure is relevant, treat the thefts as cover for a hidden buyback plan.',
    },
    ...overrides,
  };
}

export function buildArlongStyleRepairPack(options = {}) {
  const count = Number.isFinite(Number(options.count)) ? Math.max(1, Math.round(Number(options.count))) : 56;
  const pack = {
    packId: options.packId || 'one-piece-arlong-park-custom',
    type: 'custom',
    title: 'Arlong Park Arc Custom',
    entrySchemaVersion: 3,
    manifestData: {
      id: options.packId || 'one-piece-arlong-park-custom',
      type: 'custom',
      title: 'Arlong Park Arc Custom',
      entrySchemaVersion: 3,
      files: [],
      registries: {
        timeline: 'timeline.json',
        tags: 'tags.json',
      },
      stats: { entryCount: count, categoryCounts: count === 1 ? { secret: 1 } : { secret: 1, other: count - 1 } },
    },
    entryOverrides: {},
    timelineRegistry: {
      schemaVersion: 1,
      timelineMode: 'hybrid',
      sortKeyScale: 'pack_local',
      anchors: [
        { id: 'one-piece.arlong.start', label: 'Arlong Park starts', sortKey: 10 },
        { id: 'one-piece.arlong.arlong-betrays-buyback', label: 'Arlong betrays the buyback deal', sortKey: 20 },
        { id: 'one-piece.arlong.end', label: 'Arlong Park ends', sortKey: 30 },
      ],
      windows: [
        { id: 'one-piece.arlong.arc', label: 'Arlong Park', anchorFrom: 'one-piece.arlong.start', anchorTo: 'one-piece.arlong.end', sortKeyFrom: 10, sortKeyTo: 30 },
      ],
    },
    tagRegistry: {
      schemaVersion: 1,
      tags: {
        'character:nami': { label: 'Nami' },
        'character:arlong': { label: 'Arlong' },
        'faction:arlong-pirates': { label: 'Arlong Pirates' },
        'concept:buyback-deal': { label: 'Buyback Deal' },
      },
    },
  };
  for (let index = 1; index <= count; index += 1) {
    const id = index === Math.min(23, count) ? 'namis-childhood-under-arlongs-rule' : `arlong-style-entry-${String(index).padStart(2, '0')}`;
    pack.entryOverrides[id] = buildBadArlongEntry({
      id,
      title: `Arlong Style Entry ${index}`,
      category: index === 1 ? 'secret' : 'other',
      tags: index % 2 === 0
        ? ['characterarlong', 'characternami', 'factionarlong-pirates', 'fact', 'other']
        : ['characternami', 'factionarlong-pirates', 'conceptbuyback-deal', 'fact', 'other'],
      context: {
        ...buildBadArlongEntry().context,
        validFromAnchor: 'one-piece.arlong.start',
        validToAnchor: index === Math.min(23, count) ? 'one-piece.arlong.arlong-betrays-buyback-deal' : 'one-piece.arlong.end',
        sortKeyFrom: 10,
        sortKeyTo: index === Math.min(23, count) ? 20 : 30,
      },
    });
  }
  return pack;
}

export function buildAmbiguousTagRepairPack() {
  const pack = buildArlongStyleRepairPack({ count: 1, packId: 'ambiguous-tag-repair-pack' });
  pack.tagRegistry.tags['character_nami'] = { label: 'Nami alternate compact tag' };
  return pack;
}

export function buildManifestStatsMismatchPack() {
  const pack = buildArlongStyleRepairPack({ count: 3, packId: 'manifest-stats-repair-pack' });
  const entryIds = Object.keys(pack.entryOverrides || {});
  entryIds.forEach((entryId, index) => {
    const entry = pack.entryOverrides[entryId];
    delete entry.fact;
    delete entry.date;
    delete entry.whoKnowsTruth;
    entry.category = index === 0 ? 'secret' : 'other';
    entry.tags = index === 1 ? ['character:arlong'] : ['character:nami'];
    entry.context = {
      ...entry.context,
      validFromAnchor: 'one-piece.arlong.start',
      validToAnchor: 'one-piece.arlong.end',
      sortKeyFrom: 10,
      sortKeyTo: 30,
    };
    entry.content = {
      fact: `Clean fact ${index + 1}.`,
      injection: `Clean injection ${index + 1}.`,
    };
  });
  pack.manifestData.stats = {
    entryCount: 99,
    categoryCounts: {
      secret: 99,
    },
  };
  return pack;
}

export function buildExactAnchorNormalizationPack() {
  const pack = buildArlongStyleRepairPack({ count: 1, packId: 'exact-anchor-normalization-pack' });
  const entry = pack.entryOverrides['namis-childhood-under-arlongs-rule'];
  delete entry.fact;
  delete entry.date;
  delete entry.whoKnowsTruth;
  entry.tags = ['character:nami'];
  entry.context = {
    ...entry.context,
    validFromAnchor: 'one-piece.arlong.start',
    validToAnchor: 'one-piece.arlong.end!',
    sortKeyFrom: 10,
    sortKeyTo: 30,
  };
  entry.content = {
    fact: 'Nami hides the buyback deal during Arlong Park.',
    injection: 'When Arlong Park pressure is relevant, treat Nami as hiding a buyback plan.',
  };
  pack.manifestData.stats = {
    entryCount: 1,
    categoryCounts: {
      secret: 1,
    },
  };
  return pack;
}

export function buildWideRetrievalRepairPack() {
  const pack = buildArlongStyleRepairPack({ count: 1, packId: 'wide-retrieval-repair-pack' });
  const entry = pack.entryOverrides['namis-childhood-under-arlongs-rule'];
  delete entry.fact;
  delete entry.date;
  delete entry.whoKnowsTruth;
  entry.tags = ['character:nami'];
  entry.context = {
    ...entry.context,
    scope: 'global',
    validFromAnchor: 'one-piece.arlong.start',
    validToAnchor: 'one-piece.arlong.end',
    sortKeyFrom: 10,
    sortKeyTo: 30,
    windowKind: 'series',
    label: 'Arlong Park background',
  };
  entry.retrieval = {
    activation: 'context_or_topic',
    frequency: 'normal',
    contextBoost: 'high',
  };
  entry.content = {
    fact: 'Arlong Park is controlled by fear, debt, and Arlong Pirates enforcement.',
    injection: 'When broad Arlong Park background is relevant, treat the village as coerced by Arlong Pirates control.',
  };
  pack.tagRegistry.tags = {
    'character:nami': { label: 'Nami' },
  };
  pack.manifestData.stats = {
    entryCount: 1,
    categoryCounts: {
      secret: 1,
    },
  };
  return pack;
}

export function buildContentAliasRepairPack() {
  const pack = buildArlongStyleRepairPack({ count: 1, packId: 'content-alias-repair-pack' });
  const entry = pack.entryOverrides['namis-childhood-under-arlongs-rule'];
  delete entry.fact;
  delete entry.date;
  delete entry.whoKnowsTruth;
  entry.tags = ['character:nami'];
  entry.description = 'Nami hides the buyback deal because Arlong controls Cocoyasi through debt and fear.';
  entry.injection = 'When Nami or Arlong Park pressure is relevant, treat Nami as hiding coerced payments from her friends.';
  entry.content = {};
  entry.context = {
    ...entry.context,
    validFromAnchor: 'one-piece.arlong.start',
    validToAnchor: 'one-piece.arlong.end',
    sortKeyFrom: 10,
    sortKeyTo: 30,
  };
  entry.retrieval = {
    activation: 'context_or_topic',
    frequency: 'normal',
    contextBoost: 'high',
  };
  pack.tagRegistry.tags = {
    'character:nami': { label: 'Nami' },
  };
  pack.manifestData.stats = {
    entryCount: 1,
    categoryCounts: {
      secret: 1,
    },
  };
  return pack;
}

export function buildRetrievalDefaultsRepairPack() {
  const pack = buildArlongStyleRepairPack({ count: 2, packId: 'retrieval-defaults-repair-pack' });
  const entries = Object.values(pack.entryOverrides || {});
  entries.forEach((entry, index) => {
    delete entry.fact;
    delete entry.date;
    delete entry.whoKnowsTruth;
    entry.tags = ['character:nami'];
    entry.category = index === 0 ? 'secret' : 'other';
    entry.content = {
      fact: `Valid retrieval fixture fact ${index + 1}.`,
      injection: `Valid retrieval fixture injection ${index + 1}.`,
    };
    entry.context = {
      ...entry.context,
      validFromAnchor: 'one-piece.arlong.start',
      validToAnchor: 'one-piece.arlong.end',
      sortKeyFrom: 10,
      sortKeyTo: 30,
    };
  });
  delete entries[0].retrieval;
  entries[1].retrieval = {
    frequency: 'normal',
  };
  pack.tagRegistry.tags = {
    'character:nami': { label: 'Nami' },
  };
  pack.manifestData.stats = {
    entryCount: 2,
    categoryCounts: {
      other: 1,
      secret: 1,
    },
  };
  return pack;
}

export function buildModelRepairPack() {
  const pack = buildArlongStyleRepairPack({ count: 1, packId: 'model-repair-pack' });
  const entry = pack.entryOverrides['namis-childhood-under-arlongs-rule'];
  entry.content = {};
  delete entry.fact;
  delete entry.date;
  delete entry.whoKnowsTruth;
  entry.tags = ['character:nami'];
  entry.context.validToAnchor = 'one-piece.arlong.end';
  return pack;
}

export function buildLargeModelRepairPack(options = {}) {
  const count = Number.isFinite(Number(options.count)) ? Math.max(1, Math.round(Number(options.count))) : 57;
  const pack = buildArlongStyleRepairPack({ count, packId: options.packId || 'large-model-repair-pack' });
  for (const [entryId, entry] of Object.entries(pack.entryOverrides || {})) {
    delete entry.fact;
    delete entry.date;
    delete entry.whoKnowsTruth;
    entry.tags = entryId.endsWith('02') ? ['character:arlong'] : ['character:nami'];
    entry.context = {
      ...entry.context,
      validFromAnchor: 'one-piece.arlong.start',
      validToAnchor: 'one-piece.arlong.end',
      sortKeyFrom: 10,
      sortKeyTo: 30,
    };
    entry.content = {};
  }
  return pack;
}

export function buildRepairHealth(pack) {
  const entryFiles = Array.isArray(pack.entryFiles)
    ? pack.entryFiles
    : Array.isArray(pack.entries)
      ? [{
        file: '__saga_entries__',
        schemaVersion: Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 3,
        entries: pack.entries,
      }]
      : [{
        file: '__saga_embedded_entries__',
        schemaVersion: Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 3,
        entries: Object.values(pack.entryOverrides || {}),
      }];
  return buildLoredeckHealthForData({
    packId: pack.packId,
    manifest: pack.manifestData,
    entryFiles,
    timeline: pack.timelineRegistry,
    tagRegistry: pack.tagRegistry,
  });
}
