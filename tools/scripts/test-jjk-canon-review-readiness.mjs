import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_JJK_LOREDECK_IDS } from '../../src/loredecks/loredeck-defaults.js';

const ROOT = process.cwd();
const LOREDECK_ROOT = path.join(ROOT, 'content', 'loredecks');
const HUMAN_REVIEW_NOTE = 'requires human canon review';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listEntries(deckRoot, manifest) {
  const entries = [];
  for (const file of manifest.files || []) {
    const shard = readJson(path.join(deckRoot, file));
    for (const entry of shard.entries || []) {
      entries.push({ entry, file });
    }
  }
  return entries;
}

for (const deckId of DEFAULT_JJK_LOREDECK_IDS) {
  const deckRoot = path.join(LOREDECK_ROOT, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));
  const duplicateManifest = readJson(path.join(deckRoot, 'manifest.json'));

  assert.deepEqual(duplicateManifest.license, manifest.license, `${deckId} duplicated manifest should keep license review notes in sync.`);
  assert.deepEqual(duplicateManifest.health, manifest.health, `${deckId} duplicated manifest should keep health review notes in sync.`);
  assert.ok(manifest.tags?.includes('quality:draft-reference'), `${deckId} should stay draft-reference until human canon review is complete.`);
  assert.match(String(manifest.license?.notes || '').toLowerCase(), /requires human canon review/, `${deckId} license notes should require human canon review.`);
  assert.equal(manifest.health?.status, 'needs_review', `${deckId} should flag expanded draft content for human canon review.`);
  assert.match(String(manifest.health?.notes || '').toLowerCase(), /human canon review|structural health|local structural health/, `${deckId} health notes should not imply canon approval.`);

  for (const { entry, file } of listEntries(deckRoot, manifest)) {
    const sourceInfo = entry.sourceInfo || {};
    const scaffold = entry.extensions?.sagaJjkScaffold || {};
    const confidence = Number(sourceInfo.confidence);
    const label = `${deckId}/${file}/${entry.id}`;

    assert.equal(sourceInfo.sourceType, 'manga', `${label} sourceInfo.sourceType should be manga.`);
    assert.ok(String(sourceInfo.work || '').trim(), `${label} sourceInfo.work is required.`);
    assert.ok(String(sourceInfo.title || '').trim(), `${label} sourceInfo.title is required.`);
    assert.ok(String(sourceInfo.chapterRange || '').trim(), `${label} sourceInfo.chapterRange is required.`);
    assert.equal(Number.isFinite(confidence), true, `${label} sourceInfo.confidence should be numeric.`);
    assert.ok(confidence >= 0.5 && confidence <= 1, `${label} sourceInfo.confidence should stay in the 0.5-1 review-ready range.`);
    assert.match(String(sourceInfo.notes || '').toLowerCase(), new RegExp(HUMAN_REVIEW_NOTE), `${label} sourceInfo.notes should preserve human canon review status.`);
    assert.equal(scaffold.targetPackId, deckId, `${label} scaffold targetPackId should match its deck.`);
    assert.ok(String(scaffold.status || '').trim(), `${label} scaffold status is required.`);
  }
}

console.log('JJK canon review readiness checks passed.');
