/**
 * Stale-write detection helpers for Saga external JSON storage.
 */

export const SAGA_STORAGE_CHANGED_CODE = 'storage_changed';

function normalizeRevision(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return Math.max(1, Number(fallback) || 1);
    return Math.floor(numeric);
}

function normalizeString(value = '', maxLength = 500) {
    return String(value || '').trim().slice(0, Math.max(1, Number(maxLength) || 500));
}

export function createSagaStorageChangedResult(details = {}) {
    const domain = normalizeString(details.domain || 'storage', 80);
    const path = normalizeString(details.path || '', 500);
    const message = normalizeString(
        details.message || 'Storage changed. Reload this panel before saving.',
        500,
    );
    return {
        ok: false,
        code: SAGA_STORAGE_CHANGED_CODE,
        domain,
        path,
        message,
        expectedRevision: normalizeRevision(details.expectedRevision, 1),
        actualRevision: normalizeRevision(details.actualRevision, 1),
    };
}

export function createSagaStorageChangedError(details = {}) {
    const result = createSagaStorageChangedResult(details);
    const error = new Error(result.message);
    error.code = result.code;
    error.domain = result.domain;
    error.path = result.path;
    error.expectedRevision = result.expectedRevision;
    error.actualRevision = result.actualRevision;
    error.result = result;
    return error;
}

export function isSagaStorageChangedError(error = {}) {
    return error?.code === SAGA_STORAGE_CHANGED_CODE;
}

export function getSagaStorageRevision(value = {}, fallback = 1) {
    return normalizeRevision(value?.revision, fallback);
}

export function hasSagaStorageRevisionChanged(latest = {}, expectedRevision = 0) {
    const expected = normalizeRevision(expectedRevision, 0);
    if (!expected) return false;
    return getSagaStorageRevision(latest, expected) !== expected;
}

export function assertSagaStorageRevisionFresh(details = {}) {
    const expectedRevision = normalizeRevision(details.expectedRevision, 0);
    if (!expectedRevision) return true;
    const latest = details.latest || {};
    if (!hasSagaStorageRevisionChanged(latest, expectedRevision)) return true;
    throw createSagaStorageChangedError({
        ...details,
        expectedRevision,
        actualRevision: getSagaStorageRevision(latest, expectedRevision),
    });
}

export function formatSagaStorageChangedMessage(domain = '') {
    const key = normalizeString(domain, 80);
    if (key === 'library') return 'Library storage changed. Reload the Library before changing folders.';
    if (key === 'lorepack' || key === 'library_payload') return 'Loredeck storage changed. Reload this Loredeck before saving.';
    if (key === 'creator') return 'Deck Maker project storage changed. Reload this project before continuing.';
    if (key === 'themes' || key === 'iconSets' || key === 'theme_icon') return 'Theme/Icon storage changed. Reload Settings before importing again.';
    return 'Storage changed. Reload this panel before saving.';
}
