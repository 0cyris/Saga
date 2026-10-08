/**
 * grounding.mjs -- Saga loredeck CLI
 * Fact-level grounding pointers (`<scope>/<recordId>#<factIndex>`, 0-based)
 * and the deterministic checks behind `ground check`. A pointer names the one
 * evidence fact that backs a claim; this module parses pointers, resolves them
 * against the evidence store, and checks each claim-bearing item (a title's
 * `support`, later a card's `sourceInfo.evidenceFacts`) the same way.
 *
 * Stages plug in through GROUNDING_COLLECTORS: a collector turns project files
 * into uniform items, and everything downstream is stage-agnostic.
 */

import path from 'node:path';

import { listJsonFilesRecursive, readJsonFile, toPosixRelative } from './deck-fs.mjs';
import { collectEvidence } from './evidence-store.mjs';

export const GROUNDING_STAGES = ['titles', 'cards'];

/** Problem codes reported by checkGroundedItem / runGroundCheck. */
export const GROUNDING_PROBLEMS = {
    missingSupport: 'missing-support',
    malformedPointer: 'malformed-pointer',
    unknownRecord: 'unknown-record',
    unacceptedRecord: 'unaccepted-record',
    factOutOfRange: 'fact-out-of-range',
    emptyFact: 'empty-fact',
    duplicatePointer: 'duplicate-pointer',
    notInEvidenceRefs: 'not-in-evidence-refs',
    invalidBatchFile: 'invalid-batch-file',
};

// Scope is a slug, so the first '/' ends it; the index is anchored to the last
// '#'. Record ids may therefore themselves contain '/' or '#'.
const FACT_POINTER_RE = /^([a-z0-9][a-z0-9-]*)\/(\S(?:.*\S)?)#(0|[1-9]\d*)$/;

/**
 * Parses `<scope>/<recordId>#<factIndex>`. Returns
 * `{ ok: true, scope, recordId, factIndex, key }` (key = `<scope>/<recordId>`,
 * the evidenceRefs form) or `{ ok: false }` for anything malformed.
 */
export function parseFactPointer(pointer) {
    if (typeof pointer !== 'string') return { ok: false };
    const match = FACT_POINTER_RE.exec(pointer);
    if (!match) return { ok: false };
    const [, scope, recordId, index] = match;
    return { ok: true, scope, recordId, factIndex: Number(index), key: `${scope}/${recordId}` };
}

export function formatFactPointer({ scope, recordId, factIndex }) {
    return `${scope}/${recordId}#${factIndex}`;
}

/**
 * Loads every evidence record (any status) as a Map<key, record>, where each
 * record carries `status` and `facts[]` from collectEvidence. Status is kept so
 * resolution can tell an unaccepted record from an unknown one.
 */
export async function loadEvidenceLookup(projectDir) {
    const collected = await collectEvidence(projectDir, {});
    return new Map(collected.records.map(record => [record.key, record]));
}

/**
 * Resolves one pointer against an evidence lookup. Returns
 * `{ ok: true, pointer, key, factIndex, fact }` or
 * `{ ok: false, pointer, problem, detail }`.
 */
export function resolveFactPointer(pointer, evidenceLookup) {
    const parsed = parseFactPointer(pointer);
    const label = typeof pointer === 'string' ? pointer : JSON.stringify(pointer);
    if (!parsed.ok) {
        return { ok: false, pointer: label, problem: GROUNDING_PROBLEMS.malformedPointer, detail: 'expected <scope>/<recordId>#<factIndex> with a 0-based integer index' };
    }
    const record = evidenceLookup.get(parsed.key);
    if (!record) {
        return { ok: false, pointer: label, key: parsed.key, problem: GROUNDING_PROBLEMS.unknownRecord, detail: `no evidence record ${parsed.key}` };
    }
    if (record.status !== 'accepted') {
        return { ok: false, pointer: label, key: parsed.key, problem: GROUNDING_PROBLEMS.unacceptedRecord, detail: `evidence record ${parsed.key} is ${record.status}` };
    }
    const facts = Array.isArray(record.facts) ? record.facts : [];
    if (parsed.factIndex >= facts.length) {
        const detail = facts.length
            ? `${parsed.key} has ${facts.length} fact(s); valid indexes are 0-${facts.length - 1}`
            : `${parsed.key} has no facts`;
        return { ok: false, pointer: label, key: parsed.key, problem: GROUNDING_PROBLEMS.factOutOfRange, detail };
    }
    const fact = facts[parsed.factIndex];
    if (typeof fact !== 'string' || !fact.trim()) {
        return { ok: false, pointer: label, key: parsed.key, problem: GROUNDING_PROBLEMS.emptyFact, detail: `${label} points at an empty fact` };
    }
    return { ok: true, pointer: label, key: parsed.key, factIndex: parsed.factIndex, fact };
}

/**
 * Checks one claim-bearing item: `{ support, evidenceRefs }`. Every pointer
 * must resolve to an accepted fact, and its record must be listed in the
 * item's evidenceRefs. Returns `{ resolved: [...], issues: [...] }`, where
 * issues are `{ pointer, problem, detail }`.
 */
export function checkGroundedItem({ support, evidenceRefs }, evidenceLookup) {
    const resolved = [];
    const issues = [];
    const pointers = Array.isArray(support) ? support : [];
    if (!pointers.length) {
        const detail = support === undefined || support === null
            ? 'support is missing'
            : (Array.isArray(support) ? 'support is empty' : 'support must be an array of pointers');
        issues.push({ pointer: null, problem: GROUNDING_PROBLEMS.missingSupport, detail });
        return { resolved, issues };
    }
    const refs = new Set(Array.isArray(evidenceRefs) ? evidenceRefs.map(String) : []);
    const seen = new Set();
    for (const pointer of pointers) {
        if (typeof pointer === 'string' && seen.has(pointer)) {
            issues.push({ pointer, problem: GROUNDING_PROBLEMS.duplicatePointer, detail: `${pointer} is listed more than once` });
            continue;
        }
        seen.add(pointer);
        const result = resolveFactPointer(pointer, evidenceLookup);
        resolved.push(result);
        if (!result.ok) {
            issues.push({ pointer: result.pointer, problem: result.problem, detail: result.detail });
            continue;
        }
        if (!refs.has(result.key)) {
            issues.push({ pointer: result.pointer, problem: GROUNDING_PROBLEMS.notInEvidenceRefs, detail: `${result.key} is not listed in evidenceRefs` });
        }
    }
    return { resolved, issues };
}

/**
 * Titles collector: one item per title in plans/title-batches/<deck>/*.json.
 * Items carry `ref` (`{ deck, kind, itemId, batch }`, copied onto every issue), the raw `entry`, the
 * claim text, and the support/evidenceRefs to check. Items are emitted in deck,
 * then batch-file, then title order. Unreadable batch files become `fileIssues`.
 */
async function collectTitleItems(state, projectDir, { deckId = '' } = {}) {
    const items = [];
    const fileIssues = [];
    const groups = [];
    for (const deck of state.decks || []) {
        if (deckId && deck.deckId !== deckId) continue;
        const batchDir = path.join(projectDir, 'plans', 'title-batches', deck.deckId);
        for (const batchFile of await listJsonFilesRecursive(batchDir)) {
            const file = toPosixRelative(projectDir, batchFile);
            let batch = null;
            try {
                batch = await readJsonFile(batchFile);
            } catch (e) {
                fileIssues.push({ deck: deck.deckId, kind: 'title', itemId: null, batch: file, pointer: null, problem: GROUNDING_PROBLEMS.invalidBatchFile, detail: `failed to parse JSON. ${e?.message || ''}`.trim() });
                continue;
            }
            const batchId = String(batch?.batchId || path.basename(batchFile, '.json'));
            if (!Array.isArray(batch?.titles)) {
                fileIssues.push({ deck: deck.deckId, kind: 'title', itemId: null, batch: batchId, pointer: null, problem: GROUNDING_PROBLEMS.invalidBatchFile, detail: `${file} has no titles array` });
                continue;
            }
            groups.push({ deck: deck.deckId, batch: batchId, file, count: batch.titles.length });
            for (const title of batch.titles) {
                items.push({
                    ref: { deck: deck.deckId, kind: 'title', itemId: String(title?.id || ''), batch: batchId },
                    entry: title,
                    claim: String(title?.gateIntent ?? ''),
                    support: title?.support,
                    evidenceRefs: title?.evidenceRefs,
                });
            }
        }
    }
    return { items, fileIssues, groups };
}

/**
 * Stage -> collector. Adding a stage means adding a collector that returns
 * `{ items: [{ ref, entry, claim, support, evidenceRefs }], fileIssues: [], groups: [] }`;
 * `groups` (optional) lists the containers items came from, e.g. title batches,
 * so a report can show empty ones.
 */
export const GROUNDING_COLLECTORS = {
    titles: collectTitleItems,
};

/**
 * Runs the grounding check for one stage. Returns
 * `{ stage, items: [{ ...item, resolved, issues }], groups, issues: [{ ...ref, pointer, problem, detail }] }`.
 */
export async function runGroundCheck({ stage, state, projectDir, deckId = '', evidenceLookup = null }) {
    if (!GROUNDING_STAGES.includes(stage)) {
        throw new Error(`Unknown grounding stage: ${JSON.stringify(stage)}. Use ${GROUNDING_STAGES.join('|')}.`);
    }
    const collector = GROUNDING_COLLECTORS[stage];
    if (!collector) {
        throw new Error(`ground check --stage ${stage} is not yet supported.`);
    }
    if (deckId && !(state.decks || []).some(deck => deck.deckId === deckId)) {
        throw new Error(`Unknown deck id: ${JSON.stringify(deckId)}.`);
    }
    const lookup = evidenceLookup || await loadEvidenceLookup(projectDir);
    const { items, fileIssues = [], groups = [] } = await collector(state, projectDir, { deckId });
    const issues = [...fileIssues];
    const checked = items.map((item) => {
        const result = checkGroundedItem(item, lookup);
        for (const issue of result.issues) issues.push({ ...item.ref, ...issue });
        return { ...item, ...result };
    });
    return { stage, items: checked, groups, issues };
}
