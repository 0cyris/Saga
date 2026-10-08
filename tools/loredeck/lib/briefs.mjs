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

import { isValidSlug, pathExists, resolveProjectDir } from './deck-fs.mjs';
import { collectEvidence, EVIDENCE_AUTHORING_SIGNALS } from './evidence-store.mjs';
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

/**
 * Reads brief/scope-brief.md and checks that it is complete enough to bound a
 * subagent. Shared by every role that inlines the scope brief.
 */
async function loadCompleteScopeBrief(projectDir, { dispatching, subagent }) {
    const scopeBrief = await readProjectText(
        projectDir,
        'brief/scope-brief.md',
        `No scope brief found at ${path.join(projectDir, 'brief', 'scope-brief.md')}. Write and approve brief/scope-brief.md (Stage 1) before dispatching ${dispatching}.`,
    );
    const briefIssues = validateBriefSections(scopeBrief);
    if (briefIssues.length) {
        throw new Error(`brief/scope-brief.md is not complete, so it can't bound ${subagent} yet: ${briefIssues.join(' ')}`);
    }
    return scopeBrief;
}

/* ---- Role: research ---- */
async function buildResearchContext({ state, deck, projectDir, skillDir, selectors }) {
    const scope = selectors.scope;
    const fileStem = selectors.file ? selectors.file.replace(/\.json$/, '') : scope;
    if (!isValidSlug(fileStem)) {
        throw new Error(`Invalid --file ${JSON.stringify(selectors.file)}: use a lowercase slug such as "${scope}" or "chapters-01-05".`);
    }
    const outputFileRel = `evidence/${scope}/${fileStem}.json`;

    const scopeBrief = await loadCompleteScopeBrief(projectDir, { dispatching: 'research', subagent: 'a research subagent' });
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

/* ---- Role: evidence-audit ---- */
export const EVIDENCE_AUDIT_VERDICTS = ['supported', 'unsupported', 'contested', 'out-of-scope'];

/**
 * Findings path for one audited evidence file: reviews/audit/evidence-<scope>.json,
 * or evidence-<scope>-<file>.json when the file stem differs from the scope,
 * so each auditor writes its own file.
 */
export function evidenceAuditOutputRel(scope, fileStem) {
    return `reviews/audit/evidence-${scope}${fileStem && fileStem !== scope ? `-${fileStem}` : ''}.json`;
}

function describeEvidenceSource(evidence) {
    const sourceKind = String(evidence?.sourceKind || '');
    const url = String(evidence?.provenance?.url || '').trim();
    const title = String(evidence?.provenance?.title || '').trim();
    if (sourceKind === 'user_supplied') {
        return [
            `This file's \`sourceKind\` is \`"user_supplied"\`${title ? ` (source: ${title})` : ''}.`,
            'The orchestrator\'s task note after this brief supplies the source text the file was written from, and that text is your source.',
            'When the task note carries no source text, give every fact the `unsupported` verdict with the note "no source text supplied", and list the missing source in `gaps`.',
        ].join(' ');
    }
    return [
        `This file's \`sourceKind\` is \`"${sourceKind || 'web'}"\`, and its \`provenance.url\` is ${url ? `<${url}>` : 'empty'}.`,
        'Re-read that page in full now, along with any other page a record cites in its `quotesOrRefs`.',
        'When the orchestrator\'s task note supplies source text or more URLs, use those as well.',
    ].join(' ');
}

async function buildEvidenceAuditContext({ state, deck, projectDir, selectors }) {
    const scope = selectors.scope;
    const fileStem = selectors.file ? selectors.file.replace(/\.json$/, '') : scope;
    if (!isValidSlug(fileStem)) {
        throw new Error(`Invalid --file ${JSON.stringify(selectors.file)}: name an evidence file stem in evidence/${scope}/, such as "${scope}".`);
    }
    const evidenceFileRel = `evidence/${scope}/${fileStem}.json`;
    const evidenceFile = path.join(projectDir, ...evidenceFileRel.split('/'));
    if (!await pathExists(evidenceFile)) {
        throw new Error(`No evidence file at ${evidenceFileRel}. The evidence checker audits an existing file: pass --file with the stem of a file in evidence/${scope}/.`);
    }
    let evidence;
    try {
        evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
    } catch (error) {
        throw new Error(`${evidenceFileRel} is not valid JSON (${error?.message || error}). Run \`evidence validate\` and fix it before auditing.`);
    }
    const records = Array.isArray(evidence?.records) ? evidence.records : [];
    const factCount = records.reduce((sum, record) => sum + (Array.isArray(record?.facts) ? record.facts.length : 0), 0);

    const scopeBrief = await loadCompleteScopeBrief(projectDir, { dispatching: 'the evidence checker', subagent: 'an evidence-audit subagent' });
    const outputFileRel = evidenceAuditOutputRel(scope, fileStem);
    const continuityId = String(state.continuity?.continuityId || '');
    return {
        output: outputFileRel,
        context: {
            projectId: state.projectId,
            projectTitle: state.title,
            deckId: deck.deckId,
            scope,
            continuityId: continuityId ? `\`${continuityId}\`` : 'the continuity named in the scope brief',
            projectDir,
            evidenceFile,
            evidenceFileRel,
            recordCount: records.length,
            factCount,
            sourceInstruction: describeEvidenceSource(evidence),
            outputFile: path.join(projectDir, ...outputFileRel.split('/')),
            outputFileRel,
            scopeBrief,
            verdicts: EVIDENCE_AUDIT_VERDICTS.map(verdict => `\`${verdict}\``).join(', '),
            returnWroteExample: outputFileRel,
            returnCountsExample: '{"facts":12,"flagged":2}',
            returnCountsNote: '`facts` is the number of findings you wrote (one per fact in the evidence file), and `flagged` is how many of them have a verdict other than `supported`.',
            returnFlagsNote: '`truncated-source:<url>` for a source you could read only in part, and `noisy-extraction:<file>` for an evidence file whose facts carry text-extraction noise.',
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
    'evidence-audit': {
        template: 'evidence-audit.md',
        requires: ['scope'],
        accepts: ['scope', 'file'],
        buildContext: buildEvidenceAuditContext,
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
