#!/usr/bin/env node
/**
 * Summarizes bundled JJK Loredeck coverage for review handoff.
 *
 *   node tools/scripts/report-jjk-loredeck-coverage.mjs
 *   node tools/scripts/report-jjk-loredeck-coverage.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_JJK_LOREDECK_IDS } from '../../src/loredecks/loredeck-defaults.js';

const args = new Set(process.argv.slice(2));
const root = process.cwd();
const loredeckRoot = path.join(root, 'content', 'loredecks');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listEntries(deckRoot, manifest) {
  const entries = [];
  for (const file of manifest.files || []) {
    const shard = readJson(path.join(deckRoot, file));
    for (const entry of shard.entries || []) {
      entries.push({ file, entry });
    }
  }
  return entries;
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = String(getKey(item) || 'unknown').trim() || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function mean(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return null;
  return Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(3));
}

const decks = [];
let totalEntries = 0;
let totalAnchors = 0;
let totalWindows = 0;

for (const deckId of DEFAULT_JJK_LOREDECK_IDS) {
  const deckRoot = path.join(loredeckRoot, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));
  const timeline = readJson(path.join(deckRoot, 'timeline.json'));
  const entries = listEntries(deckRoot, manifest);
  const confidences = entries.map(({ entry }) => entry.sourceInfo?.confidence);
  const deck = {
    packId: deckId,
    title: manifest.title,
    era: manifest.era,
    familyOrder: manifest.library?.familyOrder ?? null,
    suggestedPath: manifest.library?.suggestedPath || [],
    continuityId: manifest.continuity?.continuityId || '',
    sourceBoundary: manifest.continuity?.sourceBoundary || '',
    reviewStatus: manifest.tags?.includes('quality:draft-reference') ? 'draft-reference' : 'unknown',
    healthStatus: manifest.health?.status || '',
    entryCount: entries.length,
    manifestEntryCount: manifest.stats?.entryCount ?? null,
    categoryCounts: countBy(entries, ({ entry }) => entry.category),
    truthStatusCounts: countBy(entries, ({ entry }) => entry.truthStatus),
    revealPolicyCounts: countBy(entries, ({ entry }) => entry.revealPolicy),
    timelineAnchorCount: (timeline.anchors || []).length,
    timelineWindowCount: [
      ...(Array.isArray(timeline.windows) ? timeline.windows : []),
      ...(Array.isArray(timeline.arcs) ? timeline.arcs : []),
      ...(Array.isArray(timeline.phases) ? timeline.phases : []),
    ].length,
    fileCount: (manifest.files || []).length,
    averageSourceConfidence: mean(confidences),
    minSourceConfidence: Math.min(...confidences.map(Number).filter(Number.isFinite)),
    maxSourceConfidence: Math.max(...confidences.map(Number).filter(Number.isFinite)),
  };
  decks.push(deck);
  totalEntries += deck.entryCount;
  totalAnchors += deck.timelineAnchorCount;
  totalWindows += deck.timelineWindowCount;
}

const report = {
  generatedAt: new Date().toISOString(),
  deckCount: decks.length,
  totalEntries,
  totalAnchors,
  totalWindows,
  bySuggestedPath: countBy(decks, deck => deck.suggestedPath.join(' / ')),
  byContinuityId: countBy(decks, deck => deck.continuityId),
  decks,
};

if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`JJK Loredeck coverage: ${report.deckCount} decks, ${totalEntries} Lorecards, ${totalAnchors} anchors, ${totalWindows} windows`);
  console.log(`Library paths: ${JSON.stringify(report.bySuggestedPath)}`);
  console.log(`Continuities: ${JSON.stringify(report.byContinuityId)}`);
  console.log('');
  for (const deck of decks) {
    console.log(`${String(deck.familyOrder).padStart(3, ' ')} ${deck.packId}`);
    console.log(`    ${deck.title}`);
    console.log(`    path=${deck.suggestedPath.join(' / ')} continuity=${deck.continuityId} status=${deck.reviewStatus}/${deck.healthStatus}`);
    console.log(`    entries=${deck.entryCount} files=${deck.fileCount} anchors=${deck.timelineAnchorCount} windows=${deck.timelineWindowCount} confidence=${deck.averageSourceConfidence}`);
    console.log(`    categories=${JSON.stringify(deck.categoryCounts)}`);
    console.log(`    revealPolicies=${JSON.stringify(deck.revealPolicyCounts)}`);
  }
}
