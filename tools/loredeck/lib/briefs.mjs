/**
 * briefs.mjs -- Saga loredeck CLI
 * Renders self-contained subagent prompts ("briefs") from the role templates
 * in the loredeck-builder skill's agents/ folder, filled in from project
 * state. Every role gets the shared return contract (agents/_return-contract.md)
 * appended. Rendering is deterministic: no timestamps, sorted listings, and
 * any unresolved {{placeholder}} is an error.
 *
 * Adding a role: write agents/<role>.md and add an entry to BRIEF_ROLES with
 * the selector flags it requires/accepts and a buildContext function.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    isValidSlug,
    listJsonFilesRecursive,
    pathExists,
    readJsonFile,
    resolveProjectDir,
    toPosixRelative,
} from './deck-fs.mjs';
import { collectEvidence, EVIDENCE_AUTHORING_SIGNALS } from './evidence-store.mjs';
import { parseFactPointer } from './grounding.mjs';
import { loadProjectState } from './project-state.mjs';
import { validateBriefSections } from './review-artifacts.mjs';

const LIB_DIR = fileURLToPath(new URL('.', import.meta.url));
const RETURN_CONTRACT_TEMPLATE = '_return-contract.md';
const SELECTOR_FLAGS = ['scope', 'batch', 'file', 'assignment'];
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Locates the loredeck-builder skill folder holding agents/ and templates/.
 * Covers the three layouts the CLI ships in: the repo checkout
 * (tools/loredeck next to .claude/skills/), the synced plugin bundle
 * (cli/loredeck next to skills/), and the standalone .skill bundle
 * (cli/loredeck inside the skill folder itself).
 */
export async function resolveSkillDir() {
    const candidates = [
        path.resolve(LIB_DIR, '..', '..', '..', '.claude', 'skills', 'loredeck-builder'),
        path.resolve(LIB_DIR, '..', '..', '..', 'skills', 'loredeck-builder'),
        path.resolve(LIB_DIR, '..', '..', '..'),
    ];
    for (const dir of candidates) {
        if (await pathExists(path.join(dir, 'agents', RETURN_CONTRACT_TEMPLATE))) return dir;
    }
    throw new Error(`Could not find the loredeck-builder skill's agents/ templates (looked in: ${candidates.join(', ')}).`);
}

/** Drops a leading maintainer comment (<!-- ... -->) so it never reaches a subagent. */
function stripTemplateHeader(text) {
    return text.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
}

/**
 * Single-pass {{name}} substitution. Substituted values are never re-scanned,
 * so project content containing braces is inserted literally. Throws when the
 * template names a placeholder the context does not provide.
 */
export function renderTemplate(template, context, { label = 'template' } = {}) {
    const missing = new Set();
    for (const match of template.matchAll(PLACEHOLDER_RE)) {
        if (!Object.hasOwn(context, match[1]) || context[match[1]] === undefined || context[match[1]] === null) {
            missing.add(match[1]);
        }
    }
    if (missing.size) {
        throw new Error(`Unresolved placeholder(s) in ${label}: ${[...missing].sort().join(', ')}.`);
    }
    return template.replace(PLACEHOLDER_RE, (_, name) => String(context[name]));
}

function bulletList(items, { code = false } = {}) {
    return items.map(item => `- ${code ? `\`${item}\`` : item}`).join('\n');
}

async function readProjectText(projectDir, relPath, missingMessage) {
    const fullPath = path.join(projectDir, ...relPath.split('/'));
    let text = '';
    try {
        text = await readFile(fullPath, 'utf8');
    } catch (_) {
        throw new Error(missingMessage);
    }
    if (!text.trim()) throw new Error(missingMessage);
    return text.trim();
}

/* ---- Role: research ---- */
async function buildResearchContext({ state, deck, projectDir, skillDir, selectors }) {
    const scope = selectors.scope;
    const fileStem = selectors.file ? selectors.file.replace(/\.json$/, '') : scope;
    if (!isValidSlug(fileStem)) {
        throw new Error(`Invalid --file ${JSON.stringify(selectors.file)}: use a lowercase slug such as "${scope}" or "chapters-01-05".`);
    }
    const outputFileRel = `evidence/${scope}/${fileStem}.json`;

    const scopeBrief = await readProjectText(
        projectDir,
        'brief/scope-brief.md',
        `No scope brief found at ${path.join(projectDir, 'brief', 'scope-brief.md')}. Write and approve brief/scope-brief.md (Stage 1) before dispatching research.`,
    );
    const briefIssues = validateBriefSections(scopeBrief);
    if (briefIssues.length) {
        throw new Error(`brief/scope-brief.md is not complete, so it can't bound a research subagent yet: ${briefIssues.join(' ')}`);
    }
    const evidenceTemplate = (await readFile(path.join(skillDir, 'templates', 'evidence-file.json'), 'utf8')).trimEnd();

    // Citation keys are <scope>/<recordId>, so new ids must not collide with
    // records other files in this scope already use. The target file's own
    // ids are left out: re-dispatching it may reuse them.
    const collected = await collectEvidence(projectDir, { scope });
    const usedIds = [...new Set(collected.records
        .filter(record => record.file !== outputFileRel)
        .map(record => record.id))]
        .sort();

    const continuityId = String(state.continuity?.continuityId || '');
    return {
        output: outputFileRel,
        context: {
            projectId: state.projectId,
            projectTitle: state.title,
            deckId: deck.deckId,
            deckRole: deck.role,
            scope,
            assignment: selectors.assignment
                ? selectors.assignment
                : `the whole \`${scope}\` scope, as the scope brief defines it`,
            continuityId: continuityId ? `\`${continuityId}\`` : 'the continuity named in the scope brief',
            projectDir,
            outputFile: path.join(projectDir, ...outputFileRel.split('/')),
            outputFileRel,
            scopeBrief,
            evidenceTemplate,
            authoringSignals: bulletList(EVIDENCE_AUTHORING_SIGNALS, { code: true }),
            usedRecordIds: usedIds.length
                ? `Other files in scope \`${scope}\` already use these record ids, so pick different ones:\n\n${bulletList(usedIds, { code: true })}`
                : `No other file in scope \`${scope}\` has records yet, so any unique ids work.`,
            returnWroteExample: outputFileRel,
            returnCountsExample: '{"records":12}',
            returnCountsNote: '`records` is the number of records in the file you wrote.',
            returnFlagsNote: '`contested:<recordId>` for a record holding a contested fact, and `truncated-source:<url>` for a source you could read only in part.',
        },
    };
}

/* ---- Role: draft ---- */
const DRAFT_FILE_PART_RE = /^[a-z0-9][a-z0-9_-]*$/;
const BATCH_NUMBERED_STEM_RE = /^(batch|entries)[-_]?\d+$/;
const BATCH_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/** Validates --file <category>/<topic-stem> and returns it without a .json suffix. */
function parseDraftFileSelector(value) {
    const fileStem = String(value || '').replace(/\.json$/, '');
    const parts = fileStem.split('/');
    if (parts.length !== 2 || !parts.every(part => DRAFT_FILE_PART_RE.test(part))) {
        throw new Error(`Invalid --file ${JSON.stringify(value)}: use <category>/<topic-stem> in lowercase, such as "characters/core_cast".`);
    }
    if (BATCH_NUMBERED_STEM_RE.test(parts[1])) {
        throw new Error(`Invalid --file ${JSON.stringify(value)}: name entry files by topic, not by batch, such as "characters/core_cast" or "secrets/major_reveals" (references/authoring-rules.md, Deck manifest).`);
    }
    return fileStem;
}

/**
 * Finds a deck's title batch: plans/title-batches/<deck>/<B>.json, otherwise
 * the one batch file in that folder whose batchId is B.
 * Returns { file, text, json }, where text is the file's verbatim contents.
 */
async function findTitleBatch(projectDir, deckId, batchId) {
    const batchDir = path.join(projectDir, 'plans', 'title-batches', deckId);
    const readBatch = async (fullPath) => {
        const file = toPosixRelative(projectDir, fullPath);
        const text = await readFile(fullPath, 'utf8');
        try {
            return { file, text: text.trimEnd(), json: JSON.parse(text) };
        } catch (e) {
            throw new Error(`${file} is not valid JSON. ${e?.message || ''}`.trim());
        }
    };
    const direct = path.join(batchDir, `${batchId}.json`);
    if (await pathExists(direct)) return readBatch(direct);

    const matches = [];
    for (const file of await listJsonFilesRecursive(batchDir)) {
        let json = null;
        try {
            json = await readJsonFile(file);
        } catch (_) {
            continue;
        }
        if (String(json?.batchId ?? '') === batchId) matches.push(toPosixRelative(projectDir, file));
    }
    if (matches.length > 1) {
        throw new Error(`Batch ${batchId} is ambiguous: ${matches.sort().join(', ')} all have batchId ${JSON.stringify(batchId)}.`);
    }
    if (!matches.length) {
        throw new Error(`Unknown batch ${JSON.stringify(batchId)} for deck ${deckId}: there is no plans/title-batches/${deckId}/${batchId}.json and no batch file there with that batchId.`);
    }
    return readBatch(path.join(projectDir, ...matches[0].split('/')));
}

/** Sorted evidence keys (<scope>/<recordId>) a batch cites in evidenceRefs or support. */
function citedEvidenceKeys(titles, batchId) {
    const keys = new Set();
    const malformed = [];
    for (const title of titles) {
        for (const ref of Array.isArray(title?.evidenceRefs) ? title.evidenceRefs : []) {
            if (typeof ref === 'string' && ref.trim()) keys.add(ref.trim());
        }
        for (const pointer of Array.isArray(title?.support) ? title.support : []) {
            const parsed = parseFactPointer(pointer);
            if (parsed.ok) keys.add(parsed.key);
            else malformed.push(JSON.stringify(pointer));
        }
    }
    if (malformed.length) {
        throw new Error(`Batch ${batchId} has malformed support pointers (${malformed.join(', ')}). Run \`ground check --stage titles\` and fix the batch before drafting.`);
    }
    return [...keys].sort();
}

async function buildDraftContext({ state, deck, projectDir, skillDir, selectors }) {
    const batchId = selectors.batch;
    if (!BATCH_ID_RE.test(batchId)) {
        throw new Error(`Invalid --batch ${JSON.stringify(batchId)}: use the batch id, such as "batch-1".`);
    }
    const fileStem = parseDraftFileSelector(selectors.file);
    const deckDirRel = `drafts/${deck.deckId}`;
    const outputFileRel = `${deckDirRel}/${fileStem}.json`;
    const absolute = relPath => path.join(projectDir, ...relPath.split('/'));

    const batch = await findTitleBatch(projectDir, deck.deckId, batchId);
    const batchRecord = (state.batches?.[deck.deckId]?.titles || []).find(item => item.id === batchId);
    const batchStatus = batchRecord?.status || 'none recorded';
    if (batchStatus !== 'approved') {
        throw new Error(`batch ${batchId} is not approved (status: ${batchStatus}); approve its titles gate before drafting.`);
    }
    const titles = Array.isArray(batch.json?.titles) ? batch.json.titles : [];
    if (!titles.length) {
        throw new Error(`${batch.file} has no titles to draft.`);
    }

    const timelineRel = `${deckDirRel}/timeline.json`;
    const tagsRel = `${deckDirRel}/tags.json`;
    for (const registryRel of [timelineRel, tagsRel]) {
        if (!(await pathExists(absolute(registryRel)))) {
            throw new Error(`No ${registryRel}. Approve the deck's context plan (timeline and tags) before drafting.`);
        }
    }

    // Every evidence file holding a record the batch cites, by evidenceRefs
    // or by a support pointer. Unknown records stop the render: the subagent
    // could not ground a card on them.
    const citedKeys = citedEvidenceKeys(titles, batchId);
    if (!citedKeys.length) {
        throw new Error(`Batch ${batchId} cites no evidence records. Every title needs evidenceRefs and support before drafting.`);
    }
    const collected = await collectEvidence(projectDir, {});
    const filesByKey = new Map();
    for (const record of collected.records) {
        if (!filesByKey.has(record.key)) filesByKey.set(record.key, new Set());
        filesByKey.get(record.key).add(record.file);
    }
    const unknownKeys = citedKeys.filter(key => !filesByKey.has(key));
    if (unknownKeys.length) {
        throw new Error(`Batch ${batchId} cites evidence records that no evidence file holds: ${unknownKeys.join(', ')}. Run \`ground check --stage titles\` and fix the batch before drafting.`);
    }
    const evidenceFiles = [...new Set(citedKeys.flatMap(key => [...filesByKey.get(key)]))].sort();
    const citedRecordLines = citedKeys.map(key => `\`${key}\` in \`${[...filesByKey.get(key)].sort().join('`, `')}\``);

    let existingFileNote = 'The file does not exist yet, so create it.';
    if (await pathExists(absolute(outputFileRel))) {
        const existing = await readJsonFile(absolute(outputFileRel)).catch(() => null);
        const count = Array.isArray(existing?.entries) ? existing.entries.length : null;
        const held = count === null ? '' : ` with ${count} ${count === 1 ? 'entry' : 'entries'}`;
        existingFileNote = `The file already exists${held}. Read it first, keep its existing entries exactly as they are, and add your cards to its \`entries\` array.`;
    }

    const authoringRules = (await readFile(path.join(skillDir, 'references', 'authoring-rules.md'), 'utf8')).trim();
    return {
        output: outputFileRel,
        context: {
            projectId: state.projectId,
            projectTitle: state.title,
            deckId: deck.deckId,
            deckRole: deck.role,
            batchId,
            batchFileRel: batch.file,
            batchJson: batch.text,
            titleCount: titles.length,
            projectDir,
            timelineFile: absolute(timelineRel),
            timelineFileRel: timelineRel,
            tagsFile: absolute(tagsRel),
            tagsFileRel: tagsRel,
            evidenceFiles: bulletList(evidenceFiles.map(absolute), { code: true }),
            citedRecords: bulletList(citedRecordLines),
            outputFile: absolute(outputFileRel),
            outputFileRel,
            existingFileNote,
            authoringRules,
            returnWroteExample: outputFileRel,
            returnCountsExample: `{"cards":${titles.length}}`,
            returnCountsNote: '`cards` is the number of cards you added to the file you wrote.',
            returnFlagsNote: '`missing-tag:<namespace:value>` for a tag a card needs that tags.json does not define, `missing-anchor:<anchor-id>` for a timeline anchor a card needs that timeline.json does not define, and `ungrounded:<title-id>` for a title whose cited facts do not support a card.',
        },
    };
}

export const BRIEF_ROLES = {
    research: {
        template: 'research.md',
        requires: ['scope'],
        accepts: ['scope', 'file', 'assignment'],
        buildContext: buildResearchContext,
    },
    draft: {
        template: 'draft.md',
        requires: ['batch', 'file'],
        accepts: ['batch', 'file'],
        buildContext: buildDraftContext,
    },
};

export function listBriefRoles() {
    return Object.keys(BRIEF_ROLES).sort();
}

function readSelector(flags, name) {
    const value = flags[name];
    if (value === undefined) return '';
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`--${name} needs a value.`);
    }
    return value.trim();
}

/**
 * Builds the rendered brief for one subagent dispatch.
 * Returns { role, projectId, deckId, scope, batch, file, output, prompt }.
 */
export async function buildBrief({ projectId, role, deckId, flags = {} }) {
    const roleNames = listBriefRoles();
    if (!role || typeof role !== 'string') {
        throw new Error(`--role is required. Available roles: ${roleNames.join(', ')}.`);
    }
    const spec = Object.hasOwn(BRIEF_ROLES, role) ? BRIEF_ROLES[role] : undefined;
    if (!spec) {
        throw new Error(`Unknown role ${JSON.stringify(role)}. Available roles: ${roleNames.join(', ')}.`);
    }
    if (!deckId || typeof deckId !== 'string') {
        throw new Error('--deck <deck-id> is required.');
    }

    const selectors = {};
    for (const name of SELECTOR_FLAGS) {
        const value = readSelector(flags, name);
        if (!value) continue;
        if (!spec.accepts.includes(name)) {
            throw new Error(`Role ${role} does not take --${name}.`);
        }
        selectors[name] = value;
    }
    for (const name of spec.requires) {
        if (!selectors[name]) {
            throw new Error(`Role ${role} requires --${name} <${name}>.`);
        }
    }
    if (selectors.scope && !isValidSlug(selectors.scope)) {
        throw new Error(`Invalid --scope ${JSON.stringify(selectors.scope)}: scopes are lowercase slugs.`);
    }

    const state = await loadProjectState(projectId);
    const deck = (state.decks || []).find(item => item.deckId === deckId);
    if (!deck) {
        throw new Error(`Unknown deck id ${JSON.stringify(deckId)}. Project decks: ${(state.decks || []).map(item => item.deckId).join(', ')}.`);
    }
    const projectDir = resolveProjectDir(projectId);
    const skillDir = await resolveSkillDir();

    const { context, output } = await spec.buildContext({ state, deck, projectDir, skillDir, selectors });
    const roleTemplate = stripTemplateHeader(await readFile(path.join(skillDir, 'agents', spec.template), 'utf8'));
    const contractTemplate = stripTemplateHeader(await readFile(path.join(skillDir, 'agents', RETURN_CONTRACT_TEMPLATE), 'utf8'));
    const body = renderTemplate(roleTemplate, context, { label: `agents/${spec.template}` }).trimEnd();
    const contract = renderTemplate(contractTemplate, context, { label: `agents/${RETURN_CONTRACT_TEMPLATE}` }).trimEnd();

    return {
        role,
        projectId,
        deckId,
        scope: selectors.scope || null,
        batch: selectors.batch || null,
        file: selectors.file || null,
        output,
        prompt: `${body}\n\n${contract}\n`,
    };
}
