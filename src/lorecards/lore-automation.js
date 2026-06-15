/**
 * lore-automation.js -- Saga
 * Shared Lore Automation state helpers.
 */

export const LORE_AUTOMATION_MODE_VALUES = Object.freeze(['off', 'ar', 'armp', 'armpc']);
export const LORE_AUTOMATION_STYLE_VALUES = Object.freeze(['careful', 'balanced', 'aggressive']);
export const LORE_AUTOMATION_PROVIDER_ROUTING_VALUES = Object.freeze(['auto', 'utility', 'reasoning', 'local']);

export const LORE_AUTOMATION_MODE_LABELS = Object.freeze({
    off: 'Off',
    ar: 'AR',
    armp: 'ARMP',
    armpc: 'ARMPC',
});

export const LORE_AUTOMATION_MODE_TOOLTIPS = Object.freeze({
    off: 'Lore Automation disabled.',
    ar: 'Auto-Relevance.',
    armp: 'Auto-Relevance, Muting, Pinning.',
    armpc: 'Auto-Relevance, Muting, Pinning, Curating.',
});

export const LORE_AUTOMATION_MANUAL_DISABLE_REASONS = Object.freeze({
    relevance: 'manual_relevance_change',
    pin: 'manual_pin_change',
    mute: 'manual_mute_change',
    content: 'manual_content_edit',
    metadata: 'manual_metadata_edit',
    bulk: 'manual_bulk_change',
});

function cleanString(value = '', limit = 240) {
    return String(value || '').trim().slice(0, limit);
}

export function normalizeLoreAutomationMode(value, fallback = 'off') {
    const normalized = cleanString(value, 20).toLowerCase();
    return LORE_AUTOMATION_MODE_VALUES.includes(normalized) ? normalized : fallback;
}

export function normalizeLoreAutomationStyle(value, fallback = 'balanced') {
    const normalized = cleanString(value, 20).toLowerCase();
    return LORE_AUTOMATION_STYLE_VALUES.includes(normalized) ? normalized : fallback;
}

export function normalizeLoreAutomationProviderRouting(value, fallback = 'auto') {
    const normalized = cleanString(value, 20).toLowerCase();
    return LORE_AUTOMATION_PROVIDER_ROUTING_VALUES.includes(normalized) ? normalized : fallback;
}

export function inferLoreAutomationOwner(entry = {}) {
    const existing = cleanString(entry.extensions?.loreAutomation?.owner, 24);
    if (existing) return existing;
    const source = `${entry.source || ''} ${entry.sourceInfo?.work || ''} ${entry.extensions?.sagaGeneration?.mode || ''}`.toLowerCase();
    if (entry.extensions?.sagaGeneration || /generated|bulk|story|scan/.test(source)) return 'generated';
    if (/manual|user/.test(source)) return 'manual';
    return 'imported';
}

export function getLoreAutomationState(entry = {}) {
    const raw = entry.extensions?.loreAutomation && typeof entry.extensions.loreAutomation === 'object'
        ? entry.extensions.loreAutomation
        : {};
    const legacyManualLock = entry.extensions?.autoRelevance?.mode === 'manual'
        || entry.extensions?.autoRelevance?.locked === true;
    const enabled = raw.enabled === undefined ? !legacyManualLock : raw.enabled !== false;
    return {
        enabled,
        enabledAt: Number.isFinite(Number(raw.enabledAt)) ? Number(raw.enabledAt) : 0,
        enabledBy: cleanString(raw.enabledBy, 32),
        disabledReason: cleanString(raw.disabledReason || (legacyManualLock && !enabled ? 'legacy_manual_relevance' : ''), 80),
        disabledAt: Number.isFinite(Number(raw.disabledAt)) ? Number(raw.disabledAt) : 0,
        disabledBy: cleanString(raw.disabledBy, 32),
        lastAction: cleanString(raw.lastAction, 48),
        lastReason: cleanString(raw.lastReason || entry.extensions?.autoRelevance?.reason || '', 240),
        lastRunId: cleanString(raw.lastRunId, 120),
        lastTouchedAt: Number.isFinite(Number(raw.lastTouchedAt))
            ? Number(raw.lastTouchedAt)
            : (Number.isFinite(Number(entry.extensions?.autoRelevance?.updatedAt)) ? Number(entry.extensions.autoRelevance.updatedAt) : 0),
        lastProvider: cleanString(raw.lastProvider || entry.extensions?.autoRelevance?.mode || '', 24),
        owner: cleanString(raw.owner || inferLoreAutomationOwner(entry), 24) || 'imported',
    };
}

export function isLoreAutomationEnabledForEntry(entry = {}) {
    return getLoreAutomationState(entry).enabled !== false;
}

export function setLoreAutomationEnabled(entry = {}, enabled = true, meta = {}) {
    const current = getLoreAutomationState(entry);
    const now = Number.isFinite(Number(meta.at)) ? Number(meta.at) : Date.now();
    const next = {
        ...current,
        enabled: enabled !== false,
        owner: cleanString(meta.owner || current.owner || inferLoreAutomationOwner(entry), 24) || 'imported',
    };
    if (enabled !== false) {
        next.enabledAt = now;
        next.enabledBy = cleanString(meta.by || 'manual', 32);
        next.disabledReason = '';
        next.disabledAt = 0;
        next.disabledBy = '';
    } else {
        next.disabledAt = now;
        next.disabledBy = cleanString(meta.by || 'user', 32);
        next.disabledReason = cleanString(meta.reason || 'manual_metadata_edit', 80);
    }
    return {
        ...entry,
        extensions: {
            ...(entry.extensions || {}),
            loreAutomation: next,
        },
    };
}

export function disableLoreAutomationForManualChange(entry = {}, reason = 'manual_metadata_edit', meta = {}) {
    return setLoreAutomationEnabled(entry, false, {
        ...meta,
        reason,
        by: meta.by || 'user',
    });
}

export function markLoreAutomationAction(entry = {}, action = {}) {
    const current = getLoreAutomationState(entry);
    const now = Number.isFinite(Number(action.at)) ? Number(action.at) : Date.now();
    return {
        ...entry,
        extensions: {
            ...(entry.extensions || {}),
            loreAutomation: {
                ...current,
                enabled: current.enabled !== false,
                lastAction: cleanString(action.operation || action.action || '', 48),
                lastReason: cleanString(action.reason || '', 240),
                lastRunId: cleanString(action.runId || '', 120),
                lastTouchedAt: now,
                lastProvider: cleanString(action.provider || '', 24),
                owner: cleanString(action.owner || current.owner || inferLoreAutomationOwner(entry), 24) || 'imported',
            },
        },
    };
}
