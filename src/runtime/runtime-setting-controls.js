/**
 * runtime-setting-controls.js - Saga
 * Shared compact setting controls for runtime panels.
 */

import {
    getSettings,
    saveSettings,
} from '../state/state-manager.js';
import { addTooltip } from '../ui/runtime-ui-kit.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureRuntimeSettingControls(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

function refreshPanelBody(options = {}) {
    return dep('refreshPanelBody', () => null)(options);
}

export function createSelectSettingRow(labelText, tooltip, settingKey, options, onChange = null) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-setting-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    addTooltip(label, tooltip);
    const select = document.createElement('select');
    select.className = 'text_pole';
    for (const [value, text] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (String(settings[settingKey]) === String(value)) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', () => {
        const next = getSettings();
        next[settingKey] = select.value;
        saveSettings(next);
        if (typeof onChange === 'function') onChange(select.value);
        refreshPanelBody({ preserveScroll: true });
    });
    row.appendChild(label);
    row.appendChild(select);
    return row;
}

export function createNumberSettingRow(labelText, tooltip, settingKey, { min = 0, max = 9999, fallback = 0 } = {}) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-setting-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    addTooltip(label, tooltip);
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'text_pole';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(settings[settingKey] ?? fallback);
    input.addEventListener('change', () => {
        const next = getSettings();
        const parsed = parseInt(input.value, 10);
        next[settingKey] = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        input.value = String(next[settingKey]);
        saveSettings(next);
    });
    row.appendChild(label);
    row.appendChild(input);
    return row;
}

export function createRangeSettingRow(labelPrefix, tooltip, settingKey, { min = 0, max = 100, fallback = 0, suffix = '', step = 1 } = {}) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const text = document.createElement('span');
    const rawValue = settings[settingKey] ?? fallback;
    const numericValue = Number.isFinite(Number(rawValue)) ? Number(rawValue) : fallback;
    const currentValue = Math.max(min, Math.min(max, numericValue));
    text.textContent = `${labelPrefix}: ${currentValue}${suffix}`;
    addTooltip(text, tooltip);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(currentValue);
    input.addEventListener('input', () => {
        const next = getSettings();
        {
            const parsed = parseInt(input.value, 10);
            next[settingKey] = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        }
        saveSettings(next);
        text.textContent = `${labelPrefix}: ${next[settingKey]}${suffix}`;
    });
    row.appendChild(text);
    row.appendChild(input);
    return row;
}

export function createAutomationModeCard(titleText, modeKey, intervalKey, manualTooltip, automaticTooltip, intervalTooltip) {
    const settings = getSettings();
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-automation-mode-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = titleText;
    addTooltip(title, `${titleText} can run manually from its button or automatically every configured number of turns.`);
    card.appendChild(title);

    const buttons = document.createElement('div');
    buttons.className = 'saga-mode-buttons';
    for (const [mode, label, tip] of [
        ['manual', 'Manual', manualTooltip],
        ['automatic', 'Automatic', automaticTooltip],
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'saga-mode-button';
        if ((settings[modeKey] || 'manual') === mode) btn.classList.add('saga-mode-button-active');
        btn.textContent = label;
        addTooltip(btn, tip);
        btn.addEventListener('click', () => {
            const next = getSettings();
            next[modeKey] = mode;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        });
        buttons.appendChild(btn);
    }
    card.appendChild(buttons);

    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const label = document.createElement('span');
    label.textContent = `Every ${settings[intervalKey] || 5} turns`;
    addTooltip(label, intervalTooltip);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '1';
    input.max = '100';
    input.step = '1';
    input.value = String(settings[intervalKey] || 5);
    input.addEventListener('input', () => {
        const next = getSettings();
        next[intervalKey] = Math.max(1, Math.min(100, parseInt(input.value, 10) || 5));
        saveSettings(next);
        label.textContent = `Every ${next[intervalKey]} turns`;
    });
    row.appendChild(label);
    row.appendChild(input);
    card.appendChild(row);

    return card;
}

export function createTextSettingField(label, value, tooltip, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'saga-inline-field saga-context-field';
    addTooltip(wrap, tooltip);

    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.addEventListener('change', () => onChange?.(input.value.trim()));
    wrap.appendChild(input);
    return wrap;
}
