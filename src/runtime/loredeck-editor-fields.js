/**
 * loredeck-editor-fields.js - Saga
 * Shared field helpers for runtime Loredeck editor dialogs.
 */

import {
    addTooltip,
} from '../ui/runtime-ui-kit.js';

export function createLoredeckEditorField(container, labelText, value = '', options = {}) {
    const label = document.createElement('label');
    label.className = `saga-loredeck-editor-field${options.full ? ' saga-loredeck-editor-field-full' : ''}`;
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, options.tooltip || labelText);
    label.appendChild(span);

    const input = options.multiline ? document.createElement('textarea') : document.createElement('input');
    input.className = options.multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
    if (!options.multiline) input.type = 'text';
    input.value = String(value || '');
    input.disabled = options.disabled === true;
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

export function createLoredeckCheckbox(container, labelText, tooltip, checked = false) {
    const label = document.createElement('label');
    label.className = 'saga-inline-toggle';
    addTooltip(label, tooltip);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${labelText}`));
    container.appendChild(label);
    return input;
}

export function getLoredeckEntryEditorString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

export function getLoredeckEntryEditorNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

export function getLoredeckEntryEditorNumberText(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : '';
}

export function appendLoredeckEntryEditorSection(form, titleText) {
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = titleText;
    form.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'saga-new-lore-meta-grid';
    form.appendChild(grid);
    return grid;
}

export function buildLoredeckContextFromEditorFields(fields = {}) {
    if (!fields.scopeSelect) return {};
    const scope = getLoredeckEntryEditorString(fields.scopeSelect.value, 60);
    const anchorId = getLoredeckEntryEditorString(fields.anchorIdInput?.value, 180);
    const validFromAnchor = getLoredeckEntryEditorString(fields.validFromAnchorInput?.value, 180);
    const validToAnchor = getLoredeckEntryEditorString(fields.validToAnchorInput?.value, 180);
    const sortKeyFrom = getLoredeckEntryEditorNumber(fields.sortKeyFromInput?.value);
    const sortKeyTo = getLoredeckEntryEditorNumber(fields.sortKeyToInput?.value);
    const precision = getLoredeckEntryEditorString(fields.precisionInput?.value, 120);
    const windowKind = getLoredeckEntryEditorString(fields.windowKindSelect?.value, 120);
    const label = getLoredeckEntryEditorString(fields.labelInput?.value, 240);
    const contextGate = {
        scope,
        anchorId,
        validFromAnchor: validFromAnchor || (scope === 'anchor' ? anchorId : ''),
        validToAnchor: validToAnchor || (scope === 'anchor' ? anchorId : ''),
        sortKeyFrom,
        sortKeyTo,
        precision,
        windowKind,
        label,
    };
    return Object.fromEntries(Object.entries(contextGate).filter(([, fieldValue]) => fieldValue !== '' && fieldValue !== null && fieldValue !== undefined));
}

export function buildLoredeckRetrievalFromEditorFields(fields = {}) {
    if (!fields.activationSelect) return {};
    return {
        activation: getLoredeckEntryEditorString(fields.activationSelect.value, 80),
        frequency: getLoredeckEntryEditorString(fields.frequencySelect.value, 80),
        contextBoost: getLoredeckEntryEditorString(fields.contextBoostSelect.value, 80),
        triggers: {},
    };
}

export function validateLoredeckV3EditorFields(contextGate = {}, retrieval = {}) {
    const errors = [];
    if (!['anchor', 'window', 'global'].includes(contextGate.scope)) errors.push('Context scope');
    if (!Number.isFinite(Number(contextGate.sortKeyFrom))) errors.push('sort key from');
    if (!Number.isFinite(Number(contextGate.sortKeyTo))) errors.push('sort key to');
    if (Number.isFinite(Number(contextGate.sortKeyFrom)) && Number.isFinite(Number(contextGate.sortKeyTo)) && Number(contextGate.sortKeyFrom) > Number(contextGate.sortKeyTo)) {
        errors.push('sort key order');
    }
    if (!getLoredeckEntryEditorString(contextGate.precision, 120)) errors.push('Context precision');
    if (!getLoredeckEntryEditorString(contextGate.label, 240)) errors.push('Context label');
    if (!getLoredeckEntryEditorString(retrieval.activation, 80)) errors.push('retrieval activation');
    if (!getLoredeckEntryEditorString(retrieval.frequency, 80)) errors.push('retrieval frequency');
    if (!getLoredeckEntryEditorString(retrieval.contextBoost, 80)) errors.push('retrieval boost');
    return errors;
}
