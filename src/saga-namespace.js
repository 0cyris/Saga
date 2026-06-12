/**
 * Shared global namespace helpers for Saga.
 */

export function getSagaNamespace() {
    const namespace = globalThis.Saga && typeof globalThis.Saga === 'object'
        ? globalThis.Saga
        : {};
    globalThis.Saga = namespace;
    return namespace;
}

export function getSagaNamespaceSection(sectionName = '') {
    const key = String(sectionName || '').trim();
    if (!key) return getSagaNamespace();
    const saga = getSagaNamespace();
    const section = saga[key] && typeof saga[key] === 'object'
        ? saga[key]
        : {};
    saga[key] = section;
    return section;
}
