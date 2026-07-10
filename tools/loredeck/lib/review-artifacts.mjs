/**
 * review-artifacts.mjs -- Saga loredeck CLI
 * Markdown review artifact builders for the staged gates: scope brief,
 * context/timeline plan, title batches, card batches, and the final package
 * report. Artifacts are regenerated from current files on every run and are
 * never hand-edited.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { pathExists, readJsonFileOrNull, listJsonFilesRecursive, toPosixRelative } from './deck-fs.mjs';

const REQUIRED_BRIEF_SECTIONS = [
    'Fandom and source range',
    'Continuity and canon tier',
    'Deck split',
    'Story-coordinate model',
    'Spoiler philosophy',
    'Assumptions and risks',
];

function mdEscape(value) {
    return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function mdTable(headers, rows) {
    if (!rows.length) return '_None._\n';
    const lines = [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map(row => `| ${row.map(mdEscape).join(' | ')} |`),
    ];
    return `${lines.join('\n')}\n`;
}

function isBriefPlaceholderLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^\*[^*]+\*$/.test(trimmed)) return true; // stand-alone italic description paragraph
    if (/^-\s*(?:[^:*]+:\s*)?\*[^*]+\*\.?$/.test(trimmed)) return true; // bullet whose value is still fully italicized
    if (/^-\s*[^:*]+:\s*$/.test(trimmed)) return true; // bare "- Label:" scaffolding with no value filled in yet
    return false;
}

function briefSectionBodies(briefText) {
    const bodies = new Map();
    const headingRe = /^##\s+(.+?)\s*$/gm;
    const matches = [...String(briefText || '').matchAll(headingRe)];
    for (let index = 0; index < matches.length; index += 1) {
        const name = matches[index][1].trim();
        const start = matches[index].index + matches[index][0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index : briefText.length;
        bodies.set(name, briefText.slice(start, end).trim());
    }
    return bodies;
}

function validateBriefSections(briefText) {
    const bodies = briefSectionBodies(briefText);
    const issues = [];
    for (const section of REQUIRED_BRIEF_SECTIONS) {
        const body = bodies.get(section);
        if (body === undefined) {
            issues.push(`Missing section: "${section}".`);
            continue;
        }
        const hasContent = body.split('\n').some(line => !isBriefPlaceholderLine(line));
        if (!hasContent) {
            issues.push(`Section "${section}" still looks like template placeholder text — fill it in.`);
        }
    }
    return issues;
}

function describeContext(context) {
    if (!context || typeof context !== 'object') return '(none)';
    const from = context.validFromAnchor || context.sortKeyFrom || '';
    const to = context.validToAnchor || context.sortKeyTo || '';
    const scope = context.scope || '';
    if (!from && !to) return scope || '(none)';
    return `${scope ? `${scope}: ` : ''}${from || '?'} -> ${to || '?'}`;
}

async function readDeckEntries(deckDir) {
    const manifest = await readJsonFileOrNull(path.join(deckDir, 'loredeck.json'))
        || await readJsonFileOrNull(path.join(deckDir, 'manifest.json'));
    const files = Array.isArray(manifest?.files) ? manifest.files : [];
    const entries = [];
    for (const file of files) {
        const json = await readJsonFileOrNull(path.join(deckDir, file));
        for (const entry of Array.isArray(json?.entries) ? json.entries : []) {
            entries.push({ file, entry });
        }
    }
    return { manifest, entries };
}

export function buildBriefArtifact(state, briefText) {
    const issues = validateBriefSections(briefText);
    const lines = [
        `# Scope Brief Review: ${state.title}`,
        '',
        `- Project: \`${state.projectId}\``,
        `- Canon size: ${state.canonSize}`,
        `- Continuity: ${state.continuity?.continuityId || '(unset)'} / tier ${state.continuity?.canonTier || '(unset)'} / adaptation ${state.continuity?.adaptation || '(unset)'}`,
        `- Decks: ${(state.decks || []).map(deck => `\`${deck.deckId}\` (${deck.role})`).join(', ')}`,
        '',
    ];
    if (issues.length) {
        lines.push('## Completeness check', '');
        for (const issue of issues) lines.push(`- ${issue}`);
        lines.push('');
    }
    lines.push(
        '---',
        '',
        briefText ? briefText.trim() : '_No scope brief written yet (expected at brief/scope-brief.md)._',
        '',
    );
    return { markdown: lines.join('\n'), issues };
}

export async function buildPlanArtifact(state, projectDir) {
    const lines = [`# Context & Timeline Plan Review: ${state.title}`, ''];
    const planPath = path.join(projectDir, 'plans', 'context-timeline-plan.md');
    let planText = '';
    try {
        planText = await readFile(planPath, 'utf8');
    } catch (_) {
        planText = '';
    }
    if (planText.trim()) {
        lines.push('## Rationale', '', planText.trim(), '', '---', '');
    } else {
        lines.push('_No prose plan written yet (expected at plans/context-timeline-plan.md)._', '');
    }
    for (const deck of state.decks || []) {
        const deckDir = path.join(projectDir, 'drafts', deck.deckId);
        const timeline = await readJsonFileOrNull(path.join(deckDir, 'timeline.json'));
        const tags = await readJsonFileOrNull(path.join(deckDir, 'tags.json'));
        lines.push(`## Deck \`${deck.deckId}\``, '');
        lines.push('### Timeline anchors', '');
        const anchors = Array.isArray(timeline?.anchors) ? timeline.anchors : [];
        lines.push(mdTable(
            ['Anchor id', 'Label', 'Sort key', 'Context type', 'Arc / era'],
            anchors.map(anchor => [anchor.id, anchor.label, anchor.sortKey, anchor.contextType, anchor.arc || anchor.era || '']),
        ));
        const windows = Array.isArray(timeline?.windows) ? timeline.windows : [];
        if (windows.length) {
            lines.push('### Timeline windows', '');
            lines.push(mdTable(
                ['Window id', 'Label', 'From', 'To'],
                windows.map(window => [window.id, window.label, window.fromAnchor || window.sortKeyFrom, window.toAnchor || window.sortKeyTo]),
            ));
        }
        lines.push('### Tags', '');
        const tagEntries = tags?.tags && typeof tags.tags === 'object' && !Array.isArray(tags.tags)
            ? Object.entries(tags.tags)
            : [];
        lines.push(mdTable(
            ['Tag id', 'Label', 'Description'],
            tagEntries.map(([id, def]) => [id, def?.label, def?.description]),
        ));
    }
    return lines.join('\n');
}

export async function buildTitlesArtifact(state, projectDir) {
    const lines = [`# Title Batches Review: ${state.title}`, ''];
    for (const deck of state.decks || []) {
        const batchDir = path.join(projectDir, 'plans', 'title-batches', deck.deckId);
        const batchFiles = await listJsonFilesRecursive(batchDir);
        if (!batchFiles.length) continue;
        lines.push(`## Deck \`${deck.deckId}\``, '');
        for (const batchFile of batchFiles) {
            const batch = await readJsonFileOrNull(batchFile);
            const titles = Array.isArray(batch?.titles) ? batch.titles : [];
            const status = (state.batches?.[deck.deckId]?.titles || []).find(item => item.id === batch?.batchId)?.status || 'draft';
            lines.push(`### Batch \`${batch?.batchId || toPosixRelative(projectDir, batchFile)}\` (${titles.length} titles, status: ${status})`, '');
            lines.push(mdTable(
                ['Card id', 'Title', 'Category', 'Gate intent', 'Evidence refs'],
                titles.map(title => [title.id, title.title, title.category, title.gateIntent, (title.evidenceRefs || []).join(', ')]),
            ));
        }
    }
    if (lines.length === 2) lines.push('_No title batches found under plans/title-batches/._', '');
    return lines.join('\n');
}

export async function buildCardsArtifact(state, projectDir, acceptedEvidenceKeys) {
    const lines = [`# Card Batches Review: ${state.title}`, ''];
    const seenIds = new Map();
    const duplicates = [];
    const unbacked = [];
    for (const deck of state.decks || []) {
        const deckDir = path.join(projectDir, 'drafts', deck.deckId);
        const { entries } = await readDeckEntries(deckDir);
        if (!entries.length) continue;
        lines.push(`## Deck \`${deck.deckId}\` (${entries.length} cards)`, '');
        lines.push(mdTable(
            ['Card id', 'Title', 'Category', 'Context', 'Tags', 'Evidence refs'],
            entries.map(({ entry }) => [
                entry.id,
                entry.title,
                entry.category,
                describeContext(entry.context),
                (entry.tags || []).join(', '),
                (entry.sourceInfo?.evidenceRefs || []).join(', '),
            ]),
        ));
        for (const { file, entry } of entries) {
            const id = String(entry?.id || '');
            const location = `${deck.deckId}/${file}`;
            if (seenIds.has(id)) {
                duplicates.push({ id, first: seenIds.get(id), second: location });
            } else {
                seenIds.set(id, location);
            }
            const refs = Array.isArray(entry?.sourceInfo?.evidenceRefs) ? entry.sourceInfo.evidenceRefs : [];
            const missing = refs.filter(ref => !acceptedEvidenceKeys.has(ref));
            if (!refs.length || missing.length) {
                unbacked.push({ id, location, reason: !refs.length ? 'no evidence refs' : `unaccepted refs: ${missing.join(', ')}` });
            }
        }
    }
    lines.push('## Duplicate card ids', '');
    lines.push(mdTable(['Card id', 'First seen', 'Duplicate'], duplicates.map(dup => [dup.id, dup.first, dup.second])));
    lines.push('## Cards without accepted evidence backing', '');
    lines.push(mdTable(['Card id', 'Location', 'Problem'], unbacked.map(item => [item.id, item.location, item.reason])));
    return { markdown: lines.join('\n'), duplicates, unbacked };
}

export function buildEvidenceArtifact(state, collected) {
    const lines = [`# Evidence Review: ${state.title}`, ''];
    lines.push('## Files', '');
    lines.push(mdTable(
        ['File', 'Scope', 'Valid', 'Records'],
        collected.files.map(file => [file.file, file.scope, file.ok ? 'yes' : 'NO', file.recordCount]),
    ));
    if (collected.issues.length) {
        lines.push('## Validation issues', '');
        for (const issue of collected.issues) lines.push(`- ${issue}`);
        lines.push('');
    }
    lines.push('## Records', '');
    lines.push(mdTable(
        ['Record', 'Title', 'Status', 'Facts', 'Key entities', 'Authoring signals'],
        collected.records.map(record => [
            record.key,
            record.title,
            record.status,
            record.factCount,
            record.keyEntities.join(', '),
            record.authoringSignals.join(', '),
        ]),
    ));
    return lines.join('\n');
}

export async function buildFinalArtifact(state, projectDir) {
    const lines = [`# Final Package Review: ${state.title}`, ''];
    lines.push(mdTable(
        ['Gate', 'Approved at', 'Note'],
        (state.gates || []).map(gate => [gate.gate, gate.approvedAt, gate.note]),
    ));
    for (const deck of state.decks || []) {
        const distDir = path.join(projectDir, 'dist', deck.deckId);
        const promoted = await pathExists(path.join(distDir, 'loredeck.json'));
        lines.push(`## Deck \`${deck.deckId}\``, '');
        if (!promoted) {
            lines.push('_Not promoted to dist/ yet._', '');
            continue;
        }
        const { manifest, entries } = await readDeckEntries(distDir);
        const categoryCounts = {};
        for (const { entry } of entries) {
            const category = String(entry?.category || 'other');
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
        lines.push(`- Entries: ${entries.length}`);
        lines.push(`- Manifest version: ${manifest?.version || '(unset)'}`);
        lines.push(`- Categories: ${Object.entries(categoryCounts).map(([key, value]) => `${key}: ${value}`).join(', ') || '(none)'}`);
        const healthReport = await readJsonFileOrNull(path.join(projectDir, 'reviews', `health-${deck.deckId}.json`));
        if (healthReport) {
            lines.push(`- Last health run: status ${healthReport.status}, ${healthReport.errors?.length || 0} errors, ${healthReport.warnings?.length || 0} warnings, ${healthReport.suggestions?.length || 0} suggestions`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
