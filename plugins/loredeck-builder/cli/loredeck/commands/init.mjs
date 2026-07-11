/**
 * init.mjs -- Saga loredeck CLI
 * Scaffolds a workshop project: directory layout, project.json, and a
 * skeleton Custom deck folder per planned deck.
 */

import path from 'node:path';

import { ensureDir, pathExists, resolveProjectDir, writeJsonFile, writeTextFile } from '../lib/deck-fs.mjs';
import { createProjectState, saveProjectState } from '../lib/project-state.mjs';

function parseDeckSpecs(raw, projectId, canonSize) {
    const specs = String(raw || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .map((item) => {
            const [deckId, role] = item.split(':').map(part => part.trim());
            return { deckId, role: role || 'era' };
        });
    if (specs.length) return specs;
    return [{ deckId: projectId, role: canonSize === 'single' ? 'standalone' : 'core' }];
}

function buildSkeletonManifest(state, deck) {
    const isFamily = state.canonSize === 'family';
    const coreDeckId = (state.decks.find(item => item.role === 'core') || state.decks[0]).deckId;
    return {
        schemaVersion: 1,
        entrySchemaVersion: 3,
        id: deck.deckId,
        type: 'custom',
        title: deck.deckId === state.projectId ? state.title : `${state.title}: ${deck.deckId}`,
        description: '',
        fandom: state.title,
        era: '',
        contentKind: 'fandom',
        author: '',
        version: '0.1.0',
        ...(isFamily
            ? {
                deckFamilyId: state.projectId,
                family: {
                    id: state.projectId,
                    title: state.title,
                    role: deck.role === 'core' ? 'core' : 'era',
                    recommendedCoreDeckId: deck.role === 'core' ? '' : coreDeckId,
                },
            }
            : {}),
        library: {
            suggestedPath: isFamily
                ? [state.title, deck.role === 'core' ? 'Core' : deck.deckId]
                : [state.title],
        },
        continuity: {
            continuityId: state.continuity?.continuityId || '',
            canonTier: state.continuity?.canonTier || 'primary',
            adaptation: state.continuity?.adaptation || '',
            sourceBoundary: '',
        },
        runtimeDefaults: { scanDepth: null, recursiveTriggers: false, tokenBudget: null },
        registries: { tags: 'tags.json', timeline: 'timeline.json' },
        tags: isFamily ? ['quality:draft-reference', 'structure:split-loredeck'] : ['quality:draft-reference'],
        files: [],
        compatibility: { sagaSchemaMin: 3, sagaSchemaMax: 3 },
        stats: { entryCount: 0, categoryCounts: {} },
    };
}

export async function scaffoldDeckFiles(state, deck, projectDir) {
    const deckDir = path.join(projectDir, 'drafts', deck.deckId);
    await ensureDir(path.join(deckDir, 'entries'));
    await writeJsonFile(path.join(deckDir, 'loredeck.json'), buildSkeletonManifest(state, deck));
    await writeJsonFile(path.join(deckDir, 'tags.json'), { schemaVersion: 1, tags: {} });
    await writeJsonFile(path.join(deckDir, 'timeline.json'), {
        schemaVersion: 1,
        timelineMode: 'story_anchor',
        defaultContextType: 'story_anchor',
        anchors: [],
        windows: [],
    });
    return deckDir;
}

const STARTER_BRIEF = `# Scope Brief

## Fandom and source range

(What canon is covered, which sources, where coverage starts and stops.)

## Continuity and canon tier

(Which continuity, adaptation, and canon tier. What is explicitly out of bounds.)

## Deck split

(Single deck or family; which decks and why.)

## Story-coordinate model

(Dates, books, seasons, arcs, routes -- what Context is measured in.)

## Spoiler philosophy

(What must stay gated, and until when.)

## Assumptions and risks

(Anything uncertain, contested, or deferred.)
`;

export async function runInit({ positionals, flags }) {
    const [projectId] = positionals;
    if (!projectId) throw new Error('Usage: init <project-id> --title <title> [--size single|family] [--decks id:role,...]');
    const projectDir = resolveProjectDir(projectId);
    if (await pathExists(path.join(projectDir, 'project.json'))) {
        throw new Error(`Workshop project already exists: ${projectDir}. Use status/resume instead of init.`);
    }
    const canonSize = String(flags.size || 'single');
    const decks = parseDeckSpecs(flags.decks, projectId, canonSize);
    const state = createProjectState({
        projectId,
        title: String(flags.title || projectId),
        canonSize,
        continuity: {
            continuityId: String(flags['continuity-id'] || ''),
            canonTier: String(flags['canon-tier'] || 'primary'),
            adaptation: String(flags.adaptation || ''),
        },
        decks,
    });

    for (const dir of ['brief', 'evidence', 'plans/title-batches', 'reviews', 'dist']) {
        await ensureDir(path.join(projectDir, dir));
    }
    await writeTextFile(path.join(projectDir, 'brief', 'scope-brief.md'), STARTER_BRIEF);
    for (const deck of state.decks) {
        await scaffoldDeckFiles(state, deck, projectDir);
    }
    await saveProjectState(state);

    if (flags.json) {
        console.log(JSON.stringify({ ok: true, projectDir, state }, null, 2));
    } else {
        console.log(`Workshop project created: ${projectDir}`);
        console.log(`Decks: ${state.decks.map(deck => `${deck.deckId} (${deck.role})`).join(', ')}`);
        console.log('Next: write brief/scope-brief.md, then approve the intake gate.');
    }
    return 0;
}
