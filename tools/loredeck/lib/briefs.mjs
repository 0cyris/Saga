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
const SCHEMA_DOC = 'SAGA_LOREDECK_SCHEMA.md';
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

/**
 * Locates the authoring schema doc (SAGA_LOREDECK_SCHEMA.md). Covers the same
 * layouts as resolveSkillDir: the repo checkout (docs/loredecks/ at the repo
 * root), and the plugin and .skill bundles (docs/ next to cli/).
 */
export async function resolveSchemaDoc() {
    const root = path.resolve(LIB_DIR, '..', '..', '..');
    const candidates = [
        path.join(root, 'docs', 'loredecks', SCHEMA_DOC),
        path.join(root, 'docs', SCHEMA_DOC),
    ];
    for (const file of candidates) {
        if (await pathExists(file)) return file;
    }
    throw new Error(`Could not find ${SCHEMA_DOC} (looked in: ${candidates.join(', ')}).`);
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

/* ---- Role: draft ---- */
const DRAFT_FILE_PART_RE = /^[a-z0-9][a-z0-9_-]*$/;
const BATCH_NUMBERED_STEM_RE = /^(batch|entries|cards|part|chunk)[-_]?\d+([-_]?[a-z0-9]+)*$/;
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
 * Finds the title batch named batchId in plans/title-batches/<deck>/: the file
 * <batchId>.json, or else the one batch file there whose `batchId` is batchId.
 * Returns `{ fullPath, rel, file, text, json, batchId }`, where `batchId` is the
 * canonical id (`json.batchId`, falling back to the file name -- the same key
 * `ground check` and `report --stage titles` use) and `text` is the raw file,
 * for verbatim inclusion. A file found by name whose batchId differs, and a
 * name that matches one file by name and another by batchId, are errors.
 * Shared by the draft and grounding-verify roles.
 */
async function findTitleBatch(projectDir, deckId, batchId) {
    const batchDirRel = `plans/title-batches/${deckId}`;
    const batchDir = path.join(projectDir, 'plans', 'title-batches', deckId);
    const readBatch = async (fullPath) => {
        const rel = toPosixRelative(projectDir, fullPath);
        const text = await readFile(fullPath, 'utf8');
        let json = null;
        try {
            json = JSON.parse(text);
        } catch (e) {
            throw new Error(`${rel} is not valid JSON. ${e?.message || ''}`.trim());
        }
        if (!json || !Array.isArray(json.titles)) {
            throw new Error(`${rel} is not a readable title batch (it needs a "titles" array). Fix it, then render the brief again.`);
        }
        const canonicalId = String(json.batchId || path.basename(fullPath, '.json'));
        return { fullPath, rel, file: rel, text: text.trimEnd(), json, batchId: canonicalId };
    };
    const direct = path.join(batchDir, `${batchId}.json`);
    const directExists = await pathExists(direct);

    const matches = [];
    const known = new Set();
    for (const file of (await listJsonFilesRecursive(batchDir)).sort()) {
        let json = null;
        try {
            json = await readJsonFile(file);
        } catch (_) {
            known.add(`${path.basename(file)} (unreadable)`);
            continue;
        }
        known.add(String(json?.batchId || path.basename(file, '.json')));
        if (path.resolve(file) === path.resolve(direct)) continue;
        if (String(json?.batchId ?? '') === batchId) matches.push(toPosixRelative(projectDir, file));
    }
    if (directExists && matches.length) {
        throw new Error(`Title batch ${JSON.stringify(batchId)} is ambiguous for deck ${deckId}: ${batchDirRel}/${batchId}.json is named ${batchId}, and ${matches.join(', ')} ${matches.length === 1 ? 'has' : 'have'} batchId ${JSON.stringify(batchId)}. Rename or renumber one so file names and batchIds agree.`);
    }
    if (directExists) {
        const found = await readBatch(direct);
        if (found.batchId !== batchId) {
            throw new Error(`${batchDirRel}/${batchId}.json has batchId ${found.batchId}; pass --batch ${found.batchId} (file names and batchIds must agree).`);
        }
        return found;
    }
    if (matches.length > 1) {
        throw new Error(`More than one title batch in ${batchDirRel}/ has batchId ${JSON.stringify(batchId)}: ${matches.join(', ')}.`);
    }
    if (!matches.length) {
        const list = [...known].sort();
        throw new Error(`Unknown title batch ${JSON.stringify(batchId)} for deck ${deckId}. ${list.length ? `Batches under ${batchDirRel}/: ${list.join(', ')}.` : `No title batches found under ${batchDirRel}/.`}`);
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
    if (!BATCH_ID_RE.test(selectors.batch)) {
        throw new Error(`Invalid --batch ${JSON.stringify(selectors.batch)}: use the batch id, such as "batch-1".`);
    }
    const fileStem = parseDraftFileSelector(selectors.file);
    const deckDirRel = `drafts/${deck.deckId}`;
    const outputFileRel = `${deckDirRel}/${fileStem}.json`;
    const absolute = relPath => path.join(projectDir, ...relPath.split('/'));

    const batch = await findTitleBatch(projectDir, deck.deckId, selectors.batch);
    // Approval status is keyed by the canonical id, as ground check and report do.
    const batchId = batch.batchId;
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
    const statusByKey = new Map(collected.records.map(record => [record.key, record.status]));
    const unacceptedKeys = citedKeys.filter(key => statusByKey.get(key) !== 'accepted');
    if (unacceptedKeys.length) {
        throw new Error(`Batch ${batchId} cites evidence records that are not accepted: ${unacceptedKeys.map(key => `${key} (${statusByKey.get(key) || 'pending'})`).join(', ')}. Run \`ground check --stage titles\` and fix the batch before drafting.`);
    }
    const evidenceFiles = [...new Set(citedKeys.flatMap(key => [...filesByKey.get(key)]))].sort();
    const citedRecordLines = citedKeys.map(key => `\`${key}\` in \`${[...filesByKey.get(key)].sort().join('`, `')}\``);

    let existingFileNote = 'The file does not exist yet, so create it.';
    if (await pathExists(absolute(outputFileRel))) {
        let existing = null;
        let problem = '';
        try {
            existing = JSON.parse(await readFile(absolute(outputFileRel), 'utf8'));
        } catch (error) {
            problem = `it is not valid JSON (${error?.message || error})`;
        }
        if (!problem && (!existing || typeof existing !== 'object' || Array.isArray(existing) || !Array.isArray(existing.entries))) {
            problem = Array.isArray(existing) ? 'it is a bare array' : 'it has no `entries` array';
        }
        if (problem) {
            throw new Error(`${outputFileRel} already exists, but ${problem}; an entry file is a { "entries": [...] } object. Fix or move it, then render the brief again.`);
        }
        const count = existing.entries.length;
        existingFileNote = `The file already exists with ${count} ${count === 1 ? 'entry' : 'entries'}. Read it first, keep its other entries exactly as they are, and add your cards to its \`entries\` array. A card whose \`id\` is already in the file replaces that entry in place, so each id appears once and is never duplicated.`;
    }

    const schemaDocFile = await resolveSchemaDoc();
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
            schemaDocFile,
            authoringRules,
            returnWroteExample: outputFileRel,
            returnCountsExample: `{"cards":${titles.length}}`,
            returnCountsNote: '`cards` is the number of cards you added to the file you wrote.',
            returnFlagsNote: '`missing-tag:<namespace:value>` for a tag a card needs that tags.json does not define, `missing-anchor:<anchor-id>` for a timeline anchor a card needs that timeline.json does not define, and `ungrounded:<title-id>` for a title whose cited facts do not support a card.',
        },
    };
}

/* ---- Role: evidence-audit ---- */
export const EVIDENCE_AUDIT_VERDICTS = ['supported', 'unsupported', 'contested', 'out-of-scope'];

/**
 * Findings path for one audited evidence file: reviews/audit/evidence-audit.<scope>.json,
 * or evidence-audit.<scope>.<file>.json when the file stem differs from the scope,
 * so each auditor writes its own file.
 */
export function evidenceAuditOutputRel(scope, fileStem) {
    return `${AUDIT_DIR_REL}/evidence-audit.${scope}${fileStem && fileStem !== scope ? `.${fileStem}` : ''}.json`;
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
    const declaredScope = typeof evidence?.scope === 'string' ? evidence.scope : '';
    if (declaredScope && declaredScope !== scope) {
        throw new Error(`${evidenceFileRel} declares scope ${declaredScope}; its records are cited as ${declaredScope}/<id>. Move the file or fix its scope.`);
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

/* ---- Role: grounding-verify ---- */
// A clean-context check: the prompt carries only file paths, the verdict
// rules and the findings shape -- never orchestrator commentary or drafting
// rationale. --batch selects a title batch; --file <category>/<topic-stem>
// selects a card batch (one entry file in drafts/<deck>/). One template
// serves both kinds; the per-kind wording below fills its placeholders.
export const GROUNDING_VERDICTS = ['entailed', 'partial', 'unsupported', 'timing-mismatch'];

const GROUNDING_KINDS = {
    titles: {
        batchLabel: 'title batch',
        itemNoun: 'title',
        itemNounPlural: 'titles',
        pointerField: '`support`',
        batchIntro: 'A title batch proposes Lorecards to draft. Each title states a `gateIntent`: a claim about what the card covers and when in the story it may appear. Each title also cites the evidence facts that are meant to back that claim.',
        itemFields: [
            '- `id`: the title\'s id. It is the `ref` of your finding.',
            '- `gateIntent`: the claim you are checking.',
            '- `support`: the fact pointers that back the claim.',
            '- `evidenceRefs`: the records (`<scope>/<recordId>`) the title draws on.',
        ].join('\n'),
        judgeFieldsRule: 'Judge only `id`, `gateIntent`, `support` and `evidenceRefs`; ignore any other batch fields.',
        checkSteps: [
            '1. Resolve each `support` pointer and read the fact it names, word for word.',
            '2. Decide whether those facts, taken together, entail the `gateIntent` claim: every person, event, relationship, and status the claim asserts is stated in them.',
            '3. Decide whether the timing matches. When the `gateIntent` says when the card becomes eligible (from the opening, after a given chapter, during an arc, before a reveal), the facts must place the thing at that same point in the story.',
            '4. Give exactly one verdict.',
        ].join('\n'),
        verdictRules: [
            '- `entailed`: the cited facts state everything the claim asserts, and any timing in the claim matches the timing they describe.',
            '- `partial`: the cited facts back part of the claim, and some other part of it is not stated in them.',
            '- `unsupported`: the cited facts do not back the claim. This includes a pointer that names no fact (an unknown record, or an index past the end of `facts[]`) and a title with no `support`.',
            '- `timing-mismatch`: the cited facts back what the claim describes, and they place it at a different point in the story than the claim\'s gate does.',
        ].join('\n'),
        noteExample: 'chapters/example-ch-14#0 says "<quoted fact text>", which places this in chapter 14, not chapter 12.',
    },
    cards: {
        batchLabel: 'card batch',
        itemNoun: 'card',
        itemNounPlural: 'cards',
        pointerField: '`sourceInfo.evidenceFacts`',
        batchIntro: 'A card batch is one entry file of drafted Lorecards. Each card states a claim in `content.fact` and `content.injection`, and a timing in its `context` window and `revealPolicy`: when in the story the card may be used, and what it may reveal. Each card also cites the evidence facts that are meant to back that claim and that timing.',
        itemFields: [
            '- `id`: the card\'s id. It is the `ref` of your finding.',
            '- `content.fact` and `content.injection`: the claim you are checking. Both must be backed.',
            '- `context`: the card\'s story window. `validFromAnchor` and `validToAnchor` are anchor ids in the deck\'s `timeline.json`; `label`, `sortKeyFrom` and `sortKeyTo` describe the same window.',
            '- `revealPolicy`: what the card lets the story reveal, and when (`public`, `private`, `do_not_reveal`, `only_if_knower_present`, `only_if_user_reveals`).',
            '- `sourceInfo.evidenceFacts`: the fact pointers that back the claim.',
            '- `sourceInfo.evidenceRefs`: the records (`<scope>/<recordId>`) the card draws on.',
        ].join('\n'),
        judgeFieldsRule: 'Judge only `id`, `content.fact`, `content.injection`, `context`, `revealPolicy`, `sourceInfo.evidenceFacts` and `sourceInfo.evidenceRefs`; ignore any other entry fields.',
        checkSteps: [
            '1. Resolve each `sourceInfo.evidenceFacts` pointer and read the fact it names, word for word.',
            '2. Decide whether those facts, taken together, entail `content.fact` and `content.injection`: every person, event, relationship, and status either one asserts is stated in them.',
            '3. Resolve `context.validFromAnchor` and `context.validToAnchor` to their anchor labels in `timeline.json`, and decide whether the window matches the timing the facts describe: the window opens no earlier than the story point where the facts place the thing.',
            '4. Decide whether the `revealPolicy` matches that timing: when the facts place a reveal later than the window opens, the card keeps that reveal behind `private`, `do_not_reveal`, `only_if_knower_present` or `only_if_user_reveals`, and a `public` card states only what the facts place inside its window.',
            '5. Give exactly one verdict.',
        ].join('\n'),
        verdictRules: [
            '- `entailed`: the cited facts state everything `content.fact` and `content.injection` assert, and the context window and reveal policy match the timing those facts describe.',
            '- `partial`: the cited facts back part of `content.fact` or `content.injection`, and some other part of either one is not stated in them.',
            '- `unsupported`: the cited facts do not back the claim. This includes a pointer that names no fact (an unknown record, or an index past the end of `facts[]`) and a card with no `sourceInfo.evidenceFacts`.',
            '- `timing-mismatch`: the cited facts back what the card says, and the context window opens before the story point those facts describe, or the reveal policy exposes something the facts place later than the window.',
        ].join('\n'),
        noteExample: 'chapters/example-ch-14#0 says "<quoted fact text>", which places this in chapter 14, but the window opens at anchor example.ch_12 ("Chapter 12").',
    },
};

/**
 * Collects the evidence a list of items cites through fact pointers
 * (`pointersOf`) and record refs (`refsOf`). Malformed pointers are kept for
 * the checker rather than dropped. Returns sorted absolute evidence paths,
 * the cited keys no evidence file holds, and the malformed pointers.
 */
async function collectCitedEvidence(projectDir, items, { pointersOf, refsOf }) {
    const citedKeys = new Set();
    const malformedPointers = [];
    for (const item of items) {
        const pointers = pointersOf(item);
        for (const pointer of Array.isArray(pointers) ? pointers : []) {
            const parsed = parseFactPointer(pointer);
            if (parsed.ok) citedKeys.add(parsed.key);
            else malformedPointers.push({ pointer: typeof pointer === 'string' ? pointer : JSON.stringify(pointer), itemId: String(item?.id || '').trim() });
        }
        const refs = refsOf(item);
        for (const ref of Array.isArray(refs) ? refs : []) {
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
    return {
        evidencePaths: [...evidenceFiles].sort().map(rel => path.join(projectDir, ...rel.split('/'))),
        missingKeys: [...citedKeys].filter(key => !foundKeys.has(key)).sort(),
        malformedPointers,
    };
}

/** Context shared by both kinds, from a kind spec, the batch, its items and its cited evidence. */
function groundingContext({ kind, state, deck, projectDir, batchId, batchFile, batchFileRel, items, cited, outputFileRel, extraFiles = '' }) {
    const spec = GROUNDING_KINDS[kind];
    const findingsExample = JSON.stringify({
        schemaVersion: 1,
        role: 'grounding-verify',
        target: batchFileRel,
        findings: [
            { ref: `<${spec.itemNoun} id>`, verdict: 'entailed', note: '' },
            { ref: `<${spec.itemNoun} id>`, verdict: 'timing-mismatch', note: spec.noteExample },
        ],
    }, null, 2);
    const itemIds = items.map(item => String(item?.id || '').trim() || `(a ${spec.itemNoun} with no id: use its \`title\` text as the ref)`);
    return {
        projectId: state.projectId,
        deckId: deck.deckId,
        batchId,
        batchLabel: spec.batchLabel,
        batchIntro: spec.batchIntro,
        itemNoun: spec.itemNoun,
        itemNounPlural: spec.itemNounPlural,
        itemFields: spec.itemFields,
        judgeFieldsRule: spec.judgeFieldsRule,
        checkSteps: spec.checkSteps,
        verdictRules: spec.verdictRules,
        batchFile,
        batchFileRel,
        projectDir,
        itemCount: items.length,
        itemIds: itemIds.length ? bulletList(itemIds, { code: true }) : `- (the batch has no ${spec.itemNounPlural})`,
        evidenceFiles: cited.evidencePaths.length ? bulletList(cited.evidencePaths, { code: true }) : '- (no cited record was found in any evidence file)',
        missingRecords: describeMissingRecords(cited.missingKeys, cited.malformedPointers, spec),
        extraFiles,
        outputFile: path.join(projectDir, ...outputFileRel.split('/')),
        outputFileRel,
        findingsExample,
        returnWroteExample: outputFileRel,
        returnCountsExample: `{"${spec.itemNounPlural}":${items.length},"flagged":0}`,
        returnCountsNote: `\`${spec.itemNounPlural}\` is the number of findings you wrote (one per ${spec.itemNoun}); \`flagged\` is how many of them are not \`entailed\`.`,
        returnFlagsNote: '`unreadable-file:<path>` for a listed file you could not read.',
    };
}

async function buildTitlesGroundingContext({ state, deck, projectDir, batchId: requestedId }) {
    const batch = await findTitleBatch(projectDir, deck.deckId, requestedId);
    // Findings are named by the canonical id, the key report --stage titles uses.
    const batchId = batch.batchId;
    const titles = batch.json.titles;
    const cited = await collectCitedEvidence(projectDir, titles, {
        pointersOf: title => title?.support,
        refsOf: title => title?.evidenceRefs,
    });
    const outputFileRel = `${AUDIT_DIR_REL}/grounding.${deck.deckId}.titles.${batchId}.json`;
    return {
        output: outputFileRel,
        context: groundingContext({
            kind: 'titles', state, deck, projectDir, batchId,
            batchFile: batch.fullPath,
            batchFileRel: batch.rel,
            items: titles,
            cited,
            outputFileRel,
        }),
    };
}

/**
 * Findings path for one card batch: the entry file's path under drafts/<deck>/,
 * minus .json, with / replaced by . (spec §9), so category folders never collide.
 */
export function cardGroundingOutputRel(deckId, fileStem) {
    return `${AUDIT_DIR_REL}/grounding.${deckId}.cards.${fileStem.split('/').join('.')}.json`;
}

async function buildCardsGroundingContext({ state, deck, projectDir, file }) {
    const fileStem = parseDraftFileSelector(file);
    const deckDirRel = `drafts/${deck.deckId}`;
    const entryFileRel = `${deckDirRel}/${fileStem}.json`;
    const absolute = relPath => path.join(projectDir, ...relPath.split('/'));
    const entryFile = absolute(entryFileRel);
    if (!await pathExists(entryFile)) {
        throw new Error(`No entry file at ${entryFileRel}. The grounding checker reads an existing card batch: pass --file with the <category>/<topic-stem> of an entry file in ${deckDirRel}/.`);
    }
    let json = null;
    try {
        json = JSON.parse(await readFile(entryFile, 'utf8'));
    } catch (error) {
        throw new Error(`${entryFileRel} is not valid JSON (${error?.message || error}). Fix it, then render the brief again.`);
    }
    // The same shapes collectCardItems/readDeckEntries accept.
    const cards = Array.isArray(json) ? json : json?.entries;
    if (!Array.isArray(cards)) {
        throw new Error(`${entryFileRel} has no entries array. Fix it, then render the brief again.`);
    }
    const cited = await collectCitedEvidence(projectDir, cards, {
        pointersOf: card => card?.sourceInfo?.evidenceFacts,
        refsOf: card => card?.sourceInfo?.evidenceRefs,
    });

    const timelineRel = `${deckDirRel}/timeline.json`;
    const timelineLine = `- \`${absolute(timelineRel)}\` (project-relative: \`${timelineRel}\`)`;
    const extraFiles = await pathExists(absolute(timelineRel))
        ? `The deck's timeline, read-only, to resolve each card's \`context.validFromAnchor\` and \`context.validToAnchor\` to an anchor label:\n\n${timelineLine}\n\n`
        : `The deck's timeline belongs at the path below, and that file does not exist yet, so no anchor id resolves to a label. Judge each window from its \`context.label\` and the anchor ids as written:\n\n${timelineLine}\n\n`;

    const outputFileRel = cardGroundingOutputRel(deck.deckId, fileStem);
    return {
        output: outputFileRel,
        context: groundingContext({
            kind: 'cards', state, deck, projectDir,
            batchId: fileStem,
            batchFile: entryFile,
            batchFileRel: entryFileRel,
            items: cards,
            cited,
            outputFileRel,
            extraFiles,
        }),
    };
}

function describeMissingRecords(missingKeys, malformedPointers, spec) {
    const blocks = [];
    if (missingKeys.length) {
        blocks.push(`These cited records are not in any evidence file, so no fact backs a claim that relies on them:\n\n${bulletList(missingKeys, { code: true })}`);
    }
    if (malformedPointers.length) {
        blocks.push(`These ${spec.pointerField} pointers are not of the form \`<scope>/<recordId>#<factIndex>\`, so each one names no fact:\n\n${malformedPointers.map(({ pointer, itemId }) => `- \`${pointer}\` in ${itemId ? `\`${itemId}\`` : `a ${spec.itemNoun} with no id`}: names no fact`).join('\n')}`);
    }
    return blocks.length ? blocks.join('\n\n') : 'Every record the batch cites is in one of the files above.';
}

async function buildGroundingVerifyContext({ state, deck, projectDir, selectors }) {
    if (selectors.batch && selectors.file) {
        throw new Error('Role grounding-verify takes either --batch <title-batch-id> or --file <category>/<topic-stem>, not both.');
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
        return buildCardsGroundingContext({ state, deck, projectDir, file: selectors.file });
    default:
        throw new Error('Role grounding-verify requires --batch <title-batch-id> (a title batch) or --file <category>/<topic-stem> (a card batch).');
    }
}

export const BRIEF_ROLES = {
    draft: {
        template: 'draft.md',
        requires: ['batch', 'file'],
        accepts: ['batch', 'file'],
        buildContext: buildDraftContext,
    },
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
