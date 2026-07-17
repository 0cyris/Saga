/**
 * project-state.mjs -- Saga loredeck CLI
 * Owns workshop project.json: creation, validation, stage machine, gate
 * approvals, batch records, and the journal. All CLI writes to project state
 * go through this module so the resume contract stays consistent.
 */

import path from 'node:path';

import {
    isValidSlug,
    nowIso,
    pathExists,
    readJsonFile,
    resolveProjectDir,
    writeJsonFile,
} from './deck-fs.mjs';

export const PROJECT_STAGES = [
    'intake',
    'scope_brief',
    'evidence',
    'planning',
    'titles',
    'cards',
    'health',
    'package',
    'complete',
];

export const GATE_BY_STAGE = {
    intake: 'intent_confirmed',
    scope_brief: 'scope_brief_approved',
    evidence: 'evidence_accepted',
    planning: 'context_plan_approved',
    titles: 'titles_approved',
    cards: 'cards_approved',
    health: 'health_report_accepted',
    package: 'final_package_signed_off',
};

export const DECK_ROLES = ['core', 'era', 'standalone'];
const JOURNAL_LIMIT = 100;

export function projectStatePath(projectId) {
    return path.join(resolveProjectDir(projectId), 'project.json');
}

export function createProjectState({ projectId, title, canonSize = 'single', continuity = {}, decks = [] }) {
    if (!isValidSlug(projectId)) {
        throw new Error(`Invalid project id: ${JSON.stringify(projectId)}.`);
    }
    if (!['single', 'family'].includes(canonSize)) {
        throw new Error(`Invalid canon size: ${JSON.stringify(canonSize)}. Use "single" or "family".`);
    }
    const deckRecords = (decks.length ? decks : [{ deckId: projectId, role: canonSize === 'single' ? 'standalone' : 'core' }])
        .map((deck) => {
            const deckId = String(deck.deckId || '').trim();
            if (!isValidSlug(deckId)) throw new Error(`Invalid deck id: ${JSON.stringify(deck.deckId)}.`);
            return {
                deckId,
                role: DECK_ROLES.includes(deck.role) ? deck.role : 'era',
                stage: 'pending',
            };
        });
    const deckIds = deckRecords.map(deck => deck.deckId);
    if (new Set(deckIds).size !== deckIds.length) {
        throw new Error('Deck ids must be unique.');
    }
    const timestamp = nowIso();
    return {
        schemaVersion: 1,
        projectId,
        title: String(title || projectId),
        canonSize,
        continuity: {
            continuityId: String(continuity.continuityId || ''),
            canonTier: String(continuity.canonTier || 'primary'),
            adaptation: String(continuity.adaptation || ''),
        },
        decks: deckRecords,
        stage: 'intake',
        gates: [],
        evidence: { scopes: [], acceptedCount: 0, pendingCount: 0, rejectedCount: 0 },
        batches: {},
        counts: { draftCards: 0, promotedCards: 0 },
        journal: [{ at: timestamp, event: 'project_created', detail: `Canon size: ${canonSize}. Decks: ${deckIds.join(', ')}.` }],
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export function validateProjectState(state) {
    const issues = [];
    if (!state || typeof state !== 'object' || Array.isArray(state)) return ['Project state is not an object.'];
    if (state.schemaVersion !== 1) issues.push(`Unsupported project schemaVersion: ${state.schemaVersion}.`);
    if (!isValidSlug(state.projectId)) issues.push(`Invalid projectId: ${JSON.stringify(state.projectId)}.`);
    if (!PROJECT_STAGES.includes(state.stage)) issues.push(`Unknown stage: ${JSON.stringify(state.stage)}.`);
    if (!Array.isArray(state.decks) || !state.decks.length) issues.push('Project has no decks.');
    for (const deck of state.decks || []) {
        if (!isValidSlug(deck?.deckId)) issues.push(`Invalid deck id: ${JSON.stringify(deck?.deckId)}.`);
    }
    if (!Array.isArray(state.gates)) issues.push('gates must be an array.');
    return issues;
}

export async function loadProjectState(projectId) {
    const statePath = projectStatePath(projectId);
    if (!(await pathExists(statePath))) {
        throw new Error(`No workshop project found for ${JSON.stringify(projectId)} (missing ${statePath}).`);
    }
    const state = await readJsonFile(statePath);
    const issues = validateProjectState(state);
    if (issues.length) {
        throw new Error(`Project state is invalid for ${projectId}: ${issues.join(' ')}`);
    }
    return state;
}

export async function saveProjectState(state) {
    const issues = validateProjectState(state);
    if (issues.length) {
        throw new Error(`Refusing to save invalid project state: ${issues.join(' ')}`);
    }
    state.updatedAt = nowIso();
    if (Array.isArray(state.journal) && state.journal.length > JOURNAL_LIMIT) {
        state.journal = state.journal.slice(-JOURNAL_LIMIT);
    }
    await writeJsonFile(projectStatePath(state.projectId), state);
    return state;
}

export function appendJournal(state, event, detail = '') {
    if (!Array.isArray(state.journal)) state.journal = [];
    state.journal.push({ at: nowIso(), event: String(event), detail: String(detail) });
}

export function nextStage(stage) {
    const index = PROJECT_STAGES.indexOf(stage);
    if (index < 0 || index >= PROJECT_STAGES.length - 1) return null;
    return PROJECT_STAGES[index + 1];
}

/**
 * Coerces a deck's stage to a PROJECT_STAGES position for per-deck gate
 * arithmetic. Decks predate this being a real stage machine: deck.stage was
 * only ever 'pending' (default) or 'promoted' (set by promote.mjs), neither
 * of which is a PROJECT_STAGES value, so any unrecognized value starts a
 * deck's per-deck walk from 'intake' rather than throwing.
 */
export function deckStageIndex(stage) {
    const index = PROJECT_STAGES.indexOf(stage);
    return index >= 0 ? index : 0;
}

export function approveGate(state, { note = '', artifact = '', deckId = '' } = {}) {
    if (deckId) {
        const deck = (state.decks || []).find(item => item.deckId === deckId);
        if (!deck) throw new Error(`Unknown deck id: ${JSON.stringify(deckId)}.`);
        const deckStage = PROJECT_STAGES[deckStageIndex(deck.stage)];
        const gate = GATE_BY_STAGE[deckStage];
        if (!gate) {
            throw new Error(`Deck ${deckId} is at stage ${JSON.stringify(deckStage)}, which has no gate to approve.`);
        }
        const target = nextStage(deckStage);
        if (!target) {
            throw new Error(`Deck ${deckId} is at stage ${JSON.stringify(deckStage)} and cannot advance.`);
        }
        state.gates.push({ gate, stage: deckStage, approvedAt: nowIso(), artifact: String(artifact || ''), note: String(note || ''), deckId });
        appendJournal(state, 'gate_approved', `${deckId}: ${gate} -> ${target}`);
        deck.stage = target;
        return state;
    }
    const gate = GATE_BY_STAGE[state.stage];
    if (!gate) {
        throw new Error(`Stage ${JSON.stringify(state.stage)} has no gate to approve.`);
    }
    const target = nextStage(state.stage);
    if (!target) {
        throw new Error(`Stage ${JSON.stringify(state.stage)} cannot advance.`);
    }
    state.gates.push({ gate, stage: state.stage, approvedAt: nowIso(), artifact: String(artifact || ''), note: String(note || '') });
    appendJournal(state, 'gate_approved', `${gate} -> ${target}`);
    state.stage = target;
    return state;
}

export function setStage(state, stage) {
    if (!PROJECT_STAGES.includes(stage)) {
        throw new Error(`Unknown stage: ${JSON.stringify(stage)}.`);
    }
    const from = PROJECT_STAGES.indexOf(state.stage);
    const to = PROJECT_STAGES.indexOf(stage);
    if (to > from + 1) {
        throw new Error(`Cannot jump from ${state.stage} to ${stage}; advance through gates instead.`);
    }
    appendJournal(state, 'stage_set', `${state.stage} -> ${stage}`);
    state.stage = stage;
    return state;
}

export function setDeckStage(state, deckId, stage) {
    const deck = (state.decks || []).find(item => item.deckId === deckId);
    if (!deck) throw new Error(`Unknown deck id: ${JSON.stringify(deckId)}.`);
    deck.stage = String(stage || 'pending');
    appendJournal(state, 'deck_stage_set', `${deckId}: ${deck.stage}`);
    return state;
}

export function addDeckToState(state, { deckId, role }) {
    const cleanDeckId = String(deckId || '').trim();
    if (!isValidSlug(cleanDeckId)) throw new Error(`Invalid deck id: ${JSON.stringify(deckId)}.`);
    if ((state.decks || []).some(deck => deck.deckId === cleanDeckId)) {
        throw new Error(`Deck id already exists in this project: ${JSON.stringify(cleanDeckId)}.`);
    }
    const deck = { deckId: cleanDeckId, role: DECK_ROLES.includes(role) ? role : 'era', stage: 'pending' };
    if (!Array.isArray(state.decks)) state.decks = [];
    state.decks.push(deck);
    appendJournal(state, 'deck_added_to_state', `${deck.deckId} (${deck.role})`);
    return deck;
}

export function setBatchStatus(state, { deckId, kind, batchId, status, count = null }) {
    if (!['titles', 'cards'].includes(kind)) {
        throw new Error(`Unknown batch kind: ${JSON.stringify(kind)}. Use "titles" or "cards".`);
    }
    if (!['draft', 'approved', 'rejected'].includes(status)) {
        throw new Error(`Unknown batch status: ${JSON.stringify(status)}.`);
    }
    if (!(state.decks || []).some(deck => deck.deckId === deckId)) {
        throw new Error(`Unknown deck id: ${JSON.stringify(deckId)}.`);
    }
    if (!state.batches || typeof state.batches !== 'object') state.batches = {};
    if (!state.batches[deckId]) state.batches[deckId] = { titles: [], cards: [] };
    const list = state.batches[deckId][kind];
    const existing = list.find(batch => batch.id === batchId);
    if (existing) {
        existing.status = status;
        if (Number.isFinite(Number(count)) && count !== null) existing.count = Number(count);
        existing.updatedAt = nowIso();
    } else {
        list.push({
            id: String(batchId),
            status,
            ...(Number.isFinite(Number(count)) && count !== null ? { count: Number(count) } : {}),
            updatedAt: nowIso(),
        });
    }
    appendJournal(state, 'batch_status_set', `${deckId}/${kind}/${batchId}: ${status}`);
    return state;
}

export function summarizeProjectState(state) {
    return {
        projectId: state.projectId,
        title: state.title,
        canonSize: state.canonSize,
        stage: state.stage,
        gate: GATE_BY_STAGE[state.stage] || null,
        decks: (state.decks || []).map(deck => ({ deckId: deck.deckId, role: deck.role, stage: deck.stage })),
        gatesApproved: (state.gates || []).map(gate => gate.gate),
        gates: (state.gates || []).map(gate => ({
            gate: gate.gate,
            stage: gate.stage,
            deckId: gate.deckId || null,
            approvedAt: gate.approvedAt,
            note: gate.note,
        })),
        evidence: state.evidence || {},
        batches: state.batches || {},
        counts: state.counts || {},
        updatedAt: state.updatedAt,
    };
}
