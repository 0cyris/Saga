/**
 * conformance.mjs -- Saga loredeck CLI
 * Structural conformance checks for a deck folder, beyond Pack Health:
 * required manifest fields, stats recount match, registry/asset file
 * presence, manifest.json duplicate sync, and family block coherence.
 * Generalizes the checks in test-hp-reference-deck-conformance.mjs to any
 * deck directory.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { pathExists, readJsonFile } from '../lib/deck-fs.mjs';
import { collectEntryFilePaths, computeDeckStats } from '../lib/manifest-stats.mjs';

const DECK_TYPES = ['bundled', 'generated', 'custom'];
const FAMILY_ROLES = ['core', 'era'];

export async function checkDeckConformance(deckDir) {
    const errors = [];
    const warnings = [];
    const manifestPath = path.join(deckDir, 'loredeck.json');
    if (!(await pathExists(manifestPath))) {
        return { errors: [`No loredeck.json found in ${deckDir}.`], warnings };
    }
    let manifest = null;
    try {
        manifest = await readJsonFile(manifestPath);
    } catch (e) {
        return { errors: [`loredeck.json failed to parse: ${e?.message || ''}`.trim()], warnings };
    }

    if (manifest.schemaVersion !== 1) errors.push(`schemaVersion must be 1 (found ${JSON.stringify(manifest.schemaVersion)}).`);
    if (manifest.entrySchemaVersion !== 3) errors.push(`entrySchemaVersion must be 3 (found ${JSON.stringify(manifest.entrySchemaVersion)}).`);
    if (!String(manifest.id || '').trim()) errors.push('Manifest is missing id.');
    if (String(manifest.id || '') !== path.basename(deckDir)) {
        warnings.push(`Manifest id ${JSON.stringify(manifest.id)} does not match folder name ${JSON.stringify(path.basename(deckDir))}.`);
    }
    if (!DECK_TYPES.includes(manifest.type)) errors.push(`type must be one of ${DECK_TYPES.join(', ')} (found ${JSON.stringify(manifest.type)}).`);
    if (!String(manifest.title || '').trim()) errors.push('Manifest is missing title.');
    if (!String(manifest.version || '').trim()) warnings.push('Manifest has no version.');
    if (!Array.isArray(manifest.files) || !manifest.files.length) errors.push('Manifest files[] is empty.');
    const compatibility = manifest.compatibility || {};
    if (compatibility.sagaSchemaMin !== 3 || compatibility.sagaSchemaMax !== 3) {
        warnings.push('compatibility.sagaSchemaMin/Max should both be 3 for schema v3 decks.');
    }
    if (!manifest.continuity || !String(manifest.continuity.continuityId || '').trim()) {
        warnings.push('continuity.continuityId is unset; declare the continuity boundary.');
    }

    for (const file of Array.isArray(manifest.files) ? manifest.files : []) {
        if (!(await pathExists(path.join(deckDir, file)))) errors.push(`Manifest lists a missing entry file: ${file}.`);
    }
    const onDisk = await collectEntryFilePaths(deckDir);
    const listed = new Set(Array.isArray(manifest.files) ? manifest.files : []);
    for (const file of onDisk) {
        if (!listed.has(file)) warnings.push(`Entry file on disk is not listed in manifest files[]: ${file}.`);
    }

    for (const [key, ref] of Object.entries(manifest.registries || {})) {
        if (typeof ref === 'string' && ref && !(await pathExists(path.join(deckDir, ref)))) {
            errors.push(`Registry ${key} points to a missing file: ${ref}.`);
        }
    }
    for (const [key, asset] of Object.entries(manifest.assets || {})) {
        const assetPath = String(asset?.path || '');
        if (assetPath && !(await pathExists(path.join(deckDir, assetPath)))) {
            errors.push(`Asset ${key} points to a missing file: ${assetPath}.`);
        }
    }

    const sortedCounts = (counts) => JSON.stringify(Object.fromEntries(Object.entries(counts || {}).sort()));
    const computed = await computeDeckStats(deckDir, manifest);
    const declared = manifest.stats || {};
    if (Number(declared.entryCount) !== computed.entryCount) {
        errors.push(`stats.entryCount is ${declared.entryCount}, recount is ${computed.entryCount}.`);
    }
    if (sortedCounts(declared.categoryCounts) !== sortedCounts(computed.categoryCounts)) {
        errors.push('stats.categoryCounts do not match the recount.');
    }

    const duplicatePath = path.join(deckDir, 'manifest.json');
    if (await pathExists(duplicatePath)) {
        const [a, b] = await Promise.all([readFile(manifestPath, 'utf8'), readFile(duplicatePath, 'utf8')]);
        if (a !== b) errors.push('manifest.json duplicate has diverged from loredeck.json.');
    }

    if (manifest.family) {
        if (!FAMILY_ROLES.includes(manifest.family.role)) {
            errors.push(`family.role must be one of ${FAMILY_ROLES.join(', ')} (found ${JSON.stringify(manifest.family.role)}).`);
        }
        if (manifest.family.role === 'era' && !String(manifest.family.recommendedCoreDeckId || '').trim()) {
            warnings.push('family.role is era but recommendedCoreDeckId is unset.');
        }
        if (!String(manifest.deckFamilyId || '').trim()) {
            warnings.push('family block present but deckFamilyId is unset.');
        }
    }

    return { errors, warnings, manifest };
}

export async function runConformance({ positionals, flags }) {
    const [target] = positionals;
    if (!target) throw new Error('Usage: conformance <deck-dir>');
    const deckDir = path.resolve(target);
    const { errors, warnings } = await checkDeckConformance(deckDir);
    if (flags.json) {
        console.log(JSON.stringify({ ok: !errors.length, errors, warnings }, null, 2));
    } else {
        console.log(`Conformance for ${deckDir}: ${errors.length} errors, ${warnings.length} warnings.`);
        for (const issue of errors) console.log(`  [error] ${issue}`);
        for (const issue of warnings) console.log(`  [warning] ${issue}`);
    }
    return errors.length ? 1 : 0;
}
