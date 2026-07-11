/**
 * test-loredeck-cli-package-roundtrip.mjs -- Saga
 * Drives a scripted mini-project through the promotion pipeline: draft deck
 * -> promote (stats + conformance + strict health) -> package -> verify.
 * Also proves promote refuses unhealthy decks and verify-package rejects a
 * package with a broken deck.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseLoredeckZipPackage } from '../../src/loredecks/loredeck-package-service.js';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-cli-package-roundtrip');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectDir = path.join(workshopRoot, 'roundtrip-canon');
const deckDir = path.join(projectDir, 'drafts', 'roundtrip-canon');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function buildEntry(id, { activation = 'topic_or_entity' } = {}) {
    return {
        schemaVersion: 3,
        id,
        title: `Card ${id}`,
        kind: 'world_rule',
        gateType: 'world_rule',
        category: 'rule',
        relevance: 'high',
        lorePurpose: 'behavior_constraint',
        specificityScore: 70,
        injectableByDefault: true,
        canon: 'canon',
        canonStatus: 'canon',
        truthStatus: 'true',
        revealPolicy: 'public',
        priority: 100,
        status: 'active',
        context: {
            scope: 'window',
            validFromAnchor: 'rt.start',
            validToAnchor: 'rt.end',
            sortKeyFrom: 100,
            sortKeyTo: 200,
            precision: 'story_window',
            windowKind: 'story',
            label: 'Roundtrip window',
        },
        scope: { topics: ['roundtrip'] },
        retrieval: {
            activation,
            frequency: 'low',
            contextBoost: 'low',
            triggers: { topicsAny: ['roundtrip'] },
        },
        content: { fact: `Fact for ${id}.`, injection: `Injection for ${id}.` },
        sourceInfo: { work: 'Roundtrip Canon', sourceType: 'book' },
        tags: ['fandom:roundtrip-canon'],
    };
}

await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', 'roundtrip-canon', '--title', 'Roundtrip Canon').code, 0);

await writeFile(path.join(deckDir, 'timeline.json'), JSON.stringify({
    schemaVersion: 1,
    timelineMode: 'story_anchor',
    defaultContextType: 'story_anchor',
    anchors: [
        { id: 'rt.start', label: 'Start', contextType: 'story_anchor', sortKey: 100, aliases: ['Start'] },
        { id: 'rt.end', label: 'End', contextType: 'story_anchor', sortKey: 200, aliases: ['End'] },
    ],
    windows: [],
}, null, 2));
await writeFile(path.join(deckDir, 'tags.json'), JSON.stringify({
    schemaVersion: 1,
    tags: { 'fandom:roundtrip-canon': { label: 'Roundtrip Canon', description: 'Fixture tag.' } },
}, null, 2));
await mkdir(path.join(deckDir, 'rules'), { recursive: true });
await writeFile(path.join(deckDir, 'rules', 'world_rules.json'), JSON.stringify({
    schemaVersion: 3,
    entries: [buildEntry('rt.rule.one'), buildEntry('rt.rule.two')],
}, null, 2));
const manifestPath = path.join(deckDir, 'loredeck.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.description = 'Roundtrip fixture deck.';
manifest.continuity.continuityId = 'roundtrip-canon';
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

// Unhealthy draft is refused and removed from dist.
await writeFile(path.join(deckDir, 'rules', 'broken.json'), JSON.stringify({
    schemaVersion: 3,
    entries: [buildEntry('rt.rule.one')],
}, null, 2));
const refused = cli('promote', 'roundtrip-canon', '--json');
assert.equal(refused.code, 1, 'Promote must fail on a deck with duplicate entry ids.');
assert.equal(JSON.parse(refused.stdout).results[0].promoted, false);
assert.ok(!(await readFile(path.join(projectDir, 'dist', 'roundtrip-canon', 'loredeck.json')).catch(() => null)), 'Failed deck must not remain in dist/.');

await rm(path.join(deckDir, 'rules', 'broken.json'));
const promoted = cli('promote', 'roundtrip-canon', '--json');
assert.equal(promoted.code, 0, promoted.stdout || promoted.stderr);
assert.equal(JSON.parse(promoted.stdout).results[0].health.status, 'good');

// Package and verify.
const packed = cli('package', 'roundtrip-canon', '--author', 'Fixture', '--json');
assert.equal(packed.code, 0, packed.stderr);
const outPath = JSON.parse(packed.stdout).outPath;
assert.ok(outPath.endsWith('.saga-loredeck.zip'));
const verified = cli('verify-package', outPath, '--json');
assert.equal(verified.code, 0, verified.stdout);
const verifyReport = JSON.parse(verified.stdout);
assert.equal(verifyReport.deckCount, 1);
assert.equal(verifyReport.decks[0].status, 'good');

// The archive parses with the extension's parser and resolves every ref.
const parsed = await parseLoredeckZipPackage(await readFile(outPath));
assert.equal(parsed.failures.length, 0);
assert.equal(parsed.decks.length, 1);
assert.equal(parsed.decks[0].originalPackId, 'roundtrip-canon');
assert.equal(parsed.decks[0].missingFiles.length, 0);
assert.equal(parsed.packageMeta.packageType, 'saga_loredeck_package');
assert.equal(parsed.decks[0].manifest.stats.entryCount, 2);

// verify-package flags a corrupted package.
const corruptDir = path.join(projectDir, 'dist', 'roundtrip-canon');
await rm(path.join(corruptDir, 'rules', 'world_rules.json'));
const repacked = cli('package', 'roundtrip-canon', '--pkg-version', '0.1.1', '--json');
assert.equal(repacked.code, 0, repacked.stderr);
const corruptOut = JSON.parse(repacked.stdout).outPath;
const corruptVerify = cli('verify-package', corruptOut, '--json');
assert.equal(corruptVerify.code, 1, 'verify-package must fail when entry files are missing from the archive.');
assert.ok(JSON.parse(corruptVerify.stdout).problems.some(problem => problem.includes('missing entry file')), corruptVerify.stdout);

// package --deck packages only the requested deck; the flag-omitted default still bundles every promoted deck.
const familyProjectDir = path.join(workshopRoot, 'roundtrip-family');
assert.equal(cli('init', 'roundtrip-family', '--title', 'Roundtrip Family', '--size', 'family', '--decks', 'rf-core:core,rf-module:era').code, 0);
for (const deckId of ['rf-core', 'rf-module']) {
    const familyDeckDir = path.join(familyProjectDir, 'drafts', deckId);
    await writeFile(path.join(familyDeckDir, 'timeline.json'), JSON.stringify({
        schemaVersion: 1,
        timelineMode: 'story_anchor',
        defaultContextType: 'story_anchor',
        anchors: [
            // Anchor ids match buildEntry()'s hardcoded rt.start/rt.end context refs.
            { id: 'rt.start', label: 'Start', contextType: 'story_anchor', sortKey: 100, aliases: ['Start'] },
            { id: 'rt.end', label: 'End', contextType: 'story_anchor', sortKey: 200, aliases: ['End'] },
        ],
        windows: [],
    }, null, 2));
    await writeFile(path.join(familyDeckDir, 'tags.json'), JSON.stringify({
        schemaVersion: 1,
        tags: { [`fandom:${deckId}`]: { label: deckId, description: 'Fixture tag.' } },
    }, null, 2));
    await mkdir(path.join(familyDeckDir, 'rules'), { recursive: true });
    const familyEntry = buildEntry(`${deckId}.rule.one`);
    familyEntry.tags = [`fandom:${deckId}`];
    await writeFile(path.join(familyDeckDir, 'rules', 'world_rules.json'), JSON.stringify({
        schemaVersion: 3,
        entries: [familyEntry],
    }, null, 2));
    const familyManifestPath = path.join(familyDeckDir, 'loredeck.json');
    const familyManifest = JSON.parse(await readFile(familyManifestPath, 'utf8'));
    familyManifest.description = `${deckId} fixture deck.`;
    familyManifest.continuity.continuityId = deckId;
    await writeFile(familyManifestPath, JSON.stringify(familyManifest, null, 2));
}
const familyPromoted = cli('promote', 'roundtrip-family', '--json');
assert.equal(familyPromoted.code, 0, familyPromoted.stdout || familyPromoted.stderr);

const singleDeckPackage = cli('package', 'roundtrip-family', '--deck', 'rf-core', '--author', 'Fixture', '--json');
assert.equal(singleDeckPackage.code, 0, singleDeckPackage.stderr);
const singleDeckOutPath = JSON.parse(singleDeckPackage.stdout).outPath;
assert.ok(singleDeckOutPath.includes('rf-core'), 'Per-deck package filename should include the deck id.');
const singleDeckParsed = await parseLoredeckZipPackage(await readFile(singleDeckOutPath));
assert.equal(singleDeckParsed.decks.length, 1, '--deck must package only the requested deck.');
assert.equal(singleDeckParsed.decks[0].originalPackId, 'rf-core');

const badDeckPackage = cli('package', 'roundtrip-family', '--deck', 'nope');
assert.equal(badDeckPackage.code, 1, 'Unknown --deck must fail.');

const fullFamilyPackage = cli('package', 'roundtrip-family', '--author', 'Fixture', '--json');
assert.equal(fullFamilyPackage.code, 0, fullFamilyPackage.stderr);
const fullFamilyOutPath = JSON.parse(fullFamilyPackage.stdout).outPath;
assert.ok(!fullFamilyOutPath.includes('rf-core') && !fullFamilyOutPath.includes('rf-module'), 'Default (no --deck) filename must be unchanged.');
const fullFamilyParsed = await parseLoredeckZipPackage(await readFile(fullFamilyOutPath));
assert.equal(fullFamilyParsed.decks.length, 2, 'Default (no --deck) package must still bundle every promoted deck.');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck CLI package roundtrip tests passed.');
