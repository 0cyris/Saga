/**
 * Continuity state normalization, delta validation, and delta application.
 */

import { getDefaultState } from './constants.js';

function mergeDefaults(target, defaults) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
        return { ...defaults };
    }
    const result = { ...target };
    for (const key of Object.keys(defaults)) {
        if (result[key] === undefined || result[key] === null) {
            result[key] = defaults[key];
        }
    }
    return result;
}

const RETIRED_CONTINUITY_CONFIG_KEYS = ['knowledge', 'secrets', 'relationships', 'flags', 'storyMilestones'];
const ACTIVE_CONTINUITY_CHANGE_KEYS = ['canon', 'scene', 'characters', 'inventory', 'objectives', 'threads'];

export function disableRetiredContinuitySections(state) {
    if (!state || typeof state !== 'object') return state;
    if (!state.continuityConfig || typeof state.continuityConfig !== 'object' || Array.isArray(state.continuityConfig)) {
        state.continuityConfig = {};
    }
    for (const key of RETIRED_CONTINUITY_CONFIG_KEYS) {
        state.continuityConfig[key] = false;
    }
    return state;
}

export function normalizeCompressionStatusNumbers(status) {
    if (!status || typeof status !== 'object') return;
    for (const key of [
        'lastCompressedAt',
        'lastTokenEstimate',
        'lastCharacterCount',
        'lastDirectTokenEstimate',
        'lastDirectCharacterCount',
        'lastTargetTokenEstimate',
        'lastTargetCharacterCount',
        'lastHardTokenLimit',
        'lastHardCharacterLimit',
        'lastCompressionRatio',
        'lastCompressionAttemptCount',
        'lastCompressionSelectedAttempt',
        'lastCompressionScore',
        'turnsSinceCompression',
        'lastChatLength',
    ]) {
        status[key] = Number.isFinite(Number(status[key])) ? Number(status[key]) : 0;
    }
}


// ── Continuity structure helpers ───────────────────────────────────────────────

export function normalizeContinuityStructure(state) {
    const defaults = getDefaultState();

    if (!state.continuityConfig || typeof state.continuityConfig !== 'object' || Array.isArray(state.continuityConfig)) {
        state.continuityConfig = { ...defaults.continuityConfig };
    } else {
        state.continuityConfig = { ...defaults.continuityConfig, ...state.continuityConfig };
        for (const key of Object.keys(defaults.continuityConfig)) {
            state.continuityConfig[key] = state.continuityConfig[key] !== false;
        }
    }
    disableRetiredContinuitySections(state);

    if (!state.scene || typeof state.scene !== 'object' || Array.isArray(state.scene)) {
        state.scene = { ...defaults.scene };
    } else {
        state.scene = { ...defaults.scene, ...state.scene };
        state.scene.presentCharacters = Array.isArray(state.scene.presentCharacters) ? state.scene.presentCharacters.filter(Boolean).map(String) : [];
        state.scene.nearbyCharacters = Array.isArray(state.scene.nearbyCharacters) ? state.scene.nearbyCharacters.filter(Boolean).map(String) : [];
    }

    if (!state.storyMilestones || typeof state.storyMilestones !== 'object' || Array.isArray(state.storyMilestones)) {
        state.storyMilestones = {};
    } else {
        state.storyMilestones = Object.fromEntries(Object.entries(state.storyMilestones).map(([id, value]) => [String(id), normalizeStoryMilestone(value)]));
    }

    normalizeStateEntries(state);

    if (!state.continuityCompressionStatus || typeof state.continuityCompressionStatus !== 'object') {
        state.continuityCompressionStatus = getDefaultState().continuityCompressionStatus;
    } else {
        const defaults = getDefaultState().continuityCompressionStatus;
        state.continuityCompressionStatus = mergeDefaults(state.continuityCompressionStatus, defaults);
        normalizeCompressionStatusNumbers(state.continuityCompressionStatus);
    }
}

function isSectionEnabled(state, section) {
    return state?.continuityConfig?.[section] !== false;
}

function applyArrayDelta(target, patch, identityKey, normalizer) {
    if (!Array.isArray(target) || !patch || typeof patch !== 'object') return;

    if (Array.isArray(patch.added)) {
        for (const item of patch.added) {
            target.push(normalizer(item));
        }
    }

    if (Array.isArray(patch.updated)) {
        for (const upd of patch.updated) {
            let idx = Number.isInteger(upd.index) ? upd.index : -1;
            if (idx < 0 && upd[identityKey]) {
                const wanted = String(upd[identityKey]).toLowerCase();
                idx = target.findIndex(item => String(item?.[identityKey] || '').toLowerCase() === wanted);
            }
            if (idx >= 0 && idx < target.length) {
                const merged = { ...target[idx], ...(upd.changes || {}) };
                if (upd.changes?.emotionalState && target[idx]?.emotionalState) {
                    merged.emotionalState = {
                        ...target[idx].emotionalState,
                        ...upd.changes.emotionalState,
                        lastUpdatedAt: Date.now(),
                        lastUpdatedChatLength: getCurrentChatLength(),
                    };
                }
                target[idx] = normalizer(merged);
            }
        }
    }

    if (Array.isArray(patch.removed)) {
        const removals = new Set();
        for (const raw of patch.removed) {
            if (Number.isInteger(raw)) {
                removals.add(raw);
            } else if (typeof raw === 'string') {
                const wanted = raw.toLowerCase();
                const idx = target.findIndex(item => String(item?.[identityKey] || '').toLowerCase() === wanted);
                if (idx >= 0) removals.add(idx);
            }
        }
        const sorted = [...removals].sort((a, b) => b - a);
        for (const idx of sorted) {
            if (idx >= 0 && idx < target.length) target.splice(idx, 1);
        }
    }
}

function sanitizeCharacterPatchForConfig(patch, state) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;

    const appearanceEnabled = isSectionEnabled(state, 'appearance');
    const emotionalStateEnabled = isSectionEnabled(state, 'emotionalState');
    if (appearanceEnabled && emotionalStateEnabled) return patch;

    const sanitized = { ...patch };
    const sanitizeCharacter = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
        const next = { ...raw };
        if (!appearanceEnabled) delete next.clothing;
        if (!emotionalStateEnabled) delete next.emotionalState;
        return next;
    };
    const sanitizeUpdate = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
        const next = { ...raw };
        if (next.changes && typeof next.changes === 'object' && !Array.isArray(next.changes)) {
            next.changes = sanitizeCharacter(next.changes);
        }
        return next;
    };

    if (Array.isArray(sanitized.added)) sanitized.added = sanitized.added.map(sanitizeCharacter);
    if (Array.isArray(sanitized.updated)) sanitized.updated = sanitized.updated.map(sanitizeUpdate);
    return sanitized;
}

function clampEmotion(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-5, Math.min(5, Math.round(n)));
}

function clampConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
}

function normalizeEmotionalState(raw = {}) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        affection: clampEmotion(src.affection),
        trust: clampEmotion(src.trust),
        desire: clampEmotion(src.desire),
        connection: clampEmotion(src.connection),
        fear: clampEmotion(src.fear),
        anger: clampEmotion(src.anger),
        sadness: clampEmotion(src.sadness),
        joy: clampEmotion(src.joy),
        notes: typeof src.notes === 'string' ? src.notes : '',
        confidence: clampConfidence(src.confidence),
        lastUpdatedAt: Number.isFinite(Number(src.lastUpdatedAt)) ? Number(src.lastUpdatedAt) : Date.now(),
        lastUpdatedChatLength: Number.isFinite(Number(src.lastUpdatedChatLength)) ? Number(src.lastUpdatedChatLength) : getCurrentChatLength(),
    };
}

function getCurrentChatLength() {
    try {
        const ctx = SillyTavern.getContext();
        return Array.isArray(ctx?.chat) ? ctx.chat.length : 0;
    } catch (_) {
        return 0;
    }
}

function normalizeCharacter(raw = {}) {
    const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const emotionalState = normalizeEmotionalState(c.emotionalState || {});
    return {
        name: typeof c.name === 'string' ? c.name.trim() : '',
        aliases: Array.isArray(c.aliases) ? c.aliases.filter(Boolean).map(String) : [],
        role: typeof c.role === 'string' ? c.role : '',
        location: typeof c.location === 'string' ? c.location : '',
        clothing: typeof c.clothing === 'string' ? c.clothing : '',
        posture: typeof c.posture === 'string' ? c.posture : '',
        physicalState: typeof c.physicalState === 'string' ? c.physicalState : '',
        emotionalState,
        inventory: Array.isArray(c.inventory) ? c.inventory.filter(Boolean).map(String) : [],
        goals: Array.isArray(c.goals) ? c.goals.filter(Boolean).map(String) : [],
        notes: typeof c.notes === 'string' ? c.notes : '',
    };
}

function normalizeInventoryItem(raw = {}) {
    const item = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        owner: typeof item.owner === 'string' ? item.owner : '',
        item: typeof item.item === 'string' ? item.item : '',
        status: typeof item.status === 'string' ? item.status : '',
        location: typeof item.location === 'string' ? item.location : '',
        notes: typeof item.notes === 'string' ? item.notes : '',
    };
}

function normalizeObjective(raw = {}) {
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const allowed = new Set(['active', 'blocked', 'completed', 'abandoned']);
    return {
        owner: typeof obj.owner === 'string' ? obj.owner : '',
        goal: typeof obj.goal === 'string' ? obj.goal : '',
        status: allowed.has(obj.status) ? obj.status : 'active',
        stakes: typeof obj.stakes === 'string' ? obj.stakes : '',
        notes: typeof obj.notes === 'string' ? obj.notes : '',
    };
}

function normalizeStoryMilestone(raw = {}) {
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const allowed = new Set(['not_happened', 'suspected', 'happened', 'blocked', 'diverged', 'unknown']);
    return {
        status: allowed.has(obj.status) ? obj.status : 'unknown',
        happenedAtStoryDate: typeof obj.happenedAtStoryDate === 'string' ? obj.happenedAtStoryDate : '',
        happenedAtTurn: Number.isFinite(Number(obj.happenedAtTurn)) ? Number(obj.happenedAtTurn) : 0,
        evidence: Array.isArray(obj.evidence) ? obj.evidence.filter(x => typeof x === 'string') : [],
        confidence: Number.isFinite(Number(obj.confidence)) ? Math.max(0, Math.min(1, Number(obj.confidence))) : 0,
        notes: typeof obj.notes === 'string' ? obj.notes : '',
    };
}

// ── Delta validation ────────────────────────────────────────────────────────────

/** Valid enum values for validation */
const VALID_ENUMS = {
    tension: new Set(['low', 'medium', 'high', 'critical']),
    trust: new Set(['low', 'medium', 'high', 'absolute']),
    threadStatus: new Set(['active', 'dormant', 'resolved']),
    flagType: new Set(['contradiction', 'uncertainty', 'warning']),
    flagSeverity: new Set(['low', 'medium', 'high']),
};

/** Known top-level change keys */
const KNOWN_CHANGE_KEYS = new Set(ACTIVE_CONTINUITY_CHANGE_KEYS);

/**
 * Validates a SagaDelta against the schema.
 * @param {Object} delta - The delta to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDelta(delta) {
    const errors = [];

    if (!delta || typeof delta !== 'object') {
        return { valid: false, errors: ['Delta must be an object'] };
    }

    // Empty changes is valid (no-op delta)
    if (!delta.changes) {
        return { valid: false, errors: ['Delta must have a "changes" key'] };
    }

    if (typeof delta.changes !== 'object' || Array.isArray(delta.changes)) {
        return { valid: false, errors: ['Delta.changes must be an object'] };
    }

    // Accept empty changes as a valid no-op
    if (Object.keys(delta.changes).length === 0) {
        return { valid: true, errors: [] };
    }

    const changes = delta.changes;

    // Check for unknown change keys
    for (const key of Object.keys(changes)) {
        if (!KNOWN_CHANGE_KEYS.has(key)) {
            errors.push(`Unknown change key: "${key}"`);
        }
    }

    // Validate scene sub-fields with deep structural assertions
    if (changes.scene && typeof changes.scene === 'object') {
        // Type-check presentCharacters
        if (changes.scene.presentCharacters !== undefined) {
            if (!Array.isArray(changes.scene.presentCharacters)) {
                errors.push('scene.presentCharacters must be an array');
            } else {
                for (let i = 0; i < changes.scene.presentCharacters.length; i++) {
                    if (typeof changes.scene.presentCharacters[i] !== 'string') {
                        errors.push(`scene.presentCharacters[${i}] must be a string`);
                    }
                }
            }
        }
        // Type-check nearbyCharacters
        if (changes.scene.nearbyCharacters !== undefined) {
            if (!Array.isArray(changes.scene.nearbyCharacters)) {
                errors.push('scene.nearbyCharacters must be an array');
            } else {
                for (let i = 0; i < changes.scene.nearbyCharacters.length; i++) {
                    if (typeof changes.scene.nearbyCharacters[i] !== 'string') {
                        errors.push(`scene.nearbyCharacters[${i}] must be a string`);
                    }
                }
            }
        }
    }

    // Validate knowledge (character key -> array of strings)
    if (changes.knowledge && typeof changes.knowledge === 'object' && !Array.isArray(changes.knowledge)) {
        for (const [char, facts] of Object.entries(changes.knowledge)) {
            if (!Array.isArray(facts)) {
                errors.push(`knowledge.${char} must be an array of strings`);
            } else {
                for (let i = 0; i < facts.length; i++) {
                    if (typeof facts[i] !== 'string') {
                        errors.push(`knowledge.${char}[${i}] must be a string`);
                    }
                }
            }
        }
    } else if (changes.knowledge !== undefined && (typeof changes.knowledge !== 'object' || Array.isArray(changes.knowledge))) {
        errors.push('knowledge must be a character-keyed object');
    }

    // Validate secrets
    if (changes.secrets && typeof changes.secrets === 'object') {
        ['added', 'updated', 'removed'].forEach(op => {
            if (changes.secrets[op] !== undefined) {
                if (!Array.isArray(changes.secrets[op])) {
                    errors.push(`secrets.${op} must be an array`);
                } else if (op === 'updated') {
                    changes.secrets.updated.forEach((upd, i) => {
                        if (!Number.isInteger(upd.index) || upd.index < 0) {
                            errors.push(`secrets.updated[${i}].index must be a nonnegative integer`);
                        }
                        if (upd.changes === undefined || upd.changes === null || typeof upd.changes !== 'object' || Array.isArray(upd.changes)) {
                            errors.push(`secrets.updated[${i}].changes must be a non-null object`);
                        }
                    });
                } else if (op === 'removed') {
                    changes.secrets.removed.forEach((idx, i) => {
                        if (!Number.isInteger(idx) || idx < 0) {
                            errors.push(`secrets.removed[${i}] must be a nonnegative integer`);
                        }
                    });
                }
            }
        });
    } else if (changes.secrets !== undefined) {
        errors.push('secrets must be an object with added/updated/removed arrays');
    }

    // Validate relationships
    if (changes.relationships && typeof changes.relationships === 'object') {
        ['added', 'updated', 'removed'].forEach(op => {
            if (changes.relationships[op] !== undefined) {
                if (!Array.isArray(changes.relationships[op])) {
                    errors.push(`relationships.${op} must be an array`);
                } else if (op === 'added') {
                    changes.relationships.added.forEach((rel, i) => {
                        if (rel.tension !== undefined && !VALID_ENUMS.tension.has(rel.tension)) {
                            errors.push(`relationships.added[${i}].tension "${rel.tension}" must be low|medium|high|critical`);
                        }
                        if (rel.trust !== undefined && !VALID_ENUMS.trust.has(rel.trust)) {
                            errors.push(`relationships.added[${i}].trust "${rel.trust}" must be low|medium|high|absolute`);
                        }
                    });
                } else if (op === 'updated') {
                    changes.relationships.updated.forEach((upd, i) => {
                        if (!Number.isInteger(upd.index) || upd.index < 0) {
                            errors.push(`relationships.updated[${i}].index must be a nonnegative integer`);
                        }
                        // Validate enum values in the changes sub-object
                        if (upd.changes && typeof upd.changes === 'object') {
                            if (upd.changes.tension !== undefined && !VALID_ENUMS.tension.has(upd.changes.tension)) {
                                errors.push(`relationships.updated[${i}].changes.tension "${upd.changes.tension}" must be low|medium|high|critical`);
                            }
                            if (upd.changes.trust !== undefined && !VALID_ENUMS.trust.has(upd.changes.trust)) {
                                errors.push(`relationships.updated[${i}].changes.trust "${upd.changes.trust}" must be low|medium|high|absolute`);
                            }
                        }
                    });
                } else if (op === 'removed') {
                    changes.relationships.removed.forEach((idx, i) => {
                        if (!Number.isInteger(idx) || idx < 0) {
                            errors.push(`relationships.removed[${i}] must be a nonnegative integer`);
                        }
                    });
                }
            }
        });
    } else if (changes.relationships !== undefined) {
        errors.push('relationships must be an object with added/updated/removed arrays');
    }

    // Validate threads
    if (changes.threads && typeof changes.threads === 'object') {
        ['added', 'updated'].forEach(op => {
            if (changes.threads[op] !== undefined) {
                if (!Array.isArray(changes.threads[op])) {
                    errors.push(`threads.${op} must be an array`);
                } else if (op === 'added') {
                    changes.threads.added.forEach((t, i) => {
                        if (t.status !== undefined && !VALID_ENUMS.threadStatus.has(t.status)) {
                            errors.push(`threads.added[${i}].status "${t.status}" must be active|dormant|resolved`);
                        }
                    });
                } else if (op === 'updated') {
                    changes.threads.updated.forEach((upd, i) => {
                        if (!Number.isInteger(upd.index) || upd.index < 0) {
                            errors.push(`threads.updated[${i}].index must be a nonnegative integer`);
                        }
                        // Validate enum values in the changes sub-object
                        if (upd.changes && typeof upd.changes === 'object') {
                            if (upd.changes.status !== undefined && !VALID_ENUMS.threadStatus.has(upd.changes.status)) {
                                errors.push(`threads.updated[${i}].changes.status "${upd.changes.status}" must be active|dormant|resolved`);
                            }
                        }
                    });
                }
            }
        });
    } else if (changes.threads !== undefined) {
        errors.push('threads must be an object with added/updated arrays');
    }

    // Validate continuityFlags
    if (changes.continuityFlags && typeof changes.continuityFlags === 'object') {
        if (changes.continuityFlags.added !== undefined) {
            if (!Array.isArray(changes.continuityFlags.added)) {
                errors.push('continuityFlags.added must be an array');
            } else {
                changes.continuityFlags.added.forEach((f, i) => {
                    if (f.type !== undefined && !VALID_ENUMS.flagType.has(f.type)) {
                        errors.push(`continuityFlags.added[${i}].type "${f.type}" must be contradiction|uncertainty|warning`);
                    }
                    if (f.severity !== undefined && !VALID_ENUMS.flagSeverity.has(f.severity)) {
                        errors.push(`continuityFlags.added[${i}].severity "${f.severity}" must be low|medium|high`);
                    }
                });
            }
        }
        if (changes.continuityFlags.resolved !== undefined) {
            if (!Array.isArray(changes.continuityFlags.resolved)) {
                errors.push('continuityFlags.resolved must be an array');
            } else {
                changes.continuityFlags.resolved.forEach((idx, i) => {
                    if (!Number.isInteger(idx) || idx < 0) {
                        errors.push(`continuityFlags.resolved[${i}] must be a nonnegative integer`);
                    }
                });
            }
        }
    } else if (changes.continuityFlags !== undefined) {
        errors.push('continuityFlags must be an object with added/resolved arrays');
    }

    if (changes.storyMilestones && typeof changes.storyMilestones === 'object' && !Array.isArray(changes.storyMilestones)) {
        const allowed = new Set(['not_happened', 'suspected', 'happened', 'blocked', 'diverged', 'unknown']);
        for (const [id, value] of Object.entries(changes.storyMilestones)) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                errors.push(`storyMilestones.${id} must be an object`);
                continue;
            }
            if (value.status !== undefined && !allowed.has(value.status)) {
                errors.push(`storyMilestones.${id}.status must be not_happened|suspected|happened|blocked|diverged|unknown`);
            }
            if (value.evidence !== undefined && !Array.isArray(value.evidence)) {
                errors.push(`storyMilestones.${id}.evidence must be an array`);
            }
        }
    } else if (changes.storyMilestones !== undefined) {
        errors.push('storyMilestones must be an object keyed by milestone id');
    }

    return { valid: errors.length === 0, errors };
}

// ── Delta application ───────────────────────────────────────────────────────────

/**
 * Deep-merges a validated SagaDelta into the current SagaState.
 * Returns a new state object — does not mutate the input.
 *
 * @param {Object} state - Current SagaState
 * @param {Object} delta - Validated SagaDelta to apply
 * @returns {Object} New SagaState
 */
export function applyDelta(state, delta) {
    if (!delta || !delta.changes) return state;

    // Shallow clone top level
    const next = {
        ...state,
        canon: { ...state.canon, divergences: [...(state.canon.divergences || [])] },
        scene: { ...state.scene, presentCharacters: [...(state.scene.presentCharacters || [])], nearbyCharacters: [...(state.scene.nearbyCharacters || [])] },
        continuityConfig: { ...(state.continuityConfig || {}) },
        characters: [...(state.characters || [])],
        inventory: [...(state.inventory || [])],
        objectives: [...(state.objectives || [])],
        knowledge: { ...state.knowledge },
        secrets: [...(state.secrets || [])],
        relationships: [...(state.relationships || [])],
        threads: [...(state.threads || [])],
        continuityFlags: [...(state.continuityFlags || [])],
        storyMilestones: { ...(state.storyMilestones || {}) },
        lastDelta: delta,
    };

    const changes = delta.changes;

    // Canon block — shallow merge
    if (isSectionEnabled(next, 'canon') && changes.canon) {
        if (changes.canon.era !== undefined) next.canon.era = changes.canon.era;
        if (changes.canon.inUniverseDate !== undefined) next.canon.inUniverseDate = changes.canon.inUniverseDate;
        if (changes.canon.canonBoundary !== undefined) next.canon.canonBoundary = changes.canon.canonBoundary;
        if (Array.isArray(changes.canon.divergences)) {
            next.canon.divergences = changes.canon.divergences;
        }
    }

    // Scene block — shallow merge
    if (isSectionEnabled(next, 'scene') && changes.scene) {
        if (changes.scene.location !== undefined) next.scene.location = changes.scene.location;
        if (changes.scene.timeOfDay !== undefined) next.scene.timeOfDay = changes.scene.timeOfDay;
        if (isSectionEnabled(next, 'scene') && changes.scene.weather !== undefined) next.scene.weather = changes.scene.weather;
        if (isSectionEnabled(next, 'scene') && changes.scene.ambience !== undefined) next.scene.ambience = changes.scene.ambience;
        if (Array.isArray(changes.scene.presentCharacters)) {
            next.scene.presentCharacters = changes.scene.presentCharacters;
        }
        if (Array.isArray(changes.scene.nearbyCharacters)) {
            next.scene.nearbyCharacters = changes.scene.nearbyCharacters;
        }
        if (changes.scene.currentActivity !== undefined) next.scene.currentActivity = changes.scene.currentActivity;
    }

    // Characters — add/update/remove by name or index
    if (isSectionEnabled(next, 'characters') && changes.characters) {
        applyArrayDelta(next.characters, sanitizeCharacterPatchForConfig(changes.characters, next), 'name', normalizeCharacter);
    }

    // Inventory — add/update/remove by index
    if (isSectionEnabled(next, 'inventory') && changes.inventory) {
        applyArrayDelta(next.inventory, changes.inventory, 'item', normalizeInventoryItem);
    }

    // Objectives — add/update/remove by index
    if (isSectionEnabled(next, 'objectives') && changes.objectives) {
        applyArrayDelta(next.objectives, changes.objectives, 'goal', normalizeObjective);
    }

    // Knowledge — character-keyed, merge arrays per character
    if (isSectionEnabled(next, 'knowledge') && changes.knowledge) {
        for (const [char, facts] of Object.entries(changes.knowledge)) {
            if (!Array.isArray(facts)) continue;
            const existing = next.knowledge[char] || [];
            const merged = [...existing];
            for (const fact of facts) {
                if (!merged.includes(fact)) merged.push(fact);
            }
            next.knowledge[char] = merged;
        }
    }

    // Secrets — add/update/remove pattern
    if (isSectionEnabled(next, 'secrets') && changes.secrets) {
        if (Array.isArray(changes.secrets.added)) {
            next.secrets.push(...changes.secrets.added);
        }
        if (Array.isArray(changes.secrets.updated)) {
            for (const upd of changes.secrets.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.secrets.length) {
                    next.secrets[idx] = { ...next.secrets[idx], ...upd.changes };
                }
            }
        }
        if (Array.isArray(changes.secrets.removed)) {
            const sorted = [...changes.secrets.removed].sort((a, b) => b - a);
            for (const idx of sorted) {
                if (idx >= 0 && idx < next.secrets.length) {
                    next.secrets.splice(idx, 1);
                }
            }
        }
    }

    // Relationships — add/update/remove pattern
    if (isSectionEnabled(next, 'relationships') && changes.relationships) {
        if (Array.isArray(changes.relationships.added)) {
            next.relationships.push(...changes.relationships.added);
        }
        if (Array.isArray(changes.relationships.updated)) {
            for (const upd of changes.relationships.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.relationships.length) {
                    next.relationships[idx] = { ...next.relationships[idx], ...upd.changes };
                }
            }
        }
        if (Array.isArray(changes.relationships.removed)) {
            const sorted = [...changes.relationships.removed].sort((a, b) => b - a);
            for (const idx of sorted) {
                if (idx >= 0 && idx < next.relationships.length) {
                    next.relationships.splice(idx, 1);
                }
            }
        }
    }

    // Threads — add/update pattern (no removal — threads resolve, not delete)
    if (isSectionEnabled(next, 'threads') && changes.threads) {
        if (Array.isArray(changes.threads.added)) {
            next.threads.push(...changes.threads.added);
        }
        if (Array.isArray(changes.threads.updated)) {
            for (const upd of changes.threads.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.threads.length) {
                    next.threads[idx] = { ...next.threads[idx], ...upd.changes };
                }
            }
        }
    }

    // Continuity flags — add/resolve pattern
    if (isSectionEnabled(next, 'flags') && changes.continuityFlags) {
        if (Array.isArray(changes.continuityFlags.added)) {
            next.continuityFlags.push(...changes.continuityFlags.added);
        }
        if (Array.isArray(changes.continuityFlags.resolved)) {
            next.continuityFlags = next.continuityFlags.filter(
                (_, i) => !changes.continuityFlags.resolved.includes(i)
            );
        }
    }

    if (isSectionEnabled(next, 'storyMilestones') && changes.storyMilestones && typeof changes.storyMilestones === 'object' && !Array.isArray(changes.storyMilestones)) {
        next.storyMilestones = { ...(next.storyMilestones || {}) };
        for (const [id, raw] of Object.entries(changes.storyMilestones)) {
            next.storyMilestones[id] = normalizeStoryMilestone({ ...(next.storyMilestones[id] || {}), ...(raw || {}) });
        }
    }

    return next;
}

// ── Entry normalizers (defensive — prevent malformed imports from crashing memo builder) ──

/**
 * Normalizes a secret entry to its canonical shape.
 * If whoKnows/whoSuspects are strings instead of arrays, wraps them.
 * @param {*} s - Raw secret entry
 * @returns {Object} Normalized secret
 */
function normalizeSecret(s) {
    return {
        fact: typeof s?.fact === 'string' ? s.fact : '',
        trueState: typeof s?.trueState === 'string' ? s.trueState : '',
        whoKnows: Array.isArray(s?.whoKnows) ? s.whoKnows.filter(x => typeof x === 'string') : [],
        whoSuspects: Array.isArray(s?.whoSuspects) ? s.whoSuspects.filter(x => typeof x === 'string') : [],
        publicVersion: typeof s?.publicVersion === 'string' ? s.publicVersion : '',
    };
}

/**
 * Normalizes a relationship entry to its canonical shape.
 * @param {*} r - Raw relationship entry
 * @returns {Object} Normalized relationship
 */
function normalizeRelationship(r) {
    return {
        pair: typeof r?.pair === 'string' ? r.pair : '',
        notes: typeof r?.notes === 'string' ? r.notes : '',
        tension: (r?.tension && VALID_ENUMS.tension.has(r.tension)) ? r.tension : '',
        trust: (r?.trust && VALID_ENUMS.trust.has(r.trust)) ? r.trust : '',
    };
}

/**
 * Normalizes a thread entry to its canonical shape.
 * @param {*} t - Raw thread entry
 * @returns {Object} Normalized thread
 */
function normalizeThread(t) {
    return {
        description: typeof t?.description === 'string' ? t.description : '',
        status: (t?.status && VALID_ENUMS.threadStatus.has(t.status)) ? t.status : 'active',
        unresolvedConsequences: Array.isArray(t?.unresolvedConsequences)
            ? t.unresolvedConsequences.filter(x => typeof x === 'string') : [],
    };
}

/**
 * Normalizes a continuity flag entry to its canonical shape.
 * @param {*} f - Raw flag entry
 * @returns {Object} Normalized flag
 */
function normalizeFlag(f) {
    return {
        type: (f?.type && VALID_ENUMS.flagType.has(f.type)) ? f.type : 'warning',
        description: typeof f?.description === 'string' ? f.description : '',
        severity: (f?.severity && VALID_ENUMS.flagSeverity.has(f.severity)) ? f.severity : 'low',
        timestamp: Number.isFinite(f?.timestamp) ? f.timestamp : Date.now(),
        resolved: typeof f?.resolved === 'boolean' ? f.resolved : false,
    };
}

/**
 * Normalizes all arrays in a state object (secrets, relationships, threads, flags).
 * Mutates the state in place.
 * @param {Object} state - SagaState to normalize
 */
export function normalizeStateEntries(state) {
    if (Array.isArray(state.characters)) {
        state.characters = state.characters.map(normalizeCharacter).filter(c => c.name);
    } else {
        state.characters = [];
    }
    if (Array.isArray(state.inventory)) {
        state.inventory = state.inventory.map(normalizeInventoryItem).filter(i => i.item || i.owner || i.status);
    } else {
        state.inventory = [];
    }
    if (Array.isArray(state.objectives)) {
        state.objectives = state.objectives.map(normalizeObjective).filter(o => o.goal || o.owner);
    } else {
        state.objectives = [];
    }
    if (Array.isArray(state.secrets)) {
        state.secrets = state.secrets.map(normalizeSecret);
    }
    if (Array.isArray(state.relationships)) {
        state.relationships = state.relationships.map(normalizeRelationship);
    }
    if (Array.isArray(state.threads)) {
        state.threads = state.threads.map(normalizeThread);
    }
    if (Array.isArray(state.continuityFlags)) {
        state.continuityFlags = state.continuityFlags.map(normalizeFlag);
    }
    // Also normalize knowledge values: ensure each char has an array of strings
    if (state.knowledge && typeof state.knowledge === 'object' && !Array.isArray(state.knowledge)) {
        for (const [char, facts] of Object.entries(state.knowledge)) {
            if (!Array.isArray(facts)) {
                state.knowledge[char] = typeof facts === 'string' ? [facts] : [];
            } else {
                state.knowledge[char] = facts.filter(x => typeof x === 'string');
            }
        }
    }
}
