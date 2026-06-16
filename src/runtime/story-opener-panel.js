/**
 * Session-tab Story Maker panel.
 */

import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    toast,
} from '../ui/runtime-ui-kit.js';
import {
    createLoredeckJobStatusRow,
    formatLoredeckJobElapsed,
} from '../loredecks/loredeck-job-view.js';
import {
    getCachedExternalStoryOpenerSession,
    getExternalStoryOpenerIndex,
    getStoryOpenerStorageStatus,
    hydrateExternalStoryOpenerSessionRecord,
    hydrateSagaStoryOpenerStorage,
    removeExternalStoryOpenerSessionSync,
    upsertExternalStoryOpenerSessionSync,
} from '../storage/saga-story-opener-storage.js';
import {
    buildStoryOpenerBrief,
    writeStoryOpenerVariants,
} from '../story-openers/story-opener-generation.js';
import {
    buildStoryOpenerContextLabel,
    buildStoryOpenerContextPacket,
    buildStoryOpenerSourceIntentFromState,
} from '../story-openers/story-opener-source.js';
import {
    createStoryOpenerRun,
    createStoryOpenerSessionId,
    getStoryOpenerReadiness,
    getStoryOpenerSelectedVariant,
    getStoryOpenerStageDescriptors,
    normalizeStoryOpenerControls,
    normalizeStoryOpenerFailure,
    normalizeStoryOpenerSession,
    normalizeStoryOpenerVariantCount,
    recordStoryOpenerRun,
    resetStoryOpenerToStage,
    STORY_OPENER_DEFAULT_OPENING_SHAPE,
    STORY_OPENER_OPENING_SHAPES,
    STORY_OPENER_POV_OPTIONS,
    STORY_OPENER_TARGET_LENGTHS,
    STORY_OPENER_TENSE_OPTIONS,
    STORY_OPENER_VARIANT_COUNT_MAX,
    STORY_OPENER_VARIANT_COUNT_MIN,
} from '../story-openers/story-opener-state.js';

const openerUiState = {
    hydrating: false,
    loadingSessionIds: new Set(),
    activeRunIds: new Set(),
    revisionPrompt: '',
};

const STORY_OPENER_GENERATION_STATUSES = new Set(['queued', 'running', 'retrying']);
const STORY_OPENER_STAGE_LABELS = Object.freeze({
    inputs: 'Inputs',
    context_packet: 'Context Packet',
    opener_brief: 'Opener Brief',
    draft_variants: 'Draft Variants',
    review_copy: 'Review & Copy',
});
const STORY_OPENER_CUSTOM_OPENING_SHAPE = '__custom__';

let storyOpenerGenerationTicker = null;

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatCount(value = 0, singular = 'item', plural = `${singular}s`) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    return `${count} ${count === 1 ? singular : plural}`;
}

function getStoryOpenerStageLabel(stageId = '') {
    const id = String(stageId || '').trim();
    return STORY_OPENER_STAGE_LABELS[id] || id.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Generation';
}

function getStoryOpenerRunStartedAt(run = {}, now = Date.now()) {
    const startedAt = Number(run.startedAt || run.updatedAt || now);
    return Number.isFinite(startedAt) && startedAt > 0 ? startedAt : now;
}

function getStoryOpenerGenerationLabel(run = {}) {
    return String(run.label || getStoryOpenerStageLabel(run.stage)).trim() || 'Story Maker generation';
}

function getStoryOpenerGenerationMessage(run = {}) {
    const message = String(run.message || '').trim();
    if (message) return message;
    const label = getStoryOpenerGenerationLabel(run);
    if (run.stage === 'context_packet') return 'Resolving active Loredecks, Context, and guardrails.';
    if (run.stage === 'opener_brief') return 'Turning the Context Packet into opener instructions.';
    if (run.stage === 'draft_variants') return 'Writing opener text with the Reasoning Provider.';
    return label || 'Waiting on Story Maker generation.';
}

function getStoryOpenerGenerationMeta(run = {}) {
    return `Story Maker generation | ${getStoryOpenerStageLabel(run.stage)}`;
}

function updateStoryOpenerGenerationStatusRows(now = Date.now()) {
    if (typeof document === 'undefined') return false;
    const rows = [...document.querySelectorAll('.saga-story-opener-generation-status[data-saga-story-opener-generation-active="true"]')];
    if (!rows.length) return false;
    for (const row of rows) {
        const startedAt = getStoryOpenerRunStartedAt({ startedAt: row.dataset.sagaStoryOpenerGenerationStartedAt }, now);
        const label = row.querySelector('.saga-generation-live-label');
        if (label) label.textContent = row.dataset.sagaStoryOpenerGenerationLabel || 'Story Maker generation';
        const text = row.querySelector('.saga-generation-live-text');
        if (text) text.textContent = row.dataset.sagaStoryOpenerGenerationMessage || 'Waiting on Story Maker generation.';
        const elapsed = row.querySelector('.saga-generation-live-elapsed');
        if (elapsed) elapsed.textContent = formatLoredeckJobElapsed(now - startedAt);
        const meta = row.querySelector('.saga-generation-live-meta');
        if (meta) meta.textContent = row.dataset.sagaStoryOpenerGenerationMeta || 'Story Maker generation';
    }
    return true;
}

function stopStoryOpenerGenerationTicker() {
    if (!storyOpenerGenerationTicker) return;
    clearInterval(storyOpenerGenerationTicker);
    storyOpenerGenerationTicker = null;
}

function startStoryOpenerGenerationTicker() {
    if (storyOpenerGenerationTicker || typeof setInterval !== 'function') return;
    storyOpenerGenerationTicker = setInterval(() => {
        if (!updateStoryOpenerGenerationStatusRows()) stopStoryOpenerGenerationTicker();
    }, 1000);
}

function refresh(options = {}) {
    if (typeof options.refreshPanelBody === 'function') {
        options.refreshPanelBody({ preserveScroll: options.preserveScroll !== false });
    }
}

function mark(options = {}, element, target) {
    if (typeof options.markTourTarget === 'function') return options.markTourTarget(element, target);
    return element;
}

function getStoryOpenerScrollElement() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('.saga-runtime-tab-body-session')
        || document.querySelector('.saga-runtime-drawer')
        || document.querySelector('.saga-lore-panel-body');
}

function captureStoryOpenerScrollState() {
    const element = getStoryOpenerScrollElement();
    if (!element) return null;
    return {
        top: element.scrollTop || 0,
        left: element.scrollLeft || 0,
    };
}

function restoreStoryOpenerScrollState(scrollState = null) {
    if (!scrollState) return;
    const element = getStoryOpenerScrollElement();
    if (!element) return;
    element.scrollTop = scrollState.top || 0;
    element.scrollLeft = scrollState.left || 0;
}

function refreshStoryOpenerStageSwitch(options = {}, scrollState = null) {
    refresh(options);
    restoreStoryOpenerScrollState(scrollState);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => restoreStoryOpenerScrollState(scrollState));
    }
}

function ensureStoryOpenerStorageHydrated(options = {}) {
    const status = getStoryOpenerStorageStatus();
    if (status.loaded || status.loading || openerUiState.hydrating) return;
    openerUiState.hydrating = true;
    hydrateSagaStoryOpenerStorage()
        .catch(error => {
            console.warn('[Saga] Story Maker storage hydration failed:', error);
            toast(error?.message || 'Story Maker storage failed to load.', 'error');
        })
        .finally(() => {
            openerUiState.hydrating = false;
            refresh(options);
        });
}

function loadStoryOpenerPayloadIfNeeded(record = {}, options = {}, loadOptions = {}) {
    const sessionId = String(record?.sessionId || record?.id || '').trim();
    if (!sessionId || getCachedExternalStoryOpenerSession(sessionId) || openerUiState.loadingSessionIds.has(sessionId)) return;
    openerUiState.loadingSessionIds.add(sessionId);
    hydrateExternalStoryOpenerSessionRecord(record)
        .then(payload => {
            if (loadOptions.activate && payload?.sessionId) saveStoryOpenerSession(payload);
        })
        .catch(error => {
            console.warn('[Saga] Story Maker session payload failed to load:', error);
            toast(error?.message || 'Story Maker session payload failed to load.', 'error');
        })
        .finally(() => {
            openerUiState.loadingSessionIds.delete(sessionId);
            refresh(options);
        });
}

function saveStoryOpenerSession(session = {}, options = {}) {
    const result = upsertExternalStoryOpenerSessionSync(session, {
        activate: options.activate !== false,
        activeSessionId: session.sessionId,
        lastSessionId: session.sessionId,
    });
    if (!result.ok) {
        toast(result.error || 'Story Maker session could not be saved.', 'error');
        return null;
    }
    return result.session || result.payload || session;
}

function createField(labelText = '', helpText = '', input) {
    const wrap = document.createElement('label');
    wrap.className = 'saga-story-opener-field';
    const label = document.createElement('span');
    label.className = 'saga-story-opener-field-label';
    label.textContent = labelText;
    wrap.appendChild(label);
    if (helpText) addTooltip(wrap, helpText);
    wrap.appendChild(input);
    return wrap;
}

function createTextInput(value = '', placeholder = '', maxLength = 1000) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder;
    input.maxLength = maxLength;
    return input;
}

function createSelectInput(options = [], value = '') {
    const select = document.createElement('select');
    for (const option of options) {
        const item = document.createElement('option');
        item.value = String(option?.value || '');
        item.textContent = String(option?.label || option?.value || '');
        select.appendChild(item);
    }
    select.value = value || '';
    return select;
}

function getStoryOpenerOpeningShapeMode(value = '') {
    const clean = String(value || '').trim();
    return STORY_OPENER_OPENING_SHAPES.includes(clean) ? clean : STORY_OPENER_CUSTOM_OPENING_SHAPE;
}

function setStoryOpenerFieldHidden(field, hidden = false) {
    if (!field) return;
    field.hidden = !!hidden;
    field.classList.toggle('saga-story-opener-field-hidden', !!hidden);
}

function createSegmentedChoiceControl(options = [], value = '', className = '') {
    const control = document.createElement('div');
    control.className = `saga-story-opener-segmented-control ${className}`.trim();
    control.setAttribute('role', 'radiogroup');
    const fallback = options[0]?.value || '';
    const ref = {
        value: options.some(option => option.value === value) ? value : fallback,
    };
    for (const option of options) {
        const button = createButton(option.label, option.description || `Use ${option.value}.`, btn => {
            ref.value = option.value;
            setStoryOpenerSegmentedSelection(control, btn);
        }, 'saga-mode-button saga-story-opener-segment');
        button.type = 'button';
        button.setAttribute('role', 'radio');
        button.dataset.storyOpenerChoiceValue = option.value;
        const selected = option.value === ref.value;
        button.classList.toggle('saga-mode-button-active', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
        control.appendChild(button);
    }
    return { element: control, ref };
}

function setStoryOpenerSegmentedSelection(control, activeButton) {
    if (!control || !activeButton) return;
    for (const sibling of control.querySelectorAll('.saga-story-opener-segment')) {
        const selected = sibling === activeButton;
        sibling.classList.toggle('saga-mode-button-active', selected);
        sibling.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
}

function setStoryOpenerProviderActionsDisabled(container, disabled = false) {
    if (!container) return;
    for (const button of container.querySelectorAll('[data-story-opener-provider-action="true"]')) {
        button.disabled = !!disabled;
    }
}

function formatStoryOpenerVariantCount(value = 1) {
    const count = normalizeStoryOpenerVariantCount(value);
    return `${count} variant${count === 1 ? '' : 's'}`;
}

function updateVariantCountSliderPresentation(slider, readout) {
    const count = normalizeStoryOpenerVariantCount(slider?.value);
    const min = Number(slider?.min) || STORY_OPENER_VARIANT_COUNT_MIN;
    const max = Number(slider?.max) || STORY_OPENER_VARIANT_COUNT_MAX;
    const progress = max > min ? ((count - min) / (max - min)) * 100 : 0;
    if (readout) readout.textContent = formatStoryOpenerVariantCount(count);
    slider?.style?.setProperty('--saga-story-opener-variant-progress', `${Math.max(0, Math.min(100, progress))}%`);
    slider?.setAttribute?.('aria-valuetext', formatStoryOpenerVariantCount(count));
}

function createVariantCountControl(value = 1) {
    const control = document.createElement('div');
    control.className = 'saga-story-opener-variant-count-control';

    const readout = document.createElement('div');
    readout.className = 'saga-story-opener-variant-count-readout';
    readout.textContent = formatStoryOpenerVariantCount(value);
    control.appendChild(readout);

    const slider = document.createElement('input');
    slider.className = 'saga-story-opener-variant-count-slider';
    slider.type = 'range';
    slider.min = String(STORY_OPENER_VARIANT_COUNT_MIN);
    slider.max = String(STORY_OPENER_VARIANT_COUNT_MAX);
    slider.step = '1';
    slider.value = String(normalizeStoryOpenerVariantCount(value));
    slider.setAttribute('aria-label', 'Variant count');
    slider.addEventListener('input', () => {
        updateVariantCountSliderPresentation(slider, readout);
    });
    updateVariantCountSliderPresentation(slider, readout);
    control.appendChild(slider);

    return { element: control, input: slider };
}

function createTextArea(value = '', placeholder = '', rows = 3, maxLength = 5000) {
    const input = document.createElement('textarea');
    input.value = value || '';
    input.placeholder = placeholder;
    input.rows = rows;
    input.maxLength = maxLength;
    return input;
}

function escapeStoryOpenerHtml(value = '') {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderStoryOpenerInlineMarkdown(value = '') {
    return escapeStoryOpenerHtml(value)
        .replace(/`([^`\n]+?)`/g, '<code>$1</code>')
        .replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/___([\s\S]+?)___/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__([\s\S]+?)__/g, '<strong>$1</strong>')
        .replace(/(^|[^\*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>')
        .replace(/~~([\s\S]+?)~~/g, '<s>$1</s>');
}

function renderStoryOpenerMarkdownBaseHtml(text = '') {
    const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!clean) return '';
    return clean.split(/\n{2,}/)
        .map(block => {
            const lines = block.split('\n');
            if (lines.every(line => /^\s*>\s?/.test(line))) {
                const body = lines
                    .map(line => renderStoryOpenerInlineMarkdown(line.replace(/^\s*>\s?/, '')))
                    .join('<br>');
                return `<blockquote>${body}</blockquote>`;
            }
            if (lines.length > 1 && lines.every(line => /^\s*[-*]\s+/.test(line))) {
                const items = lines
                    .map(line => `<li>${renderStoryOpenerInlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
                    .join('');
                return `<ul>${items}</ul>`;
            }
            return `<p>${lines.map(line => renderStoryOpenerInlineMarkdown(line)).join('<br>')}</p>`;
        })
        .join('');
}

function createStoryOpenerDialogueQuoteSpan(text = '', options = {}) {
    const span = document.createElement('span');
    span.className = 'saga-story-opener-dialogue-quote';
    if (options.inlineQuoteStyle) span.setAttribute('style', 'color:#d99038;');
    span.textContent = text;
    return span;
}

function findStoryOpenerQuoteStart(text = '', start = 0) {
    const straight = text.indexOf('"', start);
    const curly = text.indexOf('“', start);
    if (straight < 0) return curly;
    if (curly < 0) return straight;
    return Math.min(straight, curly);
}

function appendStoryOpenerDialogueQuotedText(fragment, text = '', options = {}) {
    let cursor = 0;
    while (cursor < text.length) {
        const start = findStoryOpenerQuoteStart(text, cursor);
        if (start < 0) {
            fragment.appendChild(document.createTextNode(text.slice(cursor)));
            break;
        }
        if (start > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
        const opener = text[start];
        const closer = opener === '“' ? '”' : opener;
        const end = text.indexOf(closer, start + 1);
        const closeIndex = end >= 0 ? end + 1 : text.length;
        fragment.appendChild(createStoryOpenerDialogueQuoteSpan(text.slice(start, closeIndex), options));
        cursor = closeIndex;
    }
}

function applyStoryOpenerDialogueQuoteSpans(root, options = {}) {
    if (!root?.childNodes) return;
    for (const child of [...root.childNodes]) {
        if (child.nodeType === 3) {
            const text = child.nodeValue || '';
            if (findStoryOpenerQuoteStart(text, 0) < 0) continue;
            const fragment = document.createDocumentFragment();
            appendStoryOpenerDialogueQuotedText(fragment, text, options);
            child.replaceWith(fragment);
        } else if (child.nodeType === 1 && !['CODE', 'PRE'].includes(child.tagName)) {
            applyStoryOpenerDialogueQuoteSpans(child, options);
        }
    }
}

function renderStoryOpenerMarkdownToHtml(text = '', options = {}) {
    const html = renderStoryOpenerMarkdownBaseHtml(text);
    if (!html || typeof document === 'undefined') return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    applyStoryOpenerDialogueQuoteSpans(template.content, options);
    return template.innerHTML;
}

function createStoryOpenerOutputPreview(text = '') {
    const output = document.createElement('div');
    output.className = 'saga-story-opener-output';
    output.dataset.storyOpenerRichPreview = 'true';
    output.innerHTML = renderStoryOpenerMarkdownToHtml(text || '');
    return output;
}

function buildStoryOpenerRichClipboardHtml(text = '') {
    const body = renderStoryOpenerMarkdownToHtml(text, { inlineQuoteStyle: true });
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><div style="font-family:var(--SmartThemeFont, Segoe UI, sans-serif);line-height:1.5;">${body}</div></body></html>`;
}

function copyStoryOpenerTextWithTextarea(text = '') {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
}

async function copyStoryOpenerMarkdownToClipboard(text = '') {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    copyStoryOpenerTextWithTextarea(text);
}

function copyStoryOpenerRichSelectionFallback(html = '') {
    const wrap = document.createElement('div');
    wrap.contentEditable = 'true';
    wrap.style.position = 'fixed';
    wrap.style.left = '-9999px';
    wrap.style.top = '0';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const selection = window.getSelection?.();
    const range = document.createRange();
    range.selectNodeContents(wrap);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('copy');
    selection?.removeAllRanges();
    wrap.remove();
}

async function copyStoryOpenerRichTextToClipboard(text = '') {
    const html = buildStoryOpenerRichClipboardHtml(text);
    const ClipboardItemCtor = globalThis.ClipboardItem;
    if (navigator.clipboard?.write && ClipboardItemCtor) {
        await navigator.clipboard.write([new ClipboardItemCtor({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
        })]);
        return;
    }
    copyStoryOpenerRichSelectionFallback(html);
}

function readControlsFromRefs(refs = {}, base = {}) {
    const openingShapeMode = refs.openingShapeMode?.value || STORY_OPENER_DEFAULT_OPENING_SHAPE;
    return normalizeStoryOpenerControls({
        ...base,
        userPrompt: refs.userPrompt?.value || '',
        context: refs.context?.value || '',
        proseStyle: refs.proseStyle?.value || '',
        openingShape: openingShapeMode === STORY_OPENER_CUSTOM_OPENING_SHAPE
            ? refs.openingShape?.value || ''
            : openingShapeMode,
        characterFocus: refs.characterFocus?.value || '',
        pov: refs.pov?.value || '',
        tense: refs.tense?.value || '',
        targetLength: refs.targetLength || base.targetLength || 'scene',
        variantCount: normalizeStoryOpenerVariantCount(refs.variantCount?.value, base.variantCount || STORY_OPENER_VARIANT_COUNT_MIN),
    });
}

function makeRun(session = {}, stage = '', label = '', message = '') {
    return recordStoryOpenerRun(session, createStoryOpenerRun(stage, {
        label,
        message: message || label,
        status: 'running',
    }));
}

function finishRun(session = {}, run = {}, patch = {}) {
    return recordStoryOpenerRun(session, {
        ...run,
        ...patch,
        status: patch.status || 'complete',
        updatedAt: Date.now(),
        completedAt: Date.now(),
    });
}

function failRun(session = {}, run = {}, failure = {}) {
    return recordStoryOpenerRun(session, {
        ...run,
        status: 'error',
        failure: normalizeStoryOpenerFailure(failure),
        message: failure.message || 'Story Maker generation failed.',
        updatedAt: Date.now(),
        completedAt: Date.now(),
    });
}

function updateActiveStoryOpenerRunProgress(working = {}, run = {}, event = {}, options = {}) {
    if (!event?.message && !event?.label) return working;
    const current = getCachedExternalStoryOpenerSession(working.sessionId) || working;
    const nextRun = {
        ...run,
        ...(current.activeGeneration || {}),
        status: event.status || current.activeGeneration?.status || run.status || 'running',
        label: event.label || current.activeGeneration?.label || run.label,
        message: event.message || current.activeGeneration?.message || run.message,
        updatedAt: Date.now(),
        attemptCount: Math.max(Number(current.activeGeneration?.attemptCount) || 0, Number(event.attempt) || 0),
        maxAttempts: Math.max(Number(current.activeGeneration?.maxAttempts) || 0, Number(event.maxAttempts) || 0),
        ...(Array.isArray(event.attempts) ? { attempts: event.attempts } : {}),
    };
    const next = recordStoryOpenerRun(current, nextRun);
    saveStoryOpenerSession(next, { activate: true });
    refresh(options);
    return next;
}

function updateSessionStage(session = {}, patch = {}, options = {}) {
    const next = normalizeStoryOpenerSession({
        ...session,
        ...patch,
        updatedAt: Date.now(),
    });
    return saveStoryOpenerSession(next, options) || next;
}

async function runContextPacketStage(session = {}, state = {}, options = {}) {
    let working = makeRun(session, 'context_packet', 'Building Context Packet', 'Resolving active Loredecks, Context, and guardrails.');
    saveStoryOpenerSession(working);
    refresh(options);
    const run = working.activeGeneration;
    try {
        const result = await buildStoryOpenerContextPacket(working, state);
        working = normalizeStoryOpenerSession({
            ...working,
            sourceIntent: result.sourceIntent,
            lastSourceResolution: result.sourceResolution,
            snapshots: {
                ...(working.snapshots || {}),
                contextPacket: result.packet,
                guardrailSummary: {
                    mustUseCount: result.packet.counts.mustUseCount,
                    mustAvoidCount: result.packet.counts.mustAvoidCount,
                    freshFactCount: result.packet.counts.freshFactCount,
                },
            },
            currentStage: 'opener_brief',
            status: result.sourceResolution.status === 'missing' ? 'blocked' : 'draft',
        });
        working = finishRun(working, run, {
            message: `Resolved ${formatCount(result.sourceResolution.eligibleFactCount, 'eligible fact')} and ${formatCount(result.sourceResolution.blockedFactCount, 'blocked fact')}.`,
        });
        saveStoryOpenerSession(working);
        return { ok: true, session: working, packet: result.packet };
    } catch (error) {
        const failure = normalizeStoryOpenerFailure({
            code: 'context_packet_failed',
            stage: 'context_packet',
            message: error?.message || String(error || 'Context Packet failed.'),
            recovery: 'Check active Loredecks and Context, then retry Build Context Packet.',
        });
        working = failRun(working, run, failure);
        saveStoryOpenerSession(working);
        return { ok: false, session: working, failure };
    } finally {
        refresh(options);
    }
}

async function runBriefStage(session = {}, state = {}, options = {}) {
    let working = normalizeStoryOpenerSession(session);
    let packet = working.snapshots?.contextPacket || null;
    if (!packet) {
        const packetResult = await runContextPacketStage(working, state, options);
        if (!packetResult.ok) return packetResult;
        working = packetResult.session;
        packet = packetResult.packet;
    }
    working = makeRun(working, 'opener_brief', 'Drafting Opener Brief', 'Turning the Context Packet into opener instructions.');
    saveStoryOpenerSession(working);
    refresh(options);
    const run = working.activeGeneration;
    const result = await buildStoryOpenerBrief(working, packet, {
        onProgress: event => {
            working = updateActiveStoryOpenerRunProgress(working, run, event, options);
        },
    });
    if (!result.ok) {
        working = failRun(working, {
            ...run,
            attempts: result.attempts || [],
            attemptCount: result.attempts?.length || 0,
            maxAttempts: result.failure?.details?.maxAttempts || result.attempts?.[0]?.maxAttempts || 0,
        }, result.failure);
        saveStoryOpenerSession(working);
        refresh(options);
        return { ok: false, session: working, failure: result.failure };
    }
    working = normalizeStoryOpenerSession({
        ...working,
        snapshots: {
            ...(working.snapshots || {}),
            contextPacket: result.packet,
            factRefinement: result.refinement || null,
            openerBriefRaw: result.rawText || '',
        },
        openerBrief: result.brief,
        currentStage: 'draft_variants',
        status: 'draft',
    });
    working = finishRun(working, run, {
        message: result.repairAttempted ? 'Built Opener Brief after JSON repair.' : 'Built Opener Brief.',
        attempts: result.attempts || [],
        attemptCount: result.attempts?.length || 0,
        maxAttempts: result.attempts?.[0]?.maxAttempts || 0,
    });
    if (result.refinementFailure) {
        working.snapshots.factRefinementFailure = result.refinementFailure;
    }
    saveStoryOpenerSession(working);
    refresh(options);
    return { ok: true, session: working, brief: result.brief, packet: result.packet };
}

async function runDraftStage(session = {}, state = {}, options = {}) {
    let working = normalizeStoryOpenerSession(session);
    let packet = working.snapshots?.contextPacket || null;
    let brief = working.openerBrief || null;
    if (!brief || !packet) {
        const briefResult = await runBriefStage(working, state, options);
        if (!briefResult.ok) return briefResult;
        working = briefResult.session;
        packet = briefResult.packet;
        brief = briefResult.brief;
    }
    const variantCount = Math.max(STORY_OPENER_VARIANT_COUNT_MIN, Math.min(STORY_OPENER_VARIANT_COUNT_MAX, Number(working.controls?.variantCount) || STORY_OPENER_VARIANT_COUNT_MIN));
    const retryIndexesForLabel = Array.isArray(options.retryVariantIndexes)
        ? options.retryVariantIndexes.map(index => Math.floor(Number(index))).filter(index => Number.isFinite(index))
        : [];
    const requestedVariantCount = retryIndexesForLabel.length || variantCount;
    working = makeRun(
        working,
        'draft_variants',
        retryIndexesForLabel.length
            ? `Retrying ${requestedVariantCount} failed variant${requestedVariantCount === 1 ? '' : 's'}`
            : variantCount === 1
            ? `${options.revisionPrompt ? 'Revising' : 'Drafting'} Variant A`
            : `${options.revisionPrompt ? 'Revising' : 'Drafting'} ${variantCount} variants`,
        retryIndexesForLabel.length
            ? `Retrying ${requestedVariantCount} failed opener variant${requestedVariantCount === 1 ? '' : 's'}.`
            : `Starting ${variantCount} opener variant${variantCount === 1 ? '' : 's'}.`,
    );
    saveStoryOpenerSession(working);
    refresh(options);
    const run = working.activeGeneration;
    const previous = getStoryOpenerSelectedVariant(working);
    const result = await writeStoryOpenerVariants(working, packet, brief, {
        revisionPrompt: options.revisionPrompt || '',
        variantIndexes: options.retryVariantIndexes,
        onProgress: event => {
            working = updateActiveStoryOpenerRunProgress(working, run, event, options);
        },
    });
    if (!result.ok) {
        working = failRun(working, {
            ...run,
            attempts: result.attempts || [],
            attemptCount: result.attempts?.length || 0,
            maxAttempts: result.failure?.details?.maxAttempts || result.attempts?.[0]?.maxAttempts || 0,
            failedUnitCount: result.failedVariantIndexes?.length || 0,
        }, result.failure);
        saveStoryOpenerSession(working);
        refresh(options);
        return { ok: false, session: working, failure: result.failure };
    }
    const history = [...(working.revisionHistory || [])];
    if (options.revisionPrompt && previous?.text) {
        history.push({
            id: `revision-${Date.now().toString(36)}`,
            text: previous.text,
            instruction: options.revisionPrompt,
            variantId: previous.id,
            createdAt: Date.now(),
            sourceRunId: run?.id || '',
        });
    }
    const retryIndexes = Array.isArray(options.retryVariantIndexes)
        ? options.retryVariantIndexes.map(index => Math.floor(Number(index))).filter(index => Number.isFinite(index))
        : [];
    const existingVariants = retryIndexes.length
        ? working.variants.filter(variant => !retryIndexes.includes(Number(variant.variantIndex)))
        : [];
    const variants = [...existingVariants, ...result.variants]
        .map((variant, index) => ({
            ...variant,
            sourceRunId: run?.id || '',
            status: index === 0 ? 'selected' : 'draft',
        }))
        .sort((left, right) => (Number(left.variantIndex) || 0) - (Number(right.variantIndex) || 0));
    const selectedVariantId = retryIndexes.length && previous?.id && variants.some(variant => variant.id === previous.id)
        ? previous.id
        : (variants[0]?.id || '');
    for (const variant of variants) {
        variant.status = variant.id === selectedVariantId ? 'selected' : 'draft';
    }
    working = normalizeStoryOpenerSession({
        ...working,
        variants,
        selectedVariantId,
        revisionHistory: history,
        currentStage: 'review_copy',
        status: 'complete',
    });
    const message = result.failures?.length
        ? `Created ${formatCount(variants.length, 'variant')} with ${formatCount(result.failures.length, 'provider failure')}.`
        : `Created ${formatCount(variants.length, 'variant')}.`;
    const finishLabel = variants.length === 1
        ? `${options.revisionPrompt ? 'Revised' : 'Drafted'} Variant A`
        : `${options.revisionPrompt ? 'Revised' : 'Drafted'} ${variants.length} variants`;
    working = finishRun(working, run, {
        label: finishLabel,
        message,
        attempts: result.attempts || [],
        attemptCount: result.attempts?.length || 0,
        maxAttempts: result.attempts?.[0]?.maxAttempts || 0,
        failedUnitCount: result.failedVariantIndexes?.length || 0,
        succeededUnitCount: variants.length,
        partial: !!result.failures?.length,
        ...(result.partialFailure ? { failure: result.partialFailure } : {}),
    });
    saveStoryOpenerSession(working);
    refresh(options);
    return { ok: true, session: working, variants };
}

async function runFullPipeline(session = {}, state = {}, options = {}) {
    const packetResult = await runContextPacketStage(session, state, options);
    if (!packetResult.ok) return packetResult;
    const briefResult = await runBriefStage(packetResult.session, state, options);
    if (!briefResult.ok) return briefResult;
    return runDraftStage(briefResult.session, state, options);
}

function createNewStoryOpener(state = {}, options = {}) {
    const context = buildStoryOpenerContextLabel(state, {});
    const sourceIntent = buildStoryOpenerSourceIntentFromState(state, { context });
    const fandomText = sourceIntent.fandoms?.length ? sourceIntent.fandoms.join(', ') : '';
    const session = normalizeStoryOpenerSession({
        sessionId: createStoryOpenerSessionId(context || 'opener'),
        title: context || 'Untitled opener',
        controls: {
            context,
            proseStyle: fandomText ? `${fandomText} prose style for the selected story position` : '',
            openingShape: STORY_OPENER_DEFAULT_OPENING_SHAPE,
            pov: STORY_OPENER_POV_OPTIONS[2].value,
            tense: STORY_OPENER_TENSE_OPTIONS[0].value,
            targetLength: 'scene',
        },
        sourceIntent,
        currentStage: 'inputs',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    saveStoryOpenerSession(session);
    refresh(options);
}

function handleStoryOpenerStageAction(stage = {}, options = {}) {
    if (stage.action === 'add_loredecks') {
        if (typeof options.navigateRuntimeTab === 'function' && options.navigateRuntimeTab('loredecks')) {
            toast('Add a Loredeck, then return to Story Maker.', 'info');
            return true;
        }
    }
    return false;
}

function getStoryOpenerLiveSourceOptions(session = {}, state = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    if (normalized.sourceIntent?.stackItems?.length || normalized.sourceIntent?.packIds?.length) return {};
    const sourceIntent = buildStoryOpenerSourceIntentFromState(state, normalized.controls);
    if (!sourceIntent.stackItems.length && !sourceIntent.packIds.length) return {};
    return { sourceIntent };
}

function createStoryOpenerStageBar(session = {}, state = {}, options = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-stage-guide saga-story-opener-stage-guide';
    const list = document.createElement('div');
    list.className = 'saga-loredeck-creator-stage-list saga-story-opener-stage-list';
    const sourceOptions = getStoryOpenerLiveSourceOptions(session, state);
    const stages = getStoryOpenerStageDescriptors(session, sourceOptions);
    for (const stage of stages) {
        const item = document.createElement('div');
        item.className = `saga-loredeck-creator-stage-item saga-loredeck-creator-stage-${stage.status}`;
        if (stage.action) {
            item.classList.add('saga-story-opener-stage-action', `saga-story-opener-stage-action-${stage.action}`);
        }
        if (stage.isActive) item.classList.add('saga-loredeck-creator-stage-active');
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'saga-loredeck-creator-stage-main';
        main.setAttribute('aria-label', stage.actionLabel ? `${stage.actionLabel}: ${stage.actionTooltip || stage.dependency || stage.detail}` : `${stage.label}: ${stage.detail}`);
        addTooltip(main, stage.actionTooltip || (stage.status === 'locked' ? stage.dependency : `${stage.label}: ${stage.detail}`));
        main.addEventListener('click', () => {
            if (stage.status === 'locked') {
                if (handleStoryOpenerStageAction(stage, options)) return;
                if (stage.dependency) toast(stage.dependency, 'info');
                return;
            }
            const scrollState = captureStoryOpenerScrollState();
            const next = normalizeStoryOpenerSession({
                ...session,
                currentStage: stage.id,
                updatedAt: Date.now(),
            });
            saveStoryOpenerSession(next);
            refreshStoryOpenerStageSwitch(options, scrollState);
        });
        const number = document.createElement('span');
        number.className = 'saga-loredeck-creator-stage-number';
        number.textContent = String(stage.number);
        main.appendChild(number);
        const body = document.createElement('span');
        body.className = 'saga-loredeck-creator-stage-body';
        const label = document.createElement('span');
        label.className = 'saga-loredeck-creator-stage-label';
        label.textContent = stage.label;
        body.appendChild(label);
        if (stage.actionLabel) {
            const actionLabel = document.createElement('span');
            actionLabel.className = 'saga-story-opener-stage-action-label';
            actionLabel.textContent = stage.actionLabel;
            body.appendChild(actionLabel);
        }
        const detail = document.createElement('span');
        detail.className = 'saga-loredeck-creator-stage-detail';
        detail.textContent = stage.status === 'locked' ? stage.dependency : stage.detail;
        body.appendChild(detail);
        main.appendChild(body);
        item.appendChild(main);
        if (stage.resettable) {
            item.classList.add('saga-loredeck-creator-stage-resettable');
            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'saga-loredeck-creator-stage-reset';
            reset.textContent = '↶';
            reset.disabled = !!session.activeGeneration;
            addTooltip(reset, reset.disabled ? 'Wait for the active opener run to finish.' : 'Reset to this step');
            reset.setAttribute('aria-label', `Reset to ${stage.label}`);
            reset.addEventListener('click', event => {
                event.stopPropagation();
                if (reset.disabled) return;
                const next = resetStoryOpenerToStage(session, stage.id);
                saveStoryOpenerSession(next);
                refresh(options);
            });
            item.appendChild(reset);
        }
        list.appendChild(item);
    }
    wrap.appendChild(list);
    return wrap;
}

function createStoryOpenerGenerationStatus(session = {}) {
    const run = session?.activeGeneration || null;
    const status = String(run?.status || '').trim().toLowerCase();
    if (!run || !STORY_OPENER_GENERATION_STATUSES.has(status)) return null;
    const now = Date.now();
    const startedAt = getStoryOpenerRunStartedAt(run, now);
    const labelText = getStoryOpenerGenerationLabel(run);
    const message = getStoryOpenerGenerationMessage(run);
    const metaText = getStoryOpenerGenerationMeta(run);
    const row = createLoredeckJobStatusRow({
        active: true,
        status: status || 'running',
        label: labelText,
        message,
        elapsedMs: now - startedAt,
        metaText,
    }, {
        compact: true,
    });
    row.classList.add('saga-story-opener-generation-status');
    row.dataset.sagaStoryOpenerGenerationActive = 'true';
    row.dataset.sagaStoryOpenerGenerationId = String(run.id || '');
    row.dataset.sagaStoryOpenerGenerationStage = String(run.stage || '');
    row.dataset.sagaStoryOpenerGenerationStartedAt = String(startedAt);
    row.dataset.sagaStoryOpenerGenerationLabel = labelText;
    row.dataset.sagaStoryOpenerGenerationMessage = message;
    row.dataset.sagaStoryOpenerGenerationMeta = metaText;
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
    row.setAttribute('aria-label', `${labelText} ${message}`);
    startStoryOpenerGenerationTicker();
    return row;
}

function getVisibleStoryOpenerStage(session = {}, state = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const stages = getStoryOpenerStageDescriptors(normalized, getStoryOpenerLiveSourceOptions(normalized, state));
    return stages.find(stage => stage.id === normalized.currentStage && stage.status !== 'locked')
        || stages.find(stage => stage.isActive && stage.status !== 'locked')
        || stages.find(stage => stage.status !== 'locked')
        || stages[0]
        || null;
}

function createStoryOpenerStageCard(stageId = '', session = {}, state = {}, options = {}) {
    if (stageId === 'context_packet') return createPacketCard(session, state, options);
    if (stageId === 'opener_brief') return createBriefCard(session, state, options);
    if (stageId === 'draft_variants') return createVariantsCard(session, state, options);
    if (stageId === 'review_copy') return createReviewCard(session, state, options);
    return createInputsCard(session, state, options);
}

function appendSourceActions(container, session = {}, state = {}, options = {}) {
    const row = document.createElement('div');
    row.className = 'saga-primary-actions saga-story-opener-source-actions';
    row.appendChild(createButton('Refresh From Saved Sources', 'Resolve this opener source intent against latest Loredecks and rebuild the Context Packet.', async btn => {
        btn.disabled = true;
        const next = resetStoryOpenerToStage(session, 'context_packet');
        saveStoryOpenerSession(next);
        await runContextPacketStage(next, state, options);
    }, 'saga-primary-button'));
    row.appendChild(createButton('Use Current Active Stack', 'Replace this opener source intent with the current active Loredeck stack and Context.', btn => {
        btn.disabled = true;
        const controls = normalizeStoryOpenerControls(session.controls || {});
        const sourceIntent = buildStoryOpenerSourceIntentFromState(state, controls);
        const next = resetStoryOpenerToStage({
            ...session,
            sourceIntent,
            controls: {
                ...controls,
                context: controls.context || sourceIntent.context,
                proseStyle: controls.proseStyle || (sourceIntent.fandoms?.length ? `${sourceIntent.fandoms.join(', ')} prose style for the selected story position` : ''),
            },
        }, 'context_packet');
        saveStoryOpenerSession(next);
        refresh(options);
    }));
    container.appendChild(row);
}

function createInputsCard(session = {}, state = {}, options = {}) {
    const controls = normalizeStoryOpenerControls(session.controls || {});
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-story-opener-card';
    card.dataset.storyOpenerAnchor = 'inputs';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Inputs';
    card.appendChild(title);

    const refs = {};
    const grid = document.createElement('div');
    grid.className = 'saga-story-opener-input-grid';
    refs.context = createTextArea(controls.context, 'Harry Potter Book 6 - January, after...', 2, 2000);
    grid.appendChild(createField('Context', 'Manual story position. If empty or stale, set Context before generation.', refs.context));
    refs.proseStyle = createTextArea(controls.proseStyle, 'Harry Potter prose style for Half-Blood Prince era', 2, 1200);
    grid.appendChild(createField('Prose Style', 'Pre-populated from detected fandoms but fully editable.', refs.proseStyle));
    refs.userPrompt = createTextArea(controls.userPrompt, 'Open on Hermione after...', 4, 5000);
    grid.appendChild(createField('User Prompt', 'What this opener should accomplish.', refs.userPrompt));
    refs.characterFocus = createTextInput(controls.characterFocus, 'Hermione, Ron, Harry, Draco...', 800);
    grid.appendChild(createField('Character Focus', 'Optional focus; leave empty for source-driven focus.', refs.characterFocus));
    const openingShapeMode = getStoryOpenerOpeningShapeMode(controls.openingShape);
    refs.openingShapeMode = createSelectInput([
        ...STORY_OPENER_OPENING_SHAPES.map(shape => ({ value: shape, label: shape })),
        { value: STORY_OPENER_CUSTOM_OPENING_SHAPE, label: 'Custom' },
    ], openingShapeMode);
    grid.appendChild(createField('Opening Shape', 'Choose a shape preset, or select Custom to type one.', refs.openingShapeMode));
    refs.openingShape = createTextInput(openingShapeMode === STORY_OPENER_CUSTOM_OPENING_SHAPE ? controls.openingShape : '', 'Describe the custom opening shape...', 180);
    const customShapeField = createField('Custom Shape', 'Only used when Opening Shape is Custom.', refs.openingShape);
    customShapeField.classList.add('saga-story-opener-custom-shape-field');
    setStoryOpenerFieldHidden(customShapeField, openingShapeMode !== STORY_OPENER_CUSTOM_OPENING_SHAPE);
    refs.openingShapeMode.addEventListener('change', () => {
        setStoryOpenerFieldHidden(customShapeField, refs.openingShapeMode.value !== STORY_OPENER_CUSTOM_OPENING_SHAPE);
    });
    grid.appendChild(customShapeField);
    const povControl = createSegmentedChoiceControl(STORY_OPENER_POV_OPTIONS, controls.pov, 'saga-story-opener-pov-control');
    refs.pov = povControl.ref;
    grid.appendChild(createField('PoV', 'Point of view.', povControl.element));
    const tenseControl = createSegmentedChoiceControl(STORY_OPENER_TENSE_OPTIONS, controls.tense, 'saga-story-opener-tense-control');
    refs.tense = tenseControl.ref;
    grid.appendChild(createField('Tense', 'Narrative tense.', tenseControl.element));
    card.appendChild(grid);

    refs.targetLength = controls.targetLength;
    const lengthHeading = document.createElement('div');
    lengthHeading.className = 'saga-story-opener-subtitle saga-story-opener-length-heading';
    lengthHeading.textContent = 'Length';
    card.appendChild(lengthHeading);
    const lengthRow = document.createElement('div');
    lengthRow.className = 'saga-story-opener-length-row';
    lengthRow.classList.add('saga-story-opener-segmented-control');
    lengthRow.setAttribute('role', 'radiogroup');
    lengthRow.setAttribute('aria-label', 'Target length');
    for (const target of STORY_OPENER_TARGET_LENGTHS) {
        const btn = createButton(target.label, target.description, button => {
            refs.targetLength = target.id;
            setStoryOpenerSegmentedSelection(lengthRow, button);
        }, 'saga-mode-button saga-story-opener-segment');
        btn.setAttribute('role', 'radio');
        const selected = target.id === controls.targetLength;
        btn.classList.toggle('saga-mode-button-active', selected);
        btn.setAttribute('aria-checked', selected ? 'true' : 'false');
        lengthRow.appendChild(btn);
    }
    card.appendChild(lengthRow);

    const variantCountControl = createVariantCountControl(controls.variantCount);
    refs.variantCount = variantCountControl.input;
    card.appendChild(createField('Variant Count', 'Draft 1-5 opener variants in one pass after the brief.', variantCountControl.element));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Save Inputs', 'Save current opener inputs without generating.', () => {
        const nextControls = readControlsFromRefs(refs, controls);
        const next = updateSessionStage(session, {
            controls: nextControls,
            title: nextControls.context || nextControls.userPrompt || session.title,
            sourceIntent: {
                ...(session.sourceIntent || {}),
                context: nextControls.context,
            },
            currentStage: 'context_packet',
            status: 'draft',
        });
        toast('Story Maker inputs saved.', 'success');
        refresh(options);
        return next;
    }, 'saga-primary-button'));
    const providerBusy = !!session.activeGeneration;
    const buildContextButton = createButton('Build Context Packet', 'Resolve latest lore and build the opener Context Packet.', async btn => {
        if (btn.disabled) return;
        setStoryOpenerProviderActionsDisabled(actions, true);
        const nextControls = readControlsFromRefs(refs, controls);
        const next = updateSessionStage(session, {
            controls: nextControls,
            title: nextControls.context || nextControls.userPrompt || session.title,
            currentStage: 'context_packet',
            status: 'draft',
        });
        try {
            await runContextPacketStage(next, state, options);
        } finally {
            setStoryOpenerProviderActionsDisabled(actions, false);
        }
    });
    buildContextButton.dataset.storyOpenerProviderAction = 'true';
    buildContextButton.disabled = providerBusy;
    actions.appendChild(buildContextButton);
    const fullPipelineButton = createButton('Generate Full Pipeline', 'Build packet, brief, and opener variants in sequence.', async btn => {
        if (btn.disabled) return;
        setStoryOpenerProviderActionsDisabled(actions, true);
        const nextControls = readControlsFromRefs(refs, controls);
        const next = updateSessionStage(session, {
            controls: nextControls,
            title: nextControls.context || nextControls.userPrompt || session.title,
            currentStage: 'context_packet',
            status: 'draft',
        });
        try {
            await runFullPipeline(next, state, options);
        } finally {
            setStoryOpenerProviderActionsDisabled(actions, false);
        }
    }, 'saga-primary-button');
    fullPipelineButton.dataset.storyOpenerProviderAction = 'true';
    fullPipelineButton.disabled = providerBusy;
    actions.appendChild(fullPipelineButton);
    card.appendChild(actions);
    return card;
}

function createPacketCard(session = {}, state = {}, options = {}) {
    const packet = session.snapshots?.contextPacket || null;
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-story-opener-card';
    card.dataset.storyOpenerAnchor = 'context-packet';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Context Packet';
    card.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const resolution = session.lastSourceResolution || {};
    meta.appendChild(createStatusPill(resolution.status || 'not built', 'Source resolution status for this opener.', { tone: resolution.status === 'current' ? 'success' : resolution.status === 'missing' ? 'danger' : 'warning', kind: 'status' }));
    if (packet?.fandoms?.length) meta.appendChild(createStatusPill(packet.fandoms.join(', '), 'Detected fandoms from latest source stack.', { tone: 'source', kind: 'source', maxChars: 48 }));
    meta.appendChild(createStatusPill(formatCount(resolution.eligibleFactCount || packet?.counts?.allowedFactCount || 0, 'eligible fact'), 'Facts allowed by current Context gates.', { tone: 'info', kind: 'count' }));
    meta.appendChild(createStatusPill(formatCount(resolution.blockedFactCount || packet?.counts?.blockedFactCount || 0, 'blocked fact'), 'Future, expired, or blocked facts that must not leak.', { tone: resolution.blockedFactCount ? 'warning' : 'muted', kind: 'count' }));
    card.appendChild(meta);
    if (packet) {
        const grid = document.createElement('div');
        grid.className = 'saga-story-opener-summary-grid';
        grid.appendChild(createKeyValue('Context', packet.context || 'unset', 'Resolved opener Context.'));
        grid.appendChild(createKeyValue('Must use', String(packet.counts?.mustUseCount || 0), 'Highest-priority allowed facts.'));
        grid.appendChild(createKeyValue('Fresh', String(packet.counts?.freshFactCount || 0), 'Fresh or current-window facts.'));
        grid.appendChild(createKeyValue('Must avoid', String(packet.counts?.mustAvoidCount || 0), 'Hard exclusions for future/blocked lore.'));
        card.appendChild(grid);
        if (packet.mustUse?.length) card.appendChild(createFactList('Top facts', packet.mustUse.slice(0, 5)));
        if (packet.mustAvoid?.length) card.appendChild(createFactList('Guardrails', packet.mustAvoid.slice(0, 5), true));
    } else {
        card.appendChild(createEmptyMessage('Build a Context Packet to rank latest lore and guardrails.'));
    }
    appendSourceActions(card, session, state, options);
    return card;
}

function createFactList(titleText = '', facts = [], guardrail = false) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-story-opener-fact-list';
    const title = document.createElement('div');
    title.className = 'saga-story-opener-subtitle';
    title.textContent = titleText;
    wrap.appendChild(title);
    for (const fact of facts) {
        const item = document.createElement('div');
        item.className = `saga-story-opener-fact ${guardrail ? 'saga-story-opener-guardrail' : ''}`;
        const head = document.createElement('strong');
        head.textContent = fact.title || fact.id || 'Fact';
        item.appendChild(head);
        const body = document.createElement('span');
        body.textContent = fact.fact || fact.lifecycleReason || '';
        item.appendChild(body);
        wrap.appendChild(item);
    }
    return wrap;
}

function createBriefCard(session = {}, state = {}, options = {}) {
    const brief = session.openerBrief || null;
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-story-opener-card';
    card.dataset.storyOpenerAnchor = 'opener-brief';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Opener Brief';
    card.appendChild(title);
    if (brief) {
        const grid = document.createElement('div');
        grid.className = 'saga-story-opener-summary-grid';
        grid.appendChild(createKeyValue('Premise', brief.premise || 'unset', 'Brief premise.'));
        grid.appendChild(createKeyValue('Style', brief.styleGuidance || brief.proseStyle || 'unset', 'Style guidance.'));
        grid.appendChild(createKeyValue('Shape', brief.openingShape || 'unset', 'Opening shape.'));
        grid.appendChild(createKeyValue('Length', brief.targetLength || 'scene', 'Target length band.'));
        card.appendChild(grid);
        if (brief.scenePlan?.length) {
            const list = document.createElement('ol');
            list.className = 'saga-story-opener-beat-list';
            for (const beat of brief.scenePlan.slice(0, 8)) {
                const item = document.createElement('li');
                item.textContent = beat;
                list.appendChild(item);
            }
            card.appendChild(list);
        }
    } else {
        card.appendChild(createEmptyMessage('Build an Opener Brief after the Context Packet.'));
    }
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Build Opener Brief', 'Ask the Reasoning Provider to turn the Context Packet into a precise writing brief.', async btn => {
        btn.disabled = true;
        await runBriefStage(session, state, options);
    }, 'saga-primary-button'));
    card.appendChild(actions);
    return card;
}

function createVariantsCard(session = {}, state = {}, options = {}) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-story-opener-card';
    card.dataset.storyOpenerAnchor = 'draft-variants';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Draft Variants';
    card.appendChild(title);
    if (session.variants?.length) {
        const selected = getStoryOpenerSelectedVariant(session);
        const nav = document.createElement('div');
        nav.className = 'saga-story-opener-carousel-nav';
        for (const variant of session.variants) {
            const btn = createButton(variant.label || variant.id, 'Select this opener variant.', () => {
                const next = normalizeStoryOpenerSession({
                    ...session,
                    selectedVariantId: variant.id,
                    variants: session.variants.map(item => ({ ...item, status: item.id === variant.id ? 'selected' : 'draft' })),
                });
                saveStoryOpenerSession(next);
                refresh(options);
            }, 'saga-mode-button');
            if (variant.id === selected?.id) btn.classList.add('saga-mode-button-active');
            nav.appendChild(btn);
        }
        card.appendChild(nav);
        card.appendChild(createStoryOpenerOutputPreview(selected?.text || ''));
    } else {
        const count = normalizeStoryOpenerVariantCount(session.controls?.variantCount);
        card.appendChild(createEmptyMessage(`Draft ${formatStoryOpenerVariantCount(count)} from the Opener Brief.`));
    }
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Draft Opener', 'Ask the Reasoning Provider to write opener text from the brief.', async btn => {
        btn.disabled = true;
        await runDraftStage(session, state, options);
    }, 'saga-primary-button'));
    card.appendChild(actions);
    return card;
}

function createReviewCard(session = {}, state = {}, options = {}) {
    const selected = getStoryOpenerSelectedVariant(session);
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-story-opener-card';
    card.dataset.storyOpenerAnchor = 'review-copy';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Review & Copy';
    card.appendChild(title);
    const revise = createTextArea(openerUiState.revisionPrompt, 'Make Hermione more prominent; start with dialogue; sharpen the Horcrux tension...', 3, 5000);
    revise.addEventListener('input', () => {
        openerUiState.revisionPrompt = revise.value;
    });
    if (selected?.text) card.appendChild(createStoryOpenerOutputPreview(selected.text));
    else card.appendChild(createEmptyMessage('Draft an opener before reviewing or copying.'));
    card.appendChild(createField('Revision Prompt', 'Optional instruction for revising the selected opener.', revise));
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-story-opener-review-actions';
    const copyMarkdown = createButton('Copy Markdown to Clipboard', 'Copy the selected opener as raw Markdown text.', async () => {
        if (!selected?.text) {
            toast('No opener text to copy.', 'warning');
            return;
        }
        try {
            await copyStoryOpenerMarkdownToClipboard(selected.text);
            toast('Markdown opener copied.', 'success');
        } catch (error) {
            console.warn('[Saga] Story Maker Markdown copy failed:', error);
            toast(error?.message || 'Markdown opener could not be copied.', 'error');
        }
    }, 'saga-primary-button');
    copyMarkdown.disabled = !selected?.text;
    actions.appendChild(copyMarkdown);
    const copyRich = createButton('Copy Rich-Text to Clipboard', 'Copy the selected opener with rendered Markdown and dialogue quote color.', async () => {
        if (!selected?.text) {
            toast('No opener text to copy.', 'warning');
            return;
        }
        try {
            await copyStoryOpenerRichTextToClipboard(selected.text);
            toast('Rich-text opener copied.', 'success');
        } catch (error) {
            console.warn('[Saga] Story Maker rich-text copy failed:', error);
            try {
                await copyStoryOpenerMarkdownToClipboard(selected.text);
                toast('Rich-text copy failed; Markdown opener copied instead.', 'warning');
            } catch (_fallbackError) {
                toast(error?.message || 'Rich-text opener could not be copied.', 'error');
            }
        }
    });
    copyRich.disabled = !selected?.text;
    actions.appendChild(copyRich);
    actions.appendChild(createButton('Revise Selected', 'Revise the selected opener using the revision prompt.', async btn => {
        if (!selected?.text) {
            toast('Draft an opener before revising.', 'warning');
            return;
        }
        const instruction = revise.value.trim();
        if (!instruction) {
            toast('Enter a revision prompt first.', 'warning');
            return;
        }
        btn.disabled = true;
        openerUiState.revisionPrompt = instruction;
        await runDraftStage(session, state, { ...options, revisionPrompt: instruction });
    }));
    card.appendChild(actions);
    if (session.revisionHistory?.length) {
        const history = document.createElement('details');
        history.className = 'saga-story-opener-history';
        const summary = document.createElement('summary');
        summary.textContent = `Revision history (${session.revisionHistory.length})`;
        history.appendChild(summary);
        for (const entry of [...session.revisionHistory].reverse().slice(0, 8)) {
            const item = document.createElement('div');
            item.className = 'saga-story-opener-history-item';
            const prompt = document.createElement('strong');
            prompt.textContent = entry.instruction || 'Revision';
            item.appendChild(prompt);
            const text = document.createElement('span');
            text.textContent = entry.text.slice(0, 360);
            item.appendChild(text);
            history.appendChild(item);
        }
        card.appendChild(history);
    }
    return card;
}

function createFailureCard(session = {}, state = {}, options = {}) {
    const failure = session.lastGenerationResult?.failure || null;
    if (!failure) return null;
    const card = document.createElement('div');
    card.className = 'saga-story-opener-failure';
    const title = document.createElement('strong');
    title.textContent = failure.code || 'generation_failed';
    card.appendChild(title);
    const message = document.createElement('span');
    message.textContent = failure.message || 'Story Maker generation failed.';
    card.appendChild(message);
    if (failure.recovery) {
        const recovery = document.createElement('span');
        recovery.textContent = failure.recovery;
        card.appendChild(recovery);
    }
    const attempts = Array.isArray(session.lastGenerationResult?.attempts)
        ? session.lastGenerationResult.attempts
        : (Array.isArray(failure.details?.attempts) ? failure.details.attempts : []);
    if (attempts.length) {
        const details = document.createElement('details');
        details.className = 'saga-story-opener-failure-details';
        const summary = document.createElement('summary');
        summary.textContent = `Details (${attempts.length} attempt${attempts.length === 1 ? '' : 's'})`;
        details.appendChild(summary);
        for (const attempt of attempts.slice(-8)) {
            const row = document.createElement('div');
            row.className = 'saga-story-opener-failure-attempt';
            const label = document.createElement('strong');
            const unit = attempt.variantLabel || getStoryOpenerStageLabel(attempt.stage);
            label.textContent = `${unit} attempt ${attempt.attempt || 1}`;
            row.appendChild(label);
            const text = document.createElement('span');
            text.textContent = attempt.status === 'complete'
                ? 'Completed.'
                : `${attempt.errorCode || 'error'}${attempt.message ? `: ${attempt.message}` : ''}`;
            row.appendChild(text);
            details.appendChild(row);
        }
        card.appendChild(details);
    }
    const stage = failure.stage || session.lastGenerationResult?.stage || '';
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-story-opener-failure-actions';
    const hasActiveRun = !!session.activeGeneration;
    if (['context_packet', 'opener_brief', 'draft_variants'].includes(stage)) {
        const retry = createButton('Retry Failed Stage', 'Retry the failed Story Maker stage.', async btn => {
            btn.disabled = true;
            if (stage === 'context_packet') await runContextPacketStage(session, state, options);
            else if (stage === 'opener_brief') await runBriefStage(session, state, options);
            else await runDraftStage(session, state, options);
        });
        retry.disabled = hasActiveRun;
        actions.appendChild(retry);
    }
    const failedVariantIndexes = Array.isArray(failure.details?.failedVariantIndexes)
        ? failure.details.failedVariantIndexes.map(index => Math.floor(Number(index))).filter(index => Number.isFinite(index))
        : [];
    if (stage === 'draft_variants' && session.variants?.length && failedVariantIndexes.length) {
        const retryVariants = createButton('Retry Failed Variants', 'Retry only the variant calls that failed after automatic retries.', async btn => {
            btn.disabled = true;
            await runDraftStage(session, state, { ...options, retryVariantIndexes: failedVariantIndexes });
        }, 'saga-primary-button');
        retryVariants.disabled = hasActiveRun;
        actions.appendChild(retryVariants);
    }
    if (actions.childNodes.length) card.appendChild(actions);
    return card;
}

function createSessionShelf(index = {}, state = {}, options = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-story-opener-shelf';
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-story-opener-shelf-actions';
    actions.appendChild(createButton('New Opener', 'Create a new Story Maker session.', () => createNewStoryOpener(state, options), 'saga-primary-button'));
    wrap.appendChild(actions);
    const sessions = Object.values(index.sessions || {})
        .sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0));
    if (!sessions.length) {
        wrap.appendChild(createEmptyMessage('No saved openers yet.'));
        return wrap;
    }
    const picker = document.createElement('details');
    picker.className = 'saga-story-opener-session-picker';
    picker.open = !index.activeSessionId;
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.textContent = `Saved openers (${sessions.length})`;
    summary.appendChild(label);
    const hint = document.createElement('span');
    hint.textContent = 'manage';
    summary.appendChild(hint);
    picker.appendChild(summary);
    const list = document.createElement('div');
    list.className = 'saga-story-opener-session-list';
    for (const record of sessions.slice(0, 8)) {
        const row = document.createElement('div');
        row.className = 'saga-story-opener-session-row';
        if (record.sessionId === index.activeSessionId) row.classList.add('saga-story-opener-session-row-active');
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'saga-story-opener-session-main';
        const title = document.createElement('strong');
        title.textContent = record.title || 'Untitled opener';
        main.appendChild(title);
        const meta = document.createElement('span');
        meta.textContent = `${record.currentStage || 'inputs'} | ${record.sourceSummary || record.sourceMode || 'sources'}`;
        main.appendChild(meta);
        main.addEventListener('click', () => {
            const payload = getCachedExternalStoryOpenerSession(record.sessionId);
            if (payload) {
                saveStoryOpenerSession(payload);
                refresh(options);
                return;
            }
            loadStoryOpenerPayloadIfNeeded(record, options, { activate: true });
        });
        row.appendChild(main);
        const del = createButton('Delete', 'Delete this Story Maker session and its payload file.', () => {
            const result = removeExternalStoryOpenerSessionSync(record.sessionId, { sessionFile: record.sessionFile || record.payloadFile });
            if (!result.ok) toast(result.error || 'Story Maker session could not be deleted.', 'error');
            else toast('Story Maker session deleted.', 'success');
            refresh(options);
        }, 'saga-story-opener-delete-button');
        row.appendChild(del);
        list.appendChild(row);
    }
    picker.appendChild(list);
    wrap.appendChild(picker);
    return wrap;
}

function renderActiveSession(container, session = {}, state = {}, options = {}) {
    const sourceOptions = getStoryOpenerLiveSourceOptions(session, state);
    const readiness = getStoryOpenerReadiness(session, sourceOptions);
    const visibleStage = getVisibleStoryOpenerStage(session, state);
    const header = document.createElement('div');
    header.className = 'saga-story-opener-active-header';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = session.title || 'Untitled opener';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-runtime-help';
    subtitle.textContent = readiness.ready ? 'Ready to build or revise.' : readiness.missingText;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(session.status || 'draft', 'Story Maker session status.', { tone: session.status === 'complete' ? 'success' : session.status === 'blocked' ? 'warning' : 'info', kind: 'status' }));
    chips.appendChild(createStatusPill(session.currentStage || 'inputs', 'Current Story Maker stage.', { tone: 'source', kind: 'status' }));
    if (session.activeGeneration) chips.appendChild(createStatusPill(getStoryOpenerGenerationLabel(session.activeGeneration), session.activeGeneration.message || 'Provider run active.', { tone: 'warning', kind: 'status' }));
    header.appendChild(chips);
    container.appendChild(header);
    container.appendChild(createStoryOpenerStageBar(session, state, options));
    const generationStatus = createStoryOpenerGenerationStatus(session);
    if (generationStatus) container.appendChild(generationStatus);
    const failureCard = createFailureCard(session, state, options);
    if (failureCard) container.appendChild(failureCard);
    container.appendChild(createStoryOpenerStageCard(visibleStage?.id || 'inputs', session, state, options));
}

export function createStoryOpenerCreatorSection(state = {}, options = {}) {
    ensureStoryOpenerStorageHydrated(options);
    const wrap = document.createElement('div');
    wrap.className = 'saga-story-opener-panel';
    mark(options, wrap, 'session.storyOpener');
    const storageStatus = getStoryOpenerStorageStatus();
    if (storageStatus.loading || openerUiState.hydrating) {
        wrap.appendChild(createEmptyMessage('Loading Story Maker sessions...'));
        return wrap;
    }
    if (storageStatus.error) {
        const error = document.createElement('div');
        error.className = 'saga-story-opener-failure';
        error.textContent = storageStatus.error;
        wrap.appendChild(error);
    }
    const index = getExternalStoryOpenerIndex();
    const activeRecord = index.activeSessionId ? index.sessions?.[index.activeSessionId] : null;
    let activeSession = activeRecord ? getCachedExternalStoryOpenerSession(activeRecord.sessionId) : null;
    if (activeRecord && !activeSession) {
        loadStoryOpenerPayloadIfNeeded(activeRecord, options);
        activeSession = normalizeStoryOpenerSession(activeRecord);
    }
    wrap.appendChild(createSessionShelf(index, state, options));
    if (activeSession) {
        renderActiveSession(wrap, activeSession, state, options);
    }
    return wrap;
}

export const __storyOpenerPanelTestHooks = Object.freeze({
    createNewStoryOpener,
    runContextPacketStage,
    runBriefStage,
    runDraftStage,
    runFullPipeline,
    createStoryOpenerGenerationStatus,
    updateStoryOpenerGenerationStatusRows,
    renderStoryOpenerMarkdownToHtml,
    createStoryOpenerOutputPreview,
    readControlsFromRefs,
});
