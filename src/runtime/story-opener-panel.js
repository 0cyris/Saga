/**
 * Session-tab Story Opener Creator panel.
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
    recordStoryOpenerRun,
    resetStoryOpenerToStage,
    STORY_OPENER_OPENING_SHAPES,
    STORY_OPENER_TARGET_LENGTHS,
} from '../story-openers/story-opener-state.js';

const openerUiState = {
    hydrating: false,
    loadingSessionIds: new Set(),
    activeRunIds: new Set(),
    revisionPrompt: '',
};

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

function refresh(options = {}) {
    if (typeof options.refreshPanelBody === 'function') {
        options.refreshPanelBody({ preserveScroll: options.preserveScroll !== false });
    }
}

function mark(options = {}, element, target) {
    if (typeof options.markTourTarget === 'function') return options.markTourTarget(element, target);
    return element;
}

function ensureStoryOpenerStorageHydrated(options = {}) {
    const status = getStoryOpenerStorageStatus();
    if (status.loaded || status.loading || openerUiState.hydrating) return;
    openerUiState.hydrating = true;
    hydrateSagaStoryOpenerStorage()
        .catch(error => {
            console.warn('[Saga] Story Opener storage hydration failed:', error);
            toast(error?.message || 'Story Opener storage failed to load.', 'error');
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
            console.warn('[Saga] Story Opener session payload failed to load:', error);
            toast(error?.message || 'Story Opener session payload failed to load.', 'error');
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
        toast(result.error || 'Story Opener session could not be saved.', 'error');
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

function createTextArea(value = '', placeholder = '', rows = 3, maxLength = 5000) {
    const input = document.createElement('textarea');
    input.value = value || '';
    input.placeholder = placeholder;
    input.rows = rows;
    input.maxLength = maxLength;
    return input;
}

function readControlsFromRefs(refs = {}, base = {}) {
    return normalizeStoryOpenerControls({
        ...base,
        userPrompt: refs.userPrompt?.value || '',
        context: refs.context?.value || '',
        proseStyle: refs.proseStyle?.value || '',
        openingShape: refs.openingShape?.value || '',
        characterFocus: refs.characterFocus?.value || '',
        pov: refs.pov?.value || '',
        tense: refs.tense?.value || '',
        targetLength: refs.targetLength || base.targetLength || 'scene',
        variantsEnabled: refs.variantsEnabled?.checked === true,
    });
}

function makeRun(session = {}, stage = '', label = '') {
    return recordStoryOpenerRun(session, createStoryOpenerRun(stage, {
        label,
        message: label,
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
        message: failure.message || 'Story Opener generation failed.',
        updatedAt: Date.now(),
        completedAt: Date.now(),
    });
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
    let working = makeRun(session, 'context_packet', 'Building Context Packet');
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
    working = makeRun(working, 'opener_brief', 'Building Opener Brief');
    saveStoryOpenerSession(working);
    refresh(options);
    const run = working.activeGeneration;
    const result = await buildStoryOpenerBrief(working, packet, {
        onProgress: event => {
            if (event?.message) {
                const current = getCachedExternalStoryOpenerSession(working.sessionId) || working;
                saveStoryOpenerSession(recordStoryOpenerRun(current, { ...run, status: 'running', message: event.message, updatedAt: Date.now() }), { activate: true });
                refresh(options);
            }
        },
    });
    if (!result.ok) {
        working = failRun(working, run, result.failure);
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
    working = makeRun(working, 'draft_variants', options.revisionPrompt ? 'Revising opener' : 'Drafting opener variants');
    saveStoryOpenerSession(working);
    refresh(options);
    const run = working.activeGeneration;
    const previous = getStoryOpenerSelectedVariant(working);
    const result = await writeStoryOpenerVariants(working, packet, brief, {
        revisionPrompt: options.revisionPrompt || '',
        onProgress: event => {
            if (event?.message) {
                const current = getCachedExternalStoryOpenerSession(working.sessionId) || working;
                saveStoryOpenerSession(recordStoryOpenerRun(current, { ...run, status: 'running', message: event.message, updatedAt: Date.now() }), { activate: true });
                refresh(options);
            }
        },
    });
    if (!result.ok) {
        working = failRun(working, run, result.failure);
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
    const variants = result.variants.map((variant, index) => ({
        ...variant,
        sourceRunId: run?.id || '',
        status: index === 0 ? 'selected' : 'draft',
    }));
    working = normalizeStoryOpenerSession({
        ...working,
        variants,
        selectedVariantId: variants[0]?.id || '',
        revisionHistory: history,
        currentStage: 'review_copy',
        status: 'complete',
    });
    const message = result.failures?.length
        ? `Created ${formatCount(variants.length, 'variant')} with ${formatCount(result.failures.length, 'provider failure')}.`
        : `Created ${formatCount(variants.length, 'variant')}.`;
    working = finishRun(working, run, {
        message,
        ...(result.failures?.length ? { failure: result.failures[0] } : {}),
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
        title: context || 'Story opener',
        controls: {
            context,
            proseStyle: fandomText ? `${fandomText} prose style for the selected story position` : '',
            pov: '3rd person limited',
            tense: 'past tense',
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

function createStoryOpenerStageBar(session = {}, state = {}, options = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-stage-guide saga-story-opener-stage-guide';
    const list = document.createElement('div');
    list.className = 'saga-loredeck-creator-stage-list saga-story-opener-stage-list';
    const stages = getStoryOpenerStageDescriptors(session);
    for (const stage of stages) {
        const item = document.createElement('div');
        item.className = `saga-loredeck-creator-stage-item saga-loredeck-creator-stage-${stage.status}`;
        if (stage.isActive) item.classList.add('saga-loredeck-creator-stage-active');
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'saga-loredeck-creator-stage-main';
        addTooltip(main, stage.status === 'locked' ? stage.dependency : `${stage.label}: ${stage.detail}`);
        main.addEventListener('click', () => {
            if (stage.status === 'locked') {
                if (stage.dependency) toast(stage.dependency, 'info');
                return;
            }
            document.querySelector(`[data-story-opener-anchor="${stage.anchor}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
    refs.openingShape = createTextInput(controls.openingShape, 'Scene-setting, Dialogue first...', 180);
    grid.appendChild(createField('Opening Shape', 'Editable shape instruction. Quick buttons can populate it.', refs.openingShape));
    refs.pov = createTextInput(controls.pov, '3rd person limited', 160);
    grid.appendChild(createField('PoV', 'Point of view, such as 3rd person limited.', refs.pov));
    refs.tense = createTextInput(controls.tense, 'past tense', 120);
    grid.appendChild(createField('Tense', 'Narrative tense.', refs.tense));
    card.appendChild(grid);

    const quick = document.createElement('div');
    quick.className = 'saga-story-opener-quick-row';
    for (const shape of STORY_OPENER_OPENING_SHAPES) {
        quick.appendChild(createButton(shape, `Use ${shape} as the opening shape.`, () => {
            refs.openingShape.value = shape;
        }));
    }
    card.appendChild(quick);

    refs.targetLength = controls.targetLength;
    const lengthRow = document.createElement('div');
    lengthRow.className = 'saga-story-opener-length-row';
    for (const target of STORY_OPENER_TARGET_LENGTHS) {
        const btn = createButton(target.label, target.description, button => {
            refs.targetLength = target.id;
            for (const sibling of lengthRow.querySelectorAll('.saga-mode-button')) sibling.classList.remove('saga-mode-button-active');
            button.classList.add('saga-mode-button-active');
        }, 'saga-mode-button');
        if (target.id === controls.targetLength) btn.classList.add('saga-mode-button-active');
        lengthRow.appendChild(btn);
    }
    card.appendChild(lengthRow);

    const toggle = document.createElement('label');
    toggle.className = 'saga-story-opener-checkbox';
    refs.variantsEnabled = document.createElement('input');
    refs.variantsEnabled.type = 'checkbox';
    refs.variantsEnabled.checked = controls.variantsEnabled;
    toggle.appendChild(refs.variantsEnabled);
    const toggleText = document.createElement('span');
    toggleText.textContent = 'Variants';
    toggle.appendChild(toggleText);
    addTooltip(toggle, 'When enabled, Saga makes three simultaneous opener-writing calls after the brief.');
    card.appendChild(toggle);

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
        toast('Story Opener inputs saved.', 'success');
        refresh(options);
        return next;
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Build Context Packet', 'Resolve latest lore and build the opener Context Packet.', async btn => {
        btn.disabled = true;
        const nextControls = readControlsFromRefs(refs, controls);
        const next = updateSessionStage(session, {
            controls: nextControls,
            title: nextControls.context || nextControls.userPrompt || session.title,
            currentStage: 'context_packet',
            status: 'draft',
        });
        await runContextPacketStage(next, state, options);
    }));
    actions.appendChild(createButton('Generate Full Pipeline', 'Build packet, brief, and opener variants in sequence.', async btn => {
        btn.disabled = true;
        const nextControls = readControlsFromRefs(refs, controls);
        const next = updateSessionStage(session, {
            controls: nextControls,
            title: nextControls.context || nextControls.userPrompt || session.title,
            currentStage: 'context_packet',
            status: 'draft',
        });
        await runFullPipeline(next, state, options);
    }, 'saga-primary-button'));
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
        const output = document.createElement('div');
        output.className = 'saga-story-opener-output';
        output.textContent = selected?.text || '';
        card.appendChild(output);
    } else {
        card.appendChild(createEmptyMessage('Draft one opener, or enable Variants to generate three.'));
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
    card.appendChild(createField('Revision Prompt', 'Optional instruction for revising the selected opener.', revise));
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const copy = createButton('Copy Opener', 'Copy the selected opener text to clipboard.', async () => {
        if (!selected?.text) {
            toast('No opener text to copy.', 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(selected.text);
            toast('Story opener copied.', 'success');
        } catch (_error) {
            const input = document.createElement('textarea');
            input.value = selected.text;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
            toast('Story opener copied.', 'success');
        }
    }, 'saga-primary-button');
    copy.disabled = !selected?.text;
    actions.appendChild(copy);
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

function createFailureCard(session = {}) {
    const failure = session.lastGenerationResult?.failure || null;
    if (!failure) return null;
    const card = document.createElement('div');
    card.className = 'saga-story-opener-failure';
    const title = document.createElement('strong');
    title.textContent = failure.code || 'generation_failed';
    card.appendChild(title);
    const message = document.createElement('span');
    message.textContent = failure.message || 'Story Opener generation failed.';
    card.appendChild(message);
    if (failure.recovery) {
        const recovery = document.createElement('span');
        recovery.textContent = failure.recovery;
        card.appendChild(recovery);
    }
    return card;
}

function createSessionShelf(index = {}, state = {}, options = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-story-opener-shelf';
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('New Opener', 'Create a new global Story Opener session.', () => createNewStoryOpener(state, options), 'saga-primary-button'));
    wrap.appendChild(actions);
    const sessions = Object.values(index.sessions || {})
        .sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0));
    if (!sessions.length) {
        wrap.appendChild(createEmptyMessage('No Story Opener sessions yet.'));
        return wrap;
    }
    const list = document.createElement('div');
    list.className = 'saga-story-opener-session-list';
    for (const record of sessions.slice(0, 8)) {
        const row = document.createElement('div');
        row.className = 'saga-story-opener-session-row';
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'saga-story-opener-session-main';
        const title = document.createElement('strong');
        title.textContent = record.title || 'Story opener';
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
        const del = createButton('Delete', 'Delete this Story Opener session and its payload file.', () => {
            const result = removeExternalStoryOpenerSessionSync(record.sessionId, { sessionFile: record.sessionFile || record.payloadFile });
            if (!result.ok) toast(result.error || 'Story Opener session could not be deleted.', 'error');
            else toast('Story Opener session deleted.', 'success');
            refresh(options);
        });
        row.appendChild(del);
        list.appendChild(row);
    }
    wrap.appendChild(list);
    return wrap;
}

function renderActiveSession(container, session = {}, state = {}, options = {}) {
    const readiness = getStoryOpenerReadiness(session);
    const header = document.createElement('div');
    header.className = 'saga-story-opener-active-header';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = session.title || 'Story opener';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-runtime-help';
    subtitle.textContent = readiness.ready ? 'Ready to build or revise.' : readiness.missingText;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(session.status || 'draft', 'Story Opener session status.', { tone: session.status === 'complete' ? 'success' : session.status === 'blocked' ? 'warning' : 'info', kind: 'status' }));
    chips.appendChild(createStatusPill(session.currentStage || 'inputs', 'Current Story Opener stage.', { tone: 'source', kind: 'status' }));
    if (session.activeGeneration) chips.appendChild(createStatusPill('Running', session.activeGeneration.message || 'Provider run active.', { tone: 'warning', kind: 'status' }));
    header.appendChild(chips);
    container.appendChild(header);
    container.appendChild(createStoryOpenerStageBar(session, state, options));
    const failureCard = createFailureCard(session);
    if (failureCard) container.appendChild(failureCard);
    container.appendChild(createInputsCard(session, state, options));
    container.appendChild(createPacketCard(session, state, options));
    container.appendChild(createBriefCard(session, state, options));
    container.appendChild(createVariantsCard(session, state, options));
    container.appendChild(createReviewCard(session, state, options));
}

export function createStoryOpenerCreatorSection(state = {}, options = {}) {
    ensureStoryOpenerStorageHydrated(options);
    const wrap = document.createElement('div');
    wrap.className = 'saga-story-opener-panel';
    mark(options, wrap, 'session.storyOpener');
    const storageStatus = getStoryOpenerStorageStatus();
    if (storageStatus.loading || openerUiState.hydrating) {
        wrap.appendChild(createEmptyMessage('Loading Story Opener sessions...'));
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
    readControlsFromRefs,
});
