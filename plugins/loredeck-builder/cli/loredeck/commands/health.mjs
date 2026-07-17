/**
 * health.mjs -- Saga loredeck CLI
 * Runs full Pack Health on a deck folder through the same shared modules the
 * extension uses. Accepts either a deck directory or a workshop project id.
 *
 * Exit codes: 0 = clean for the requested bar, 1 = errors,
 * 2 = warnings/suggestions present under --strict.
 */

import path from 'node:path';

import { pathExists, readJsonFileOrNull, resolveProjectDir, writeJsonFile, writeTextFile } from '../lib/deck-fs.mjs';
import { loadLoredeckSourceFromDir } from '../lib/node-loredeck-io.mjs';
import { loadProjectState } from '../lib/project-state.mjs';

export function healthMarkdown(deckLabel, health) {
    const lines = [
        `# Pack Health: ${deckLabel}`,
        '',
        `- Status: **${health.status}**`,
        `- Errors: ${health.errors.length}`,
        `- Warnings: ${health.warnings.length}`,
        `- Suggestions: ${health.suggestions.length}`,
        `- Entries: ${health.summary?.entryCount ?? 0} across ${health.summary?.fileCount ?? 0} files`,
        '',
    ];
    for (const [severity, issues] of [['Errors', health.errors], ['Warnings', health.warnings], ['Suggestions', health.suggestions]]) {
        lines.push(`## ${severity}`, '');
        if (!issues.length) {
            lines.push('_None._', '');
            continue;
        }
        for (const issue of issues) {
            const where = issue.file || issue.entryId || issue.tag || '';
            lines.push(`- \`${issue.code}\`${where ? ` (${where})` : ''}: ${issue.message}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

export function evaluateHealthExit(health, strict) {
    if (health.errors.length) return 1;
    if (strict && (health.warnings.length || health.suggestions.length)) return 2;
    return 0;
}

export async function runHealthOnDeckDir(deckDir, { strict = false, outDir = '', label = '', externalTagRegistries = [] } = {}) {
    const source = await loadLoredeckSourceFromDir(deckDir, { externalTagRegistries });
    const deckLabel = label || source.manifest?.id || path.basename(deckDir);
    if (outDir) {
        await writeJsonFile(path.join(outDir, `health-${deckLabel}.json`), source.health);
        await writeTextFile(path.join(outDir, `health-${deckLabel}.md`), healthMarkdown(deckLabel, source.health));
    }
    return { deckLabel, health: source.health, exitCode: evaluateHealthExit(source.health, strict) };
}

async function resolveTargets({ positionals, flags }) {
    const [target] = positionals;
    if (!target) throw new Error('Usage: health <deck-dir|project-id> [--deck <deck-id>] [--dist] [--strict] [--out <dir>]');
    const asDir = path.resolve(target);
    if (await pathExists(path.join(asDir, 'loredeck.json'))) {
        return { targets: [{ deckDir: asDir, label: '' }], outDir: String(flags.out || '') };
    }
    const state = await loadProjectState(target);
    const projectDir = resolveProjectDir(target);
    const stageDir = flags.dist ? 'dist' : 'drafts';
    const decks = (state.decks || []).filter(deck => !flags.deck || deck.deckId === flags.deck);
    if (!decks.length) throw new Error(`No decks matched --deck ${flags.deck} in project ${target}.`);
    const targets = [];
    for (const deck of decks) {
        const deckDir = path.join(projectDir, stageDir, deck.deckId);
        targets.push({
            deckDir,
            label: deck.deckId,
            externalTagRegistries: await resolveExternalTagRegistries({ state, deck, projectDir, stageDir }),
        });
    }
    return {
        targets,
        outDir: String(flags.out || path.join(projectDir, 'reviews')),
    };
}

async function resolveExternalTagRegistries({ state, deck, projectDir, stageDir }) {
    const manifest = await readJsonFileOrNull(path.join(projectDir, stageDir, deck.deckId, 'loredeck.json'));
    const coreDeckId = String(
        manifest?.family?.recommendedCoreDeckId
        || (deck.role !== 'core' ? (state.decks || []).find(sibling => sibling.role === 'core' && sibling.deckId !== deck.deckId)?.deckId : '')
        || '',
    );
    if (!coreDeckId || coreDeckId === deck.deckId) return [];
    const coreTags = await readJsonFileOrNull(path.join(projectDir, stageDir, coreDeckId, 'tags.json'));
    return coreTags ? [coreTags] : [];
}

export async function runHealth({ positionals, flags }) {
    const { targets, outDir } = await resolveTargets({ positionals, flags });
    const strict = flags.strict === true;
    const results = [];
    for (const target of targets) {
        results.push(await runHealthOnDeckDir(target.deckDir, { strict, outDir, label: target.label, externalTagRegistries: target.externalTagRegistries || [] }));
    }
    const exitCode = Math.max(0, ...results.map(result => result.exitCode));
    if (flags.json) {
        console.log(JSON.stringify({
            ok: exitCode === 0,
            strict,
            decks: results.map(result => ({
                deck: result.deckLabel,
                status: result.health.status,
                errors: result.health.errors.length,
                warnings: result.health.warnings.length,
                suggestions: result.health.suggestions.length,
            })),
        }, null, 2));
    } else {
        for (const result of results) {
            console.log(`${result.deckLabel}: ${result.health.status} (${result.health.errors.length} errors, ${result.health.warnings.length} warnings, ${result.health.suggestions.length} suggestions)`);
            for (const issue of [...result.health.errors, ...result.health.warnings, ...result.health.suggestions].slice(0, 20)) {
                console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
            }
        }
        if (outDir) console.log(`Reports written to ${outDir}`);
    }
    return exitCode;
}
