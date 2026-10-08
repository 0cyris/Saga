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

import { AUDIT_DIR_REL } from './audit-findings.mjs';
import { isValidSlug, listJsonFilesRecursive, pathExists, readJsonFile, resolveProjectDir, toPosixRelative } from './deck-fs.mjs';
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

/* ---- Role: grounding-verify ---- */
// A clean-context check: the prompt carries only file paths, the verdict
// rules and the findings shape -- never orchestrator commentary or drafting
// rationale. --batch selects a title batch; --file (an entry-file stem) is
// reserved for card batches.
export const GROUNDING_VERDICTS = ['entailed', 'partial', 'unsupported', 'timing-mismatch'];
const BATCH_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Finds plans/title-batches/<deck>/<batchId>.json, or else the one file there
 * whose `batchId` is batchId. Returns { fullPath, rel, json }.
 */
async function resolveTitleBatch(projectDir, deckId, batchId) {
    const batchDir = path.join(projectDir, 'plans', 'title-batches', deckId);
    const files = (await listJsonFilesRecursive(batchDir)).sort();
    const loaded = [];
    for (const file of files) {
        let json = null;
        try {
            json = await readJsonFile(file);
        } catch (_) {
            json = null;
        }
        loaded.push({ fullPath: file, rel: toPosixRelative(projectDir, file), json });
    }
    const byName = loaded.find(item => item.rel === `plans/title-batches/${deckId}/${batchId}.json`);
    const byId = loaded.filter(item => String(item.json?.batchId || '') === batchId);
    const match = byName || (byId.length === 1 ? byId[0] : null);
    if (!match && byId.length > 1) {
        throw new Error(`More than one title batch in plans/title-batches/${deckId}/ has batchId ${JSON.stringify(batchId)}: ${byId.map(item => item.rel).join(', ')}.`);
    }
    if (!match) {
        const known = [...new Set(loaded.map(item => String(item.json?.batchId || path.basename(item.fullPath, '.json'))))].sort();
        throw new Error(`Unknown title batch ${JSON.stringify(batchId)} for deck ${deckId}. ${known.length ? `Batches under plans/title-batches/${deckId}/: ${known.join(', ')}.` : `No title batches found under plans/title-batches/${deckId}/.`}`);
    }
    if (!match.json || !Array.isArray(match.json.titles)) {
        throw new Error(`${match.rel} is not a readable title batch (it needs a "titles" array). Fix it, then render the brief again.`);
    }
    return match;
}

async function buildTitlesGroundingContext({ state, deck, projectDir, batchId }) {
    const batch = await resolveTitleBatch(projectDir, deck.deckId, batchId);
    const titles = batch.json.titles;

    // Every record a title cites, through support pointers or evidenceRefs.
    const citedKeys = new Set();
    for (const title of titles) {
        for (const pointer of Array.isArray(title?.support) ? title.support : []) {
            const parsed = parseFactPointer(pointer);
            if (parsed.ok) citedKeys.add(parsed.key);
        }
        for (const ref of Array.isArray(title?.evidenceRefs) ? title.evidenceRefs : []) {
            if (typeof ref === 'string' && ref.trim()) citedKeys.add(ref.trim());
        }
    }
    const collected = await collectEvidence(projectDir, {});
    const evidenceFiles = new Set();
    const foundKeys = new Set();
    for (const record of collected.records) {
        if (!citedKeys.has(record.key)) continue;
        foundKeys.add(record.key);
        evidenceFiles.add(record.file);
    }
    const missingKeys = [...citedKeys].filter(key => !foundKeys.has(key)).sort();
    const evidencePaths = [...evidenceFiles].sort().map(rel => path.join(projectDir, ...rel.split('/')));

    const outputFileRel = `${AUDIT_DIR_REL}/${deck.deckId}-titles-${batchId}.json`;
    const findingsExample = JSON.stringify({
        schemaVersion: 1,
        role: 'grounding-verify',
        target: batch.rel,
        findings: [
            { ref: '<title id>', verdict: 'entailed', note: '' },
            { ref: '<title id>', verdict: 'timing-mismatch', note: 'chapters/example-ch-14#0 says "<quoted fact text>", which places this in chapter 14, not chapter 12.' },
        ],
    }, null, 2);
    const titleIds = titles.map(title => String(title?.id || '').trim() || '(a title with no id: use its `title` text as the ref)');

    return {
        output: outputFileRel,
        context: {
            projectId: state.projectId,
            deckId: deck.deckId,
            batchId,
            batchFile: batch.fullPath,
            batchFileRel: batch.rel,
            projectDir,
            titleCount: titles.length,
            titleIds: titleIds.length ? bulletList(titleIds, { code: true }) : '- (the batch has no titles)',
            evidenceFiles: evidencePaths.length ? bulletList(evidencePaths, { code: true }) : '- (no cited record was found in any evidence file)',
            missingRecords: missingKeys.length
                ? `These cited records are not in any evidence file, so no fact backs a claim that relies on them:\n\n${bulletList(missingKeys, { code: true })}`
                : 'Every record the batch cites is in one of the files above.',
            outputFile: path.join(projectDir, ...outputFileRel.split('/')),
            outputFileRel,
            findingsExample,
            returnWroteExample: outputFileRel,
            returnCountsExample: `{"titles":${titles.length},"flagged":0}`,
            returnCountsNote: '`titles` is the number of findings you wrote (one per title); `flagged` is how many of them are not `entailed`.',
            returnFlagsNote: '`unreadable-file:<path>` for a listed file you could not read.',
        },
    };
}

async function buildGroundingVerifyContext({ state, deck, projectDir, selectors }) {
    if (selectors.batch && selectors.file) {
        throw new Error('Role grounding-verify takes either --batch <title-batch-id> or --file <entry-file stem>, not both.');
    }
    const kind = selectors.batch ? 'titles' : (selectors.file ? 'cards' : '');
    switch (kind) {
    case 'titles': {
        if (!BATCH_ID_RE.test(selectors.batch)) {
            throw new Error(`Invalid --batch ${JSON.stringify(selectors.batch)}: use the batch id, such as "batch-1".`);
        }
        return buildTitlesGroundingContext({ state, deck, projectDir, batchId: selectors.batch });
    }
    case 'cards':
        throw new Error('grounding-verify for card batches (--file <entry-file stem>) is not yet supported. Use --batch <title-batch-id> to check a title batch.');
    default:
        throw new Error('Role grounding-verify requires --batch <title-batch-id>.');
    }
}

export const BRIEF_ROLES = {
    research: {
        template: 'research.md',
        requires: ['scope'],
        accepts: ['scope', 'file', 'assignment'],
        buildContext: buildResearchContext,
    },
    'grounding-verify': {
        template: 'grounding-verify.md',
        requires: [],
        accepts: ['batch', 'file'],
        buildContext: buildGroundingVerifyContext,
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
