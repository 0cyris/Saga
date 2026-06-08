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
let activeWandlightTour = null;

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

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function getPanelId() {
    return runtimeTourDeps?.panelId || 'wandlight-lore-panel';
}

export function markTourTarget(el, target) {
    if (el && target) el.dataset.wandlightTour = String(target);
    return el;
}

export function startWandlightTour(mode = normalizeExperienceMode(getSettings().experienceMode)) {
    const normalized = normalizeExperienceMode(mode);
    const steps = [...(getGuideSteps(normalized) || getGuideSteps('basic') || [])];
    if (!steps.length) return;

    closeWandlightTour({ preserveToast: true });
    activeWandlightTour = {
        mode: normalized,
        steps,
        index: 0,
        renderToken: 0,
        currentTarget: null,
    };
    document.addEventListener('keydown', onWandlightTourKeydown);
    window.addEventListener('resize', repositionWandlightTourPopover);
    renderActiveWandlightTourStep();
}

function renderActiveWandlightTourStep(skipCount = 0) {
    const tour = activeWandlightTour;
    if (!tour) return;
    if (tour.index < 0) tour.index = 0;
    if (tour.index >= tour.steps.length) {
        closeWandlightTour();
        return;
    }

    const step = tour.steps[tour.index];
    showGuideStep(step, {
        highlight: true,
        tour: true,
        onReady: (target) => {
            if (!activeWandlightTour || activeWandlightTour !== tour) return;
            if (!target && skipCount < tour.steps.length - 1) {
                tour.index += 1;
                renderActiveWandlightTourStep(skipCount + 1);
                return;
            }
            renderWandlightTourPopover(step, target);
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

    const token = activeWandlightTour ? ++activeWandlightTour.renderToken : 0;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (activeWandlightTour && token !== activeWandlightTour.renderToken) return;
            const target = getTourTargetElement(step.target) || getTourTargetElement(step.fallbackTarget);
            if (options.highlight) {
                highlightWandlightTourTarget(target);
                if (!options.tour) {
                    window.setTimeout(() => {
                        if (!activeWandlightTour) clearWandlightTourHighlight();
                    }, 2200);
                }
            }
            if (!target && !options.tour) {
                toast(`${step.title || 'Feature'} is not visible in the current state.`, 'info');
            }
            options.onReady?.(target);
        });
    });
}

function getTourTargetElement(targetName) {
    if (!targetName) return null;
    const root = getPanelRoot() || document.getElementById(getPanelId()) || document.body;
    const candidates = [
        ...Array.from(root.querySelectorAll('[data-wandlight-tour]')),
        ...Array.from(document.querySelectorAll('[data-wandlight-tour]')),
    ];
    return candidates.find(el => el?.dataset?.wandlightTour === targetName) || null;
}

function highlightWandlightTourTarget(target) {
    clearWandlightTourHighlight();
    if (!target) return;
    target.classList.add('wandlight-tour-highlight');
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
}

function clearWandlightTourHighlight() {
    for (const el of document.querySelectorAll('.wandlight-tour-highlight')) {
        el.classList.remove('wandlight-tour-highlight');
    }
}

function renderWandlightTourPopover(step, target) {
    const tour = activeWandlightTour;
    if (!tour) return;

    let popover = document.getElementById('wandlight-tour-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'wandlight-tour-popover';
        popover.className = 'wandlight-tour-popover';
        document.body.appendChild(popover);
    }

    popover.innerHTML = '';
    const progress = document.createElement('div');
    progress.className = 'wandlight-tour-progress';
    progress.textContent = `${tour.index + 1} / ${tour.steps.length}`;
    popover.appendChild(progress);

    const title = document.createElement('div');
    title.className = 'wandlight-tour-title';
    title.textContent = step.title || 'Saga';
    popover.appendChild(title);

    const body = document.createElement('div');
    body.className = 'wandlight-tour-body';
    body.textContent = step.body || '';
    popover.appendChild(body);

    appendWandlightTourDetail(popover, 'When to use', step.when);
    appendWandlightTourDetail(popover, 'Expected result', step.expected);

    const actions = document.createElement('div');
    actions.className = 'wandlight-tour-actions';
    const back = createButton('Back', 'Return to the previous walkthrough step.', () => {
        if (!activeWandlightTour) return;
        activeWandlightTour.index = Math.max(0, activeWandlightTour.index - 1);
        renderActiveWandlightTourStep();
    }, 'wandlight-mini-button');
    back.disabled = tour.index <= 0;
    actions.appendChild(back);

    const close = createButton('Close', 'Close the walkthrough.', () => closeWandlightTour(), 'wandlight-mini-button');
    actions.appendChild(close);

    const nextLabel = tour.index >= tour.steps.length - 1 ? 'Finish' : 'Next';
    const next = createButton(nextLabel, nextLabel === 'Finish' ? 'Close the walkthrough.' : 'Move to the next walkthrough step.', () => {
        if (!activeWandlightTour) return;
        if (activeWandlightTour.index >= activeWandlightTour.steps.length - 1) {
            closeWandlightTour();
            return;
        }
        activeWandlightTour.index += 1;
        renderActiveWandlightTourStep();
    }, 'wandlight-primary-button wandlight-mini-button');
    actions.appendChild(next);
    popover.appendChild(actions);

    activeWandlightTour.currentTarget = target || null;
    requestAnimationFrame(repositionWandlightTourPopover);
}

function appendWandlightTourDetail(popover, labelText, value) {
    const text = String(value || '').trim();
    if (!text) return;
    const row = document.createElement('div');
    row.className = 'wandlight-tour-detail';
    const label = document.createElement('span');
    label.className = 'wandlight-tour-detail-label';
    label.textContent = `${labelText}:`;
    row.appendChild(label);
    row.appendChild(document.createTextNode(` ${text}`));
    popover.appendChild(row);
}

function repositionWandlightTourPopover() {
    const popover = document.getElementById('wandlight-tour-popover');
    if (!popover) return;
    const target = activeWandlightTour?.currentTarget;
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

export function closeWandlightTour(options = {}) {
    activeWandlightTour = null;
    clearWandlightTourHighlight();
    document.removeEventListener('keydown', onWandlightTourKeydown);
    window.removeEventListener('resize', repositionWandlightTourPopover);
    const popover = document.getElementById('wandlight-tour-popover');
    if (popover) popover.remove();
    if (!options.preserveToast) hideFloatingTooltip();
}

function onWandlightTourKeydown(event) {
    if (!activeWandlightTour) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeWandlightTour();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (activeWandlightTour.index >= activeWandlightTour.steps.length - 1) closeWandlightTour();
        else {
            activeWandlightTour.index += 1;
            renderActiveWandlightTourStep();
        }
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        activeWandlightTour.index = Math.max(0, activeWandlightTour.index - 1);
        renderActiveWandlightTourStep();
    }
}
