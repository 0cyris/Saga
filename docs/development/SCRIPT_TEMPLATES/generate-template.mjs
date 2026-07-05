/**
 * Generates a example Loredeck from hand-authored specs and source evidence.
 *
 * This template demonstrates the 8-layer architecture for generation scripts:
 * 1. Imports
 * 2. Root/Constants
 * 3. Utilities
 * 4. Generation Logic
 * 5. Output Builders
 * 6. File I/O
 * 7. Orchestrator
 * 8. CLI Entry Point
 *
 * Usage:
 *   node tools/scripts/generate-example-loredeck.mjs example-deck-1
 *   node tools/scripts/generate-example-loredeck.mjs example-deck-1 example-deck-2
 *
 * Output:
 *   Creates content/loredecks/{deckId}/ with manifest.json, entries, and metadata
 *   Updates content/loredecks/index.json with the new deck
 *
 * See: docs/development/SCRIPTS_GUIDE.md for patterns and conventions
 */

// ============================================================================
// Layer 1: Imports
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';

// ============================================================================
// Layer 2: Root and Constants
// ============================================================================

const ROOT = process.cwd();
const EVIDENCE_PATH = path.join(ROOT, 'docs/example-evidence.json');
const UPDATED_AT = Date.now();
const ENTRY_SCHEMA_VERSION = 3;

// Frozen configuration objects prevent accidental modification
const DECK_CONFIGS = Object.freeze({
  'example-deck-1': {
    title: 'Example Deck 1',
    shortTitle: 'Deck 1',
    slug: 'example-1',
    libraryPath: ['Examples', 'Deck 1'],
    sortBase: 5000,
    entryFloor: 10,    // Minimum expected entries
    entryCeiling: 50,  // Maximum expected entries
  },
  'example-deck-2': {
    title: 'Example Deck 2',
    shortTitle: 'Deck 2',
    slug: 'example-2',
    libraryPath: ['Examples', 'Deck 2'],
    sortBase: 5100,
    entryFloor: 10,
    entryCeiling: 50,
  },
});

// Hand-authored specs for specific decks take precedence over auto-generation
const HAND_AUTHORED_SPECS = Object.freeze({
  'example-deck-1': {
    'Chapter 1': {
      characters: ['Alice', 'Bob'],
      topics: ['First meeting', 'Introduction'],
      event: 'Alice and Bob meet for the first time.',
      state: 'Both characters are introduced; their relationship begins.',
      guard: 'Do not import future character arcs before this chapter.',
    },
  },
});

// ============================================================================
// Layer 3: Utilities
// ============================================================================

function slug(text) {
  return text.toLowerCase().replace(/\s+/g, '-');
}

function titleCase(text) {
  return text.replace(/\b\w/g, char => char.toUpperCase());
}

function unique(array) {
  return [...new Set(array)];
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

// ============================================================================
// Layer 4: Generation Logic
// ============================================================================

function buildFocusCard(chapterTitle, focus, chapterIndex) {
  return {
    id: `focus-${chapterIndex}`,
    title: `Focus: ${chapterTitle}`,
    kind: 'focus_card',
    characters: asArray(focus.characters),
    topics: asArray(focus.topics),
    event: focus.event,
    state: focus.state,
    guard: focus.guard,
  };
}

function buildStateCard(chapterTitle, focus, chapterIndex) {
  return {
    id: `state-${chapterIndex}`,
    title: `Character State: ${chapterTitle}`,
    kind: 'state_card',
    characters: asArray(focus.characters),
    content: {
      fact: focus.state,
    },
  };
}

function buildGuardCard(chapterTitle, focus, chapterIndex) {
  return {
    id: `guard-${chapterIndex}`,
    title: `Continuity Guard: ${chapterTitle}`,
    kind: 'guard_card',
    content: {
      constraint: focus.guard,
    },
  };
}

function buildCards(chapters, specs) {
  const cards = [];
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const spec = specs[chapter.title];

    if (spec) {
      cards.push(buildFocusCard(chapter.title, spec, i));
      cards.push(buildStateCard(chapter.title, spec, i));
      cards.push(buildGuardCard(chapter.title, spec, i));
    }
  }
  return cards;
}

function buildEntry(card, config) {
  return {
    schemaVersion: ENTRY_SCHEMA_VERSION,
    id: card.id,
    title: card.title,
    kind: card.kind,
    tags: [config.slug, card.kind],
    content: card.content || {},
    context: {
      validFrom: 0,
      validUntil: 999999999,
    },
    continuity: {
      canon: true,
    },
  };
}

// ============================================================================
// Layer 5: Output Builders
// ============================================================================

function buildManifest(entries, config, deckId) {
  return {
    schemaVersion: ENTRY_SCHEMA_VERSION,
    id: deckId,
    title: config.title,
    shortTitle: config.shortTitle,
    libraryPath: config.libraryPath,
    source: EVIDENCE_PATH,
    updatedAt: UPDATED_AT,
    entries: entries.length,
    files: ['entries.json'],
    continuity: {
      seasonCount: 1,
      episodeCount: entries.length,
    },
    compatibility: {
      minSchemaVersion: 3,
    },
  };
}

function buildTimeline(entries) {
  return {
    anchors: entries
      .filter(e => e.kind === 'focus_card')
      .map((e, i) => ({
        id: `anchor-${i}`,
        title: e.title,
        position: i,
      })),
    windows: [
      {
        id: 'deck-start',
        anchorFrom: 'anchor-0',
        label: 'At Deck Start',
      },
    ],
  };
}

function buildTagsRegistry(entries) {
  const tags = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(entry.id);
    }
  }
  return Object.fromEntries(tags);
}

function buildEntitiesRegistry(entries) {
  const entities = {};
  for (const entry of entries) {
    for (const character of entry.characters || []) {
      if (!entities[character]) {
        entities[character] = {
          name: character,
          entries: [],
        };
      }
      entities[character].entries.push(entry.id);
    }
  }
  return entities;
}

// ============================================================================
// Layer 6: File I/O
// ============================================================================

async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJsonFile(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${json}\n`, 'utf8');
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// ============================================================================
// Layer 7: Orchestrator
// ============================================================================

async function generateDeck(deckId) {
  // Validate input
  if (deckId.includes('..') || deckId.startsWith('/')) {
    throw new Error(`Invalid deck ID: ${deckId}`);
  }

  const config = DECK_CONFIGS[deckId];
  if (!config) {
    throw new Error(`Unknown deck ID: ${deckId}`);
  }

  const deckPath = path.resolve(path.join(ROOT, 'content/loredecks', deckId));
  const expectedRoot = path.resolve(path.join(ROOT, 'content/loredecks'));
  if (!deckPath.startsWith(expectedRoot)) {
    throw new Error(`Path traversal attempt: ${deckId}`);
  }

  // Read source evidence
  let evidence;
  try {
    evidence = await readJsonFile(EVIDENCE_PATH);
  } catch (error) {
    throw new Error(`Failed to read evidence from ${EVIDENCE_PATH}: ${error.message}`);
  }

  // Get hand-authored specs or use defaults
  const specs = HAND_AUTHORED_SPECS[deckId] || {};

  // Generate cards and entries
  const cards = buildCards(evidence.chapters || [], specs);
  const entries = cards.map(card => buildEntry(card, config));

  // Validate entry count
  if (entries.length < config.entryFloor) {
    throw new Error(`Too few entries: ${entries.length} < ${config.entryFloor}`);
  }
  if (entries.length > config.entryCeiling) {
    throw new Error(`Too many entries: ${entries.length} > ${config.entryCeiling}`);
  }

  // Build output structures
  const manifest = buildManifest(entries, config, deckId);
  const timeline = buildTimeline(entries);
  const tags = buildTagsRegistry(entries);
  const entities = buildEntitiesRegistry(entries);

  // Ensure output directory exists
  await ensureDirectory(deckPath);

  // Write output files
  await writeJsonFile(path.join(deckPath, 'manifest.json'), manifest);
  await writeJsonFile(path.join(deckPath, 'entries.json'), { entries });
  await writeJsonFile(path.join(deckPath, 'timeline.json'), timeline);
  await writeJsonFile(path.join(deckPath, 'tags.json'), tags);
  await writeJsonFile(path.join(deckPath, 'entities.json'), entities);

  // Return summary
  return {
    deckId,
    title: config.title,
    entryCount: entries.length,
    status: 'success',
  };
}

// ============================================================================
// Layer 8: CLI Entry Point
// ============================================================================

const deckIds = process.argv.slice(2);

if (!deckIds.length) {
  console.error(`Usage: node ${path.basename(import.meta.filename)} <deckId> [<deckId> ...]`);
  console.error(`Available decks: ${Object.keys(DECK_CONFIGS).join(', ')}`);
  process.exit(1);
}

try {
  const results = await Promise.all(deckIds.map(id => generateDeck(id)));
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
