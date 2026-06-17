const loredeckCreatorGenerationControllers = new Map();
const loredeckCreatorLiveGenerationsByJobId = new Map();
const loredeckCreatorLiveGenerationJobs = new Map();

function getLoredeckCreatorGenerationId(generationOrId = '') {
    return typeof generationOrId === 'string'
        ? String(generationOrId || '').trim()
        : String(generationOrId?.id || '').trim();
}

export function getLoredeckCreatorJobId(job = {}) {
    return String(job?.jobId || job?.id || '').trim();
}

export function setLoredeckCreatorGenerationController(generationOrId = '', controller = null) {
    const id = getLoredeckCreatorGenerationId(generationOrId);
    if (!id || !controller) return null;
    loredeckCreatorGenerationControllers.set(id, controller);
    return controller;
}

export function getLoredeckCreatorGenerationController(generationOrId = '') {
    const id = getLoredeckCreatorGenerationId(generationOrId);
    return id ? loredeckCreatorGenerationControllers.get(id) || null : null;
}

export function hasLoredeckCreatorGenerationController(generationOrId = '') {
    const id = getLoredeckCreatorGenerationId(generationOrId);
    return !!id && loredeckCreatorGenerationControllers.has(id);
}

export function deleteLoredeckCreatorGenerationController(generationOrId = '') {
    const id = getLoredeckCreatorGenerationId(generationOrId);
    return !!id && loredeckCreatorGenerationControllers.delete(id);
}

export function getLoredeckCreatorGenerationJobId(generation = null) {
    if (!generation?.id) return '';
    return String(generation.jobId || loredeckCreatorLiveGenerationJobs.get(generation.id) || '').trim();
}

export function rememberLoredeckCreatorLiveGeneration(jobId = '', generation = null) {
    const id = String(jobId || '').trim();
    if (!id || !generation?.id || generation.status !== 'running') return generation;
    const live = {
        ...generation,
        jobId: id,
    };
    loredeckCreatorLiveGenerationsByJobId.set(id, live);
    loredeckCreatorLiveGenerationJobs.set(live.id, id);
    return live;
}

export function forgetLoredeckCreatorLiveGeneration(generationOrId = '') {
    const generationId = getLoredeckCreatorGenerationId(generationOrId);
    const jobId = String(
        (typeof generationOrId === 'object' && generationOrId ? generationOrId.jobId : '')
        || loredeckCreatorLiveGenerationJobs.get(generationId)
        || ''
    ).trim();
    if (jobId) {
        const live = loredeckCreatorLiveGenerationsByJobId.get(jobId);
        if (!generationId || live?.id === generationId) loredeckCreatorLiveGenerationsByJobId.delete(jobId);
    }
    if (generationId) loredeckCreatorLiveGenerationJobs.delete(generationId);
}

export function getLoredeckCreatorLiveGenerationForJob(jobOrId = '') {
    const jobId = typeof jobOrId === 'string' ? String(jobOrId || '').trim() : getLoredeckCreatorJobId(jobOrId);
    if (!jobId) return null;
    const live = loredeckCreatorLiveGenerationsByJobId.get(jobId);
    if (!live || live.status !== 'running') return null;
    return live;
}

export function getLoredeckCreatorActiveGenerationByJobIdMap() {
    const active = new Map();
    for (const [jobId, generation] of loredeckCreatorLiveGenerationsByJobId.entries()) {
        if (generation?.status === 'running') active.set(jobId, generation);
    }
    return active;
}

export function isLoredeckCreatorActiveGenerationStillLive(job = {}) {
    const active = job?.activeGeneration;
    if (!active?.id) return false;
    const live = getLoredeckCreatorLiveGenerationForJob(job);
    if (!live || live.id !== active.id) return false;
    return hasLoredeckCreatorGenerationController(active.id) || live.abortable === false;
}

export function getAnyActiveLoredeckCreatorLiveGeneration() {
    for (const generation of getLoredeckCreatorActiveGenerationByJobIdMap().values()) {
        if (generation?.status === 'running') return generation;
    }
    return null;
}

export function attachLoredeckCreatorLiveGeneration(job = {}) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) return job || {};
    const live = getLoredeckCreatorLiveGenerationForJob(job);
    if (!live) return job;
    return {
        ...job,
        activeGeneration: live,
        status: 'running',
    };
}
