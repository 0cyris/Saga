import {
    buildLoredeckCreatorResetWarning,
    getLoredeckCreatorResetStepLabel,
    hasLoredeckCreatorResetForwardData,
    resetGeneratedLoredeckPackAfterStep,
    resetLoredeckCreatorJobAfterStep,
    shouldRemoveGeneratedPackForCreatorReset,
} from './loredeck-creator-reset.js';

const LOREDECK_CREATOR_RESET_ANCHORS = Object.freeze({
    scope: 'scope-brief',
    outline: 'story-outline',
    titles: 'title-sets',
    context: 'context-plan',
    lorecards: 'lorecards',
    review: 'review-queue',
    health: 'deck-health',
});

function callOrFallback(fn, fallback, ...args) {
    return typeof fn === 'function' ? fn(...args) : fallback;
}

function isMissingExternalLoredeckPayloadError(error = null) {
    return error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error || ''));
}

export function getLoredeckCreatorResetAnchor(stepId = '', cached = {}) {
    const id = String(stepId || '').trim();
    if (id === 'scope') return cached?.brief ? 'scope-brief' : 'intake';
    return LOREDECK_CREATOR_RESET_ANCHORS[id] || 'current-task';
}

export function createLoredeckCreatorResetController(deps = {}) {
    const getCurrentJob = () => callOrFallback(deps.getCurrentJob, {}, {}) || {};
    const getActiveGeneration = job => callOrFallback(deps.getActiveGeneration, job?.activeGeneration || null, job);
    const getLoredeckDefinition = packId => callOrFallback(deps.getLoredeckDefinition, null, packId);
    const getFreshPack = (packId, fallback) => callOrFallback(deps.getFreshPack, fallback || null, packId, fallback);
    const isGeneratedPack = pack => callOrFallback(deps.isGeneratedPack, false, pack) === true;
    const isVirtualPack = pack => callOrFallback(deps.isVirtualPack, false, pack) === true;
    const removeGeneratedPackFromStack = packId => callOrFallback(deps.removeGeneratedPackFromStack, false, packId);
    const removeLibraryPack = (packId, options = {}) => callOrFallback(deps.removeLibraryPack, { ok: false }, packId, options) || { ok: false };
    const clearPackCaches = (packId, options = {}) => callOrFallback(deps.clearPackCaches, null, packId, options);
    const clearSelectedPackIfMatches = packId => callOrFallback(deps.clearSelectedPackIfMatches, null, packId);
    const hydratePayload = pack => callOrFallback(deps.hydratePayload, pack, pack);
    const buildEmbeddedManifest = (manifest, pack) => callOrFallback(deps.buildEmbeddedManifest, manifest, manifest, pack);
    const upsertLibraryPack = pack => callOrFallback(deps.upsertLibraryPack, { ok: false }, pack) || { ok: false };
    const setCurrentJob = (job, options = {}) => callOrFallback(deps.setCurrentJob, job, job, options);
    const clearCanonCache = () => callOrFallback(deps.clearCanonCache, null);
    const clearContextCache = () => callOrFallback(deps.clearContextCache, null);
    const refreshLoredeckSurfaces = options => callOrFallback(deps.refreshLoredeckSurfaces, null, options);
    const refreshPanelBody = options => callOrFallback(deps.refreshPanelBody, null, options);
    const refreshWorkbenchBody = options => callOrFallback(deps.refreshWorkbenchBody, null, options);
    const scrollWorkbenchToAnchor = anchor => callOrFallback(deps.scrollWorkbenchToAnchor, null, anchor);
    const confirmAction = (title, message, options) => callOrFallback(deps.confirmAction, Promise.resolve(false), title, message, options);
    const toast = (message, tone) => callOrFallback(deps.toast, null, message, tone);
    const warn = (message, error) => {
        if (typeof deps.warn === 'function') deps.warn(message, error);
        else console.warn(message, error);
    };
    const scheduleFrame = callback => {
        const frame = typeof deps.requestAnimationFrame === 'function'
            ? deps.requestAnimationFrame
            : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
        if (frame) frame(callback);
    };

    async function handleResetToStep(targetStepId = '') {
        const stepId = String(targetStepId || '').trim();
        const cached = getCurrentJob();
        const activeGeneration = getActiveGeneration(cached);
        if (activeGeneration) {
            toast('Cancel or finish the current Deck Maker generation before resetting.', 'warning');
            return false;
        }
        const label = getLoredeckCreatorResetStepLabel(stepId);
        const packId = String(cached.generatedPackId || '').trim();
        let generatedPack = packId ? getFreshPack(packId, getLoredeckDefinition(packId)) : null;
        let creatorPack = generatedPack && isGeneratedPack(generatedPack) ? generatedPack : null;
        if (!hasLoredeckCreatorResetForwardData(cached, creatorPack || null, stepId)) {
            toast(`No later Deck Maker data exists after ${label}.`, 'info');
            return false;
        }
        const proceed = await confirmAction(
            `Reset to ${label}?`,
            buildLoredeckCreatorResetWarning(stepId),
            {
                confirmLabel: `Reset to ${label}`,
                confirmTooltip: `Permanently erase later Deck Maker data and return to ${label}.`,
            }
        );
        if (!proceed) return false;

        const removeGeneratedPack = shouldRemoveGeneratedPackForCreatorReset(stepId);
        let packMutationOk = true;
        let resetStepId = stepId;
        let resetLabel = label;
        if (creatorPack?.packId && removeGeneratedPack) {
            removeGeneratedPackFromStack(creatorPack.packId);
            const result = removeLibraryPack(creatorPack.packId, { clearCreatorProjects: false });
            if (!result.ok) {
                toast(result.error || 'Generated Loredeck shell could not be reset.', 'warning');
                packMutationOk = false;
            } else {
                clearPackCaches(creatorPack.packId, { clearDraftCache: true });
                clearSelectedPackIfMatches(creatorPack.packId);
            }
        } else if (creatorPack?.packId) {
            let payloadMissingFallback = false;
            try {
                creatorPack = await hydratePayload(creatorPack);
            } catch (error) {
                warn('[Saga] Generated Loredeck payload hydration failed before Deck Maker reset:', error);
                if (!isMissingExternalLoredeckPayloadError(error)) {
                    toast(error?.message || 'Generated Loredeck payload could not be loaded before reset.', 'warning');
                    return false;
                }
                const fallbackStepId = 'titles';
                const fallbackLabel = getLoredeckCreatorResetStepLabel(fallbackStepId);
                const fallback = await confirmAction(
                    'Generated Loredeck Payload Missing',
                    `Saga cannot preserve ${label} because the Generated Loredeck payload file is missing. Reset to ${fallbackLabel} instead and remove the broken Generated Loredeck shell?`,
                    {
                        confirmLabel: `Reset to ${fallbackLabel}`,
                        confirmTooltip: 'Remove the broken Generated Loredeck shell and return to the last step that does not need it.',
                    }
                );
                if (!fallback) return false;
                resetStepId = fallbackStepId;
                resetLabel = fallbackLabel;
                payloadMissingFallback = true;
                removeGeneratedPackFromStack(creatorPack.packId);
                const result = removeLibraryPack(creatorPack.packId, { clearCreatorProjects: false });
                if (!result.ok && result.notFound !== true) {
                    toast(result.error || 'Generated Loredeck shell could not be reset.', 'warning');
                    packMutationOk = false;
                } else {
                    clearPackCaches(creatorPack.packId, { clearDraftCache: true });
                    clearSelectedPackIfMatches(creatorPack.packId);
                }
            }
            if (!packMutationOk) return false;
            if (payloadMissingFallback) {
                creatorPack = null;
            } else if (!creatorPack || !isGeneratedPack(creatorPack)) {
                toast('Generated Loredeck payload could not be loaded before reset.', 'warning');
                return false;
            }
            if (!payloadMissingFallback) {
                const resetPack = resetGeneratedLoredeckPackAfterStep(creatorPack, stepId);
                if (resetPack) {
                    if (isVirtualPack(resetPack)) {
                        resetPack.manifestData = buildEmbeddedManifest(resetPack.manifestData || {}, resetPack);
                    }
                    const result = upsertLibraryPack(resetPack);
                    if (!result.ok) {
                        toast(result.error || 'Generated Loredeck state could not be reset.', 'warning');
                        packMutationOk = false;
                    } else {
                        clearPackCaches(creatorPack.packId, {
                            clearDraftCache: stepId === 'scope' || stepId === 'outline' || stepId === 'titles' || stepId === 'context',
                        });
                    }
                }
            }
        } else if (packId) {
            if (removeGeneratedPack) {
                removeGeneratedPackFromStack(packId);
                clearSelectedPackIfMatches(packId);
            }
            clearPackCaches(packId, {
                clearDraftCache: removeGeneratedPack || stepId === 'context',
            });
        }
        if (!packMutationOk) return false;

        const resetJob = resetLoredeckCreatorJobAfterStep(cached, resetStepId);
        const nextJob = setCurrentJob(resetJob, { refreshWorkbench: true });
        clearCanonCache();
        clearContextCache();
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshWorkbenchBody({ preserveScroll: false });
        const anchor = getLoredeckCreatorResetAnchor(resetStepId, nextJob || resetJob);
        const scroll = () => scrollWorkbenchToAnchor(anchor);
        scroll();
        scheduleFrame(scroll);
        toast(`Reset to ${resetLabel}.`, 'success');
        return true;
    }

    return {
        handleResetToStep,
    };
}
