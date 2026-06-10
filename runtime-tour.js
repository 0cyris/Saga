import {
    getSettings,
    getState,
    saveState,
} from './state-manager.js';
import {
    createButton,
    hideFloatingTooltip,
    toast,
} from './runtime-ui-kit.js';

let runtimeTourDeps = {};
let activeSagaTour = null;

export function configureRuntimeTour(deps = {}) {
    runtimeTourDeps = { ...runtimeTourDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = runtimeTourDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga runtime tour dependency is not configured: ${name}`);
}

function normalizeExperienceMode(mode) {
    return dep('normalizeExperienceMode', value => (value === 'advanced' ? 'advanced' : 'basic'))(mode);
}

function getGuideSteps(mode) {
    return dep('getGuideSteps', () => [])(mode);
}

function setSectionCollapsed(sectionId, collapsed) {
    return dep('setSectionCollapsed', () => null)(sectionId, collapsed);
}

function normalizePanelLayoutState(state) {
    return dep('normalizePanelLayoutState', value => value?.lorePanel || null)(state);
}

function normalizeTabForExperience(tab) {
    return dep('normalizeTabForExperience', value => value || 'session')(tab);
}

function showRuntimePanel() {
    return dep('showRuntimePanel', () => null)();
}

function prepareGuideStep(step) {
    if (!getTourStepPrepareAction(step)) return null;
    return dep('prepareGuideStep', () => null)(step);
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function getPanelId() {
    return runtimeTourDeps?.panelId || 'saga-lore-panel';
}

export function markTourTarget(el, target) {
    if (el && target) el.dataset.sagaTour = String(target);
    return el;
}

function getTourStepSectionId(step) {
    return String(step?.section || step?.tab || 'session').trim() || 'session';
}

function getTourStepPrepareAction(step) {
    return String(step?.prepare || step?.prepareAction || '').trim();
}

export function startSagaTour(mode = normalizeExperienceMode(getSettings().experienceMode), options = {}) {
    const normalized = normalizeExperienceMode(mode);
    const allSteps = [...(getGuideSteps(normalized) || getGuideSteps('basic') || [])];
    const sectionId = String(options?.sectionId || '').trim();
    const steps = sectionId ? allSteps.filter(step => getTourStepSectionId(step) === sectionId) : allSteps;
    if (!steps.length) {
        toast('No walkthrough steps are available for this section.', 'info');
        return;
    }

    closeSagaTour({ preserveToast: true });
    activeSagaTour = {
        mode: normalized,
        sectionId,
        steps,
        index: 0,
        renderToken: 0,
        currentTarget: null,
    };
    document.addEventListener('keydown', onSagaTourKeydown);
    window.addEventListener('resize', repositionSagaTourPopover);
    renderActiveSagaTourStep();
}

function renderActiveSagaTourStep(skipCount = 0) {
    const tour = activeSagaTour;
    if (!tour) return;
    if (tour.index < 0) tour.index = 0;
    if (tour.index >= tour.steps.length) {
        closeSagaTour();
        return;
    }

    const step = tour.steps[tour.index];
    const hasPrepare = !!getTourStepPrepareAction(step);
    showGuideStep(step, {
        highlight: true,
        tour: true,
        onReady: (target, prepareResult) => {
            if (!activeSagaTour || activeSagaTour !== tour) return;
            if (!target && !hasPrepare && skipCount < tour.steps.length - 1) {
                tour.index += 1;
                renderActiveSagaTourStep(skipCount + 1);
                return;
            }
            renderSagaTourPopover(step, target, prepareResult);
        },
    });
}

export function showGuideStep(step, options = {}) {
    if (!step) return;

    for (const sectionId of step.expandSections || []) {
        setSectionCollapsed(sectionId, false);
    }

    const state = getState();
    if (state?.lorePanel) {
        normalizePanelLayoutState(state);
        state.lorePanel.drawerOpen = true;
        state.lorePanel.collapsed = false;
        state.lorePanel.activeTab = normalizeTabForExperience(step.tab || 'session');
        saveState(state);
    }
    showRuntimePanel();

    const tour = activeSagaTour;
    const token = tour ? ++tour.renderToken : 0;
    const runTargetLookup = (prepareResult = null) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (tour && (!activeSagaTour || activeSagaTour !== tour || token !== tour.renderToken)) return;
                const target = getTourTargetElement(step.target) || getTourTargetElement(step.fallbackTarget);
                if (options.highlight) {
                    highlightSagaTourTarget(target);
                    if (!options.tour) {
                        window.setTimeout(() => {
                            if (!activeSagaTour) clearSagaTourHighlight();
                        }, 2200);
                    }
                }
                if (!target && !options.tour) {
                    toast(prepareResult?.message || `${step.title || 'Feature'} is not visible in the current state.`, 'info');
                }
                options.onReady?.(target, prepareResult);
            });
        });
    };

    Promise.resolve()
        .then(() => prepareGuideStep(step))
        .catch(error => {
            console.warn('[Saga] Walkthrough prepare failed:', error);
            return { ok: false, error, message: `${step.title || 'Feature'} could not be prepared automatically.` };
        })
        .then(prepareResult => {
            if (tour && (!activeSagaTour || activeSagaTour !== tour || token !== tour.renderToken)) return;
            runTargetLookup(prepareResult);
        });
}

function getTourTargetElement(targetName) {
    if (!targetName) return null;
    const root = getPanelRoot() || document.getElementById(getPanelId()) || document.body;
    const candidates = [
        ...Array.from(root.querySelectorAll('[data-saga-tour]')),
        ...Array.from(document.querySelectorAll('[data-saga-tour]')),
    ];
    return candidates.find(el => el?.dataset?.sagaTour === targetName) || null;
}

function highlightSagaTourTarget(target) {
    clearSagaTourHighlight();
    if (!target) return;
    target.classList.add('saga-tour-highlight');
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
}

function clearSagaTourHighlight() {
    for (const el of document.querySelectorAll('.saga-tour-highlight')) {
        el.classList.remove('saga-tour-highlight');
    }
}

function renderSagaTourPopover(step, target, prepareResult = null) {
    const tour = activeSagaTour;
    if (!tour) return;

    let popover = document.getElementById('saga-tour-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'saga-tour-popover';
        popover.className = 'saga-tour-popover';
        document.body.appendChild(popover);
    }

    popover.innerHTML = '';
    const progress = document.createElement('div');
    progress.className = 'saga-tour-progress';
    progress.textContent = `${tour.index + 1} / ${tour.steps.length}`;
    popover.appendChild(progress);

    const title = document.createElement('div');
    title.className = 'saga-tour-title';
    title.textContent = step.title || 'Saga';
    popover.appendChild(title);

    const body = document.createElement('div');
    body.className = 'saga-tour-body';
    body.textContent = step.body || '';
    popover.appendChild(body);

    appendSagaTourDetail(popover, 'Preparation', prepareResult?.message);
    appendSagaTourDetail(popover, 'When to use', step.when);
    appendSagaTourDetail(popover, 'Expected result', step.expected);

    const actions = document.createElement('div');
    actions.className = 'saga-tour-actions';
    const back = createButton('Back', 'Return to the previous walkthrough step.', () => {
        if (!activeSagaTour) return;
        activeSagaTour.index = Math.max(0, activeSagaTour.index - 1);
        renderActiveSagaTourStep();
    }, 'saga-mini-button');
    back.disabled = tour.index <= 0;
    actions.appendChild(back);

    const close = createButton('Close', 'Close the walkthrough.', () => closeSagaTour(), 'saga-mini-button');
    actions.appendChild(close);

    const nextLabel = tour.index >= tour.steps.length - 1 ? 'Finish' : 'Next';
    const next = createButton(nextLabel, nextLabel === 'Finish' ? 'Close the walkthrough.' : 'Move to the next walkthrough step.', () => {
        if (!activeSagaTour) return;
        if (activeSagaTour.index >= activeSagaTour.steps.length - 1) {
            closeSagaTour();
            return;
        }
        activeSagaTour.index += 1;
        renderActiveSagaTourStep();
    }, 'saga-primary-button saga-mini-button');
    actions.appendChild(next);
    popover.appendChild(actions);

    activeSagaTour.currentTarget = target || null;
    requestAnimationFrame(repositionSagaTourPopover);
}

function appendSagaTourDetail(popover, labelText, value) {
    const text = String(value || '').trim();
    if (!text) return;
    const row = document.createElement('div');
    row.className = 'saga-tour-detail';
    const label = document.createElement('span');
    label.className = 'saga-tour-detail-label';
    label.textContent = `${labelText}:`;
    row.appendChild(label);
    row.appendChild(document.createTextNode(` ${text}`));
    popover.appendChild(row);
}

function repositionSagaTourPopover() {
    const popover = document.getElementById('saga-tour-popover');
    if (!popover) return;
    const target = activeSagaTour?.currentTarget;
    const margin = 12;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
    const popRect = popover.getBoundingClientRect();

    if (!target) {
        popover.style.left = `${Math.max(margin, (viewportWidth - popRect.width) / 2)}px`;
        popover.style.top = `${Math.max(margin, (viewportHeight - popRect.height) / 2)}px`;
        return;
    }

    const rect = target.getBoundingClientRect();
    let left = rect.right + margin;
    if (left + popRect.width > viewportWidth - margin) {
        left = rect.left - popRect.width - margin;
    }
    if (left < margin) {
        left = rect.left + (rect.width / 2) - (popRect.width / 2);
    }
    left = Math.max(margin, Math.min(left, viewportWidth - popRect.width - margin));

    let top = rect.top + (rect.height / 2) - (popRect.height / 2);
    if (top < margin) top = rect.bottom + margin;
    if (top + popRect.height > viewportHeight - margin) top = rect.top - popRect.height - margin;
    top = Math.max(margin, Math.min(top, viewportHeight - popRect.height - margin));

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}

export function closeSagaTour(options = {}) {
    activeSagaTour = null;
    clearSagaTourHighlight();
    document.removeEventListener('keydown', onSagaTourKeydown);
    window.removeEventListener('resize', repositionSagaTourPopover);
    const popover = document.getElementById('saga-tour-popover');
    if (popover) popover.remove();
    if (!options.preserveToast) hideFloatingTooltip();
}

function onSagaTourKeydown(event) {
    if (!activeSagaTour) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeSagaTour();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (activeSagaTour.index >= activeSagaTour.steps.length - 1) closeSagaTour();
        else {
            activeSagaTour.index += 1;
            renderActiveSagaTourStep();
        }
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        activeSagaTour.index = Math.max(0, activeSagaTour.index - 1);
        renderActiveSagaTourStep();
    }
}
