// Commit receipts live in the same payload write as generated content. Keeping
// them independent of completion checkpoints makes reload reconciliation safe.
import { fingerprintGenerationInput } from '../generation/generation-input-identity.js';
export async function fingerprintLoredeckCreatorGenerationInput(value = {}) {
    return fingerprintGenerationInput(value);
}

export function findLoredeckCreatorPendingGenerationCommit(job = {}, unitId = '', inputHash = '', pack = {}) {
    const unit = job.generationUnits?.[unitId];
    const candidates = [
        ...(unit?.meta?.checkpointPending ? [unit.meta.generationCommit] : []),
        ...(unit?.status !== 'complete' ? [...(pack.pendingChanges || []), ...(job.draftChanges || [])].map(change => change.preview?.generationCommit) : []),
    ];
    return candidates.find(receipt => {
        if (!receipt?.idempotencyKey) return false;
        try {
            const [receiptJob, , receiptUnit, receiptInput] = JSON.parse(receipt.idempotencyKey);
            return receiptJob === job.jobId && receiptUnit === unitId && receiptInput === inputHash;
        } catch (_) { return false; }
    }) || null;
}

export function buildLoredeckCreatorGenerationCommitPatch(job = {}, context = {}, resultRef = {}) {
    if (!context?.idempotencyKey) return {};
    const [jobId, runId, unitId, inputHash] = JSON.parse(context.idempotencyKey);
    const previous = job.generationUnits?.[unitId] || {};
    const receipt = {
        idempotencyKey: context.idempotencyKey,
        committedAt: Date.now(),
        resultRef,
    };
    return {
        generationUnits: {
            ...(job.generationUnits || {}),
            [unitId]: {
                ...previous, jobId, runId, unitId, inputHash,
                stage: context.stage || previous.stage || '', status: 'running', resultRef,
                meta: { ...(previous.meta || {}), idempotencyKey: context.idempotencyKey, checkpointPending: true, generationCommit: receipt },
            },
        },
    };
}

export function attachLoredeckCreatorGenerationCommitToChanges(changes = [], context = {}, parsedResult = {}) {
    if (!context?.idempotencyKey || !changes.length) return changes;
    const snapshot = {
        summary: String(parsedResult.summary || '').slice(0, 1000),
        clarifyingQuestions: (parsedResult.clarifyingQuestions || []).slice(0, 5).map(value => String(value).slice(0, 300)),
        warnings: (parsedResult.warnings || []).slice(0, 5).map(value => String(value).slice(0, 300)),
    };
    return changes.map((change, index) => ({
        ...change,
        preview: {
            ...(change.preview || {}),
            generationCommitIdentity: context.idempotencyKey,
            ...(index === 0 ? { generationCommit: { idempotencyKey: context.idempotencyKey, committedAt: Date.now(), stage: context.stage, parsedResult: snapshot } } : {}),
        },
    }));
}

export function reconcileLoredeckCreatorGenerationCommit(job = {}, context = {}, pack = {}) {
    const unit = job.generationUnits?.[context.unit?.unitId];
    const receipt = unit?.meta?.generationCommit;
    let committed = receipt?.idempotencyKey === context.idempotencyKey ? receipt : null;
    const changes = [...(pack.pendingChanges || []), ...(job.draftChanges || [])];
    const storedChange = changes.find(change => change.preview?.generationCommit?.idempotencyKey === context.idempotencyKey);
    const changeReceipt = storedChange?.preview?.generationCommit;
    if (!committed && !changeReceipt) return null;
    const stage = context.run?.stage || unit?.stage || changeReceipt?.stage;
    const resultRef = committed?.resultRef || { batchId: storedChange?.preview?.creatorPlanningBatch?.id || storedChange?.preview?.creatorEntryBatch?.batchId || '' };
    const matchingChanges = changes.filter(change => change.preview?.generationCommitIdentity === context.idempotencyKey
        || change.preview?.generationCommit?.idempotencyKey === context.idempotencyKey
        || (resultRef.pendingChangeIds || resultRef.draftChangeIds || []).includes(change.changeId));
    let parsedResult = changeReceipt?.parsedResult;
    if (parsedResult && !Array.isArray(parsedResult.proposals)) {
        parsedResult = { ...parsedResult, proposals: matchingChanges.map(change => ({ action: change.action, ...(change.payload || {}) })) };
    }
    if (!parsedResult && stage === 'scope_brief') {
        parsedResult = { summary: job.summary || '', clarifyingQuestions: job.questions || [], brief: job.brief || null };
    } else if (!parsedResult && stage === 'story_outline') {
        parsedResult = { summary: job.outlineSummary || '', clarifyingQuestions: job.outlineQuestions || [], outline: job.outline || null };
    } else if (!parsedResult && /title/.test(stage || '')) {
        const ids = new Set(resultRef.titleIds || []);
        parsedResult = { summary: job.titlePassSummary || '', clarifyingQuestions: job.titlePassQuestions || [], titleDrafts: (job.titleDrafts || []).filter(draft => ids.has(draft.titleId || draft.id)), batch: job.titleBatch || null };
    }
    const commitResult = {
        resultRef,
        ...(stage === 'context_tag_planning' ? { planningCommit: { queued: true, changeCount: matchingChanges.length || parsedResult?.proposals?.length || 0, pendingChangeIds: matchingChanges.map(change => change.changeId), batchId: resultRef.batchId } } : {}),
        ...(stage === 'entry_micro_batch' ? { entryCommit: { queued: true, changeCount: matchingChanges.length || parsedResult?.proposals?.length || 0, draftChangeIds: matchingChanges.map(change => change.changeId), batchId: resultRef.batchId } } : {}),
        ...(/title/.test(stage || '') ? { titleCommit: { draftCount: parsedResult?.titleDrafts?.length || 0, titleIds: resultRef.titleIds || [], batchId: resultRef.batchId } } : {}),
    };
    return { ...(committed || changeReceipt), committed: true, idempotencyKey: context.idempotencyKey, parsedResult, rawResult: parsedResult ? JSON.stringify(parsedResult) : undefined, resultRef, commitResult };
}

export function getLoredeckCreatorCommittedGenerationResult(job = {}, context = {}, pack = {}) {
    if (!context?.idempotencyKey) return null;
    const [jobId, runId, unitId, inputHash] = JSON.parse(context.idempotencyKey);
    return reconcileLoredeckCreatorGenerationCommit(job, {
        idempotencyKey: context.idempotencyKey,
        run: { jobId, runId, stage: context.stage }, unit: { unitId, inputHash },
    }, pack);
}
