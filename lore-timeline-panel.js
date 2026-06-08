import {
    getLoreTimelineEvents,
    getLoreTimelineSummary,
} from './lore-timeline.js';
import {
    addTooltip,
    createButton,
    createStatusPill,
} from './runtime-ui-kit.js';

let loreTimelinePanelDeps = {};

export function configureLoreTimelinePanel(deps = {}) {
    loreTimelinePanelDeps = { ...loreTimelinePanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = loreTimelinePanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Lore Timeline panel dependency is not configured: ${name}`);
}

function isBasicExperience() {
    return dep('isBasicExperience', () => false)();
}

function markTourTarget(el, target) {
    return dep('markTourTarget', element => element)(el, target);
}

function createCompactPresetStat(label, value) {
    return dep('createCompactPresetStat')(label, value);
}

function openNewLoreDialog() {
    return dep('openNewLoreDialog')();
}

function openLoreTimeline() {
    return dep('openLoreTimeline')();
}

export function createLoreTimelineCard(state) {
    const basic = isBasicExperience();
    const summary = getLoreTimelineSummary(state);
    const counts = summary.counts || {};
    const latest = summary.latest;
    const card = document.createElement('div');
    card.className = 'wandlight-runtime-card wandlight-lore-timeline-card';
    markTourTarget(card, 'lore.timeline');

    const top = document.createElement('div');
    top.className = 'wandlight-lore-timeline-card-top';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = basic ? 'Lore Tools' : 'Lore Timeline';
    addTooltip(title, basic ? 'Create manual lore and review suggested/generated entries below.' : 'Story-aware audit trail for accepted lore changes and recoverable lore versions.');
    top.appendChild(title);
    if (!basic) {
        top.appendChild(createStatusPill(summary.eventCount ? `${summary.eventCount} events` : 'No events', 'Lore timeline event count for this chat.'));
    }
    card.appendChild(top);

    if (!basic) {
        const stats = document.createElement('div');
        stats.className = 'wandlight-lore-timeline-stats';
        stats.appendChild(createCompactPresetStat('Added', `+${counts.added || 0}`));
        stats.appendChild(createCompactPresetStat('Deleted', `-${counts.deleted || 0}`));
        stats.appendChild(createCompactPresetStat('Updated', String(counts.updated || 0)));
        stats.appendChild(createCompactPresetStat('Restored', String(counts.restored || 0)));
        card.appendChild(stats);

        const rail = document.createElement('div');
        rail.className = 'wandlight-lore-timeline-mini-rail';
        const events = getLoreTimelineEvents(state).slice(-18);
        if (events.length) {
            for (const event of events) {
                const tick = document.createElement('span');
                tick.className = `wandlight-lore-timeline-mini-tick ${getLoreTimelineEventClass(event)}`.trim();
                addTooltip(tick, event.summary || event.type);
                rail.appendChild(tick);
            }
        } else {
            const empty = document.createElement('span');
            empty.className = 'wandlight-lore-timeline-mini-empty';
            empty.textContent = 'No accepted-lore changes recorded yet.';
            rail.appendChild(empty);
        }
        card.appendChild(rail);
    }

    const foot = document.createElement('div');
    foot.className = 'wandlight-lore-timeline-card-foot';
    const latestText = document.createElement('div');
    latestText.className = 'wandlight-lore-timeline-latest';
    latestText.textContent = basic
        ? 'Create a manual lore draft, or use the generation tools below to add reviewable lore.'
        : (latest ? `Last: ${latest.summary || latest.type}` : 'Manual creations, accepted lore changes, and recoveries will appear here.');
    foot.appendChild(latestText);
    const actions = document.createElement('div');
    actions.className = 'wandlight-lore-timeline-actions';
    actions.appendChild(markTourTarget(createButton('New Lore', 'Create a manual lore draft in Pending Lore Review.', () => {
        openNewLoreDialog();
    }, 'wandlight-primary-button'), 'lore.new'));
    if (!basic) {
        actions.appendChild(markTourTarget(createButton('Open Timeline', 'Open the full Lore Timeline workbench.', () => {
            openLoreTimeline();
        }), 'lore.timeline.open'));
    }
    foot.appendChild(actions);
    card.appendChild(foot);
    return card;
}

export function getLoreTimelineEventClass(event = {}) {
    const counts = event.counts || {};
    if (counts.deleted > 0 || /delete|remove/i.test(event.type || '')) return 'wandlight-lore-timeline-event-delete';
    if (counts.restored > 0 || /restore|recover/i.test(event.type || '')) return 'wandlight-lore-timeline-event-restore';
    if (counts.updated > 0 || counts.pinned > 0 || counts.muted > 0 || /edit|relevance|pin|mute|metadata/i.test(event.type || '')) return 'wandlight-lore-timeline-event-update';
    if (counts.pending > 0 || /pending|generate/i.test(event.type || '')) return 'wandlight-lore-timeline-event-pending';
    return 'wandlight-lore-timeline-event-add';
}
