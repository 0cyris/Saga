/**
 * Schema v3 Pack Health and repair helpers for Saga Loredecks.
 */

import { hasFiniteContextNumber } from './context-health.js';
import {
    addHealthIssue,
    cleanHealthString,
    clonePlainObject,
    isPlainObject,
} from './loredeck-health-core.js';

const SCHEMA_V3_LEGACY_ENTRY_FIELDS = Object.freeze([
    'date',
    'canonTiming',
    'validFrom',
    'validTo',
    'activeWhen',
    'whoKnowsTruth',
    'whoSuspects',
    'whoBelievesPublicVersion',
    'publicVersion',
    'fact',
]);

const SCHEMA_V3_POSITION_SCOPES = new Set(['anchor', 'window', 'global']);

function addSchemaV3HealthIssue(health, severity, code, message, extra = {}) {
    health.summary.schemaV3IssueCount = (Number(health.summary.schemaV3IssueCount) || 0) + 1;
    addHealthIssue(health, severity, code, message, extra);
}

function isSchemaV3Entry(entry = {}, fileRecord = {}) {
    return Number(entry?.schemaVersion ?? fileRecord?.schemaVersion) >= 3;
}

function hasNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function getSchemaV3EntryLabel(entry = {}) {
    return cleanHealthString(entry.id || entry.title || '(missing id)', 180);
}

export function analyzeSchemaV3EntryHealth(health, entry = {}, fileRecord = {}) {
    if (!isSchemaV3Entry(entry, fileRecord)) return;

    health.summary.schemaV3EntryCount = (Number(health.summary.schemaV3EntryCount) || 0) + 1;
    const id = cleanHealthString(entry?.id, 180);
    const label = getSchemaV3EntryLabel(entry);
    const file = fileRecord.file;
    const entryIds = id ? [id] : [];
    const contextGate = isPlainObject(entry.context) ? entry.context : null;
    const retrieval = isPlainObject(entry.retrieval) ? entry.retrieval : null;
    const content = isPlainObject(entry.content) ? entry.content : {};

    const presentLegacyFields = SCHEMA_V3_LEGACY_ENTRY_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(entry || {}, field));
    if (presentLegacyFields.length) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_legacy_timing_fields', `Schema v3 entry ${label} still has legacy timing fields: ${presentLegacyFields.join(', ')}.`, {
            entryIds,
            file,
            fields: presentLegacyFields,
        });
    }

    if (!contextGate) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context', `Schema v3 entry ${label} is missing a Context block.`, {
            entryIds,
            file,
        });
    } else {
        const scope = cleanHealthString(contextGate.scope, 60);
        if (!SCHEMA_V3_POSITION_SCOPES.has(scope)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_invalid_context_scope', `Schema v3 entry ${label} must declare context.scope as anchor, window, or global.`, {
                entryIds,
                file,
                scope,
            });
        }
        if (!hasFiniteContextNumber(contextGate.sortKeyFrom) || !hasFiniteContextNumber(contextGate.sortKeyTo)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context_sort_keys', `Schema v3 entry ${label} must define numeric context.sortKeyFrom and context.sortKeyTo.`, {
                entryIds,
                file,
            });
        }
        if (!hasNonEmptyString(contextGate.precision)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context_precision', `Schema v3 entry ${label} must define context.precision.`, {
                entryIds,
                file,
            });
        }
        if (!hasNonEmptyString(contextGate.label)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context_label', `Schema v3 entry ${label} must define a human-readable context.label.`, {
                entryIds,
                file,
            });
        }
    }

    if (!retrieval) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_retrieval', `Schema v3 entry ${label} is missing retrieval metadata.`, {
            entryIds,
            file,
        });
    } else {
        const missing = ['activation', 'frequency', 'contextBoost'].filter(field => !hasNonEmptyString(retrieval[field]));
        if (missing.length) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_incomplete_retrieval', `Schema v3 entry ${label} has incomplete retrieval metadata: ${missing.join(', ')}.`, {
                entryIds,
                file,
                fields: missing,
            });
        }
    }

    if (!hasNonEmptyString(content.fact) || !hasNonEmptyString(content.injection)) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_content', `Schema v3 entry ${label} must define content.fact and content.injection.`, {
            entryIds,
            file,
            missingFields: [
                !hasNonEmptyString(content.fact) ? 'content.fact' : '',
                !hasNonEmptyString(content.injection) ? 'content.injection' : '',
            ].filter(Boolean),
        });
    }

    if (contextGate && retrieval) {
        const from = Number(contextGate.sortKeyFrom);
        const to = Number(contextGate.sortKeyTo);
        const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
        const wide = contextGate.scope === 'global'
            || ['series', 'wide'].includes(cleanHealthString(contextGate.windowKind, 80))
            || (span !== null && span >= 365);
        if (wide) {
            const expectedActivation = 'topic_or_entity';
            const actualActivation = cleanHealthString(retrieval.activation, 80);
            if (actualActivation !== expectedActivation) {
                addSchemaV3HealthIssue(health, 'warning', 'schema_v3_wide_lore_retrieval', `Schema v3 wide entry ${label} should use topic/entity activation rather than broad automatic activation.`, {
                    entryIds,
                    file,
                    expected: {
                        activation: expectedActivation,
                    },
                    actual: {
                        activation: actualActivation,
                        frequency: cleanHealthString(retrieval.frequency, 80),
                        contextBoost: cleanHealthString(retrieval.contextBoost, 80),
                    },
                });
            }
        }
    }
}

function schemaV3ContentFact(entry = {}) {
    const content = isPlainObject(entry.content) ? entry.content : {};
    return String(content.fact || entry.fact || entry.description || entry.detail || entry.text || entry.summary || '').trim();
}

function schemaV3ContentInjection(entry = {}, fact = '') {
    const content = isPlainObject(entry.content) ? entry.content : {};
    return String(content.injection || entry.injection || fact || '').trim();
}

export function normalizeLoredeckEntryForSchemaV3(entry = {}) {
    const next = clonePlainObject(entry) || {};
    const fact = schemaV3ContentFact(next);
    const injection = schemaV3ContentInjection(next, fact);
    next.schemaVersion = 3;
    next.content = {
        ...(isPlainObject(next.content) ? next.content : {}),
        fact,
        injection,
    };
    for (const field of SCHEMA_V3_LEGACY_ENTRY_FIELDS) {
        delete next[field];
    }
    return next;
}

export function repairLoredeckEntryForHealth(entry = {}, options = {}) {
    const forceSchemaV3 = options.forceSchemaVersion === 3 || Number(entry?.schemaVersion) >= 3;
    let next = forceSchemaV3 ? normalizeLoredeckEntryForSchemaV3(entry) : (clonePlainObject(entry) || {});
    if (forceSchemaV3) {
        const contextGate = isPlainObject(next.context) ? next.context : {};
        const from = Number(contextGate.sortKeyFrom);
        const to = Number(contextGate.sortKeyTo);
        const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
        const wide = contextGate.scope === 'global'
            || ['series', 'wide'].includes(cleanHealthString(contextGate.windowKind, 80))
            || (span !== null && span >= 365);
        if (wide) {
            next.retrieval = {
                ...(isPlainObject(next.retrieval) ? next.retrieval : {}),
                activation: 'topic_or_entity',
                frequency: 'low',
                contextBoost: 'low',
            };
        }
    }
    return next;
}
