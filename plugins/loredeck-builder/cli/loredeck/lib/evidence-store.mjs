/**
 * evidence-store.mjs -- Saga loredeck CLI
 * Evidence record files and the review index. Evidence bodies are written by
 * research passes (subagents or humans); this module validates them and owns
 * evidence/evidence-index.json, which records accept/reject decisions without
 * ever editing record bodies.
 */

import path from 'node:path';

import {
    isValidSlug,
    listJsonFilesRecursive,
    nowIso,
    pathExists,
    readJsonFile,
    toPosixRelative,
    writeJsonFile,
} from './deck-fs.mjs';

export const EVIDENCE_SOURCE_KINDS = ['user_supplied', 'web'];
export const EVIDENCE_STATUSES = ['pending', 'accepted', 'rejected'];

export function evidenceDir(projectDir) {
    return path.join(projectDir, 'evidence');
}

export function evidenceIndexPath(projectDir) {
    return path.join(evidenceDir(projectDir), 'evidence-index.json');
}

export function validateEvidenceFile(json, { fileLabel = 'evidence file' } = {}) {
    const issues = [];
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return { issues: [`${fileLabel}: not a JSON object.`], records: [] };
    }
    if (json.schemaVersion !== 1) issues.push(`${fileLabel}: schemaVersion must be 1.`);
    if (!isValidSlug(json.scope)) issues.push(`${fileLabel}: scope must be a lowercase slug.`);
    if (json.deckId && !isValidSlug(json.deckId)) issues.push(`${fileLabel}: deckId must be a lowercase slug.`);
    if (!EVIDENCE_SOURCE_KINDS.includes(json.sourceKind)) {
        issues.push(`${fileLabel}: sourceKind must be one of ${EVIDENCE_SOURCE_KINDS.join(', ')}.`);
    }
    const provenance = json.provenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
        issues.push(`${fileLabel}: provenance object is required.`);
    } else if (json.sourceKind === 'web' && !String(provenance.url || '').trim()) {
        issues.push(`${fileLabel}: web-sourced evidence requires provenance.url.`);
    } else if (json.sourceKind === 'user_supplied' && !String(provenance.title || '').trim()) {
        issues.push(`${fileLabel}: user-supplied evidence requires provenance.title.`);
    }
    const records = Array.isArray(json.records) ? json.records : [];
    if (!records.length) issues.push(`${fileLabel}: records array is empty.`);
    const seen = new Set();
    for (const record of records) {
        const id = String(record?.id || '').trim();
        if (!id) {
            issues.push(`${fileLabel}: record with missing id.`);
            continue;
        }
        if (seen.has(id)) issues.push(`${fileLabel}: duplicate record id ${id}.`);
        seen.add(id);
        if (!String(record?.title || '').trim()) issues.push(`${fileLabel}: record ${id} is missing a title.`);
        if (!Array.isArray(record?.facts) || !record.facts.length) {
            issues.push(`${fileLabel}: record ${id} has no facts.`);
        }
    }
    return { issues, records };
}

export async function listEvidenceFiles(projectDir) {
    const root = evidenceDir(projectDir);
    const indexPath = evidenceIndexPath(projectDir);
    const files = await listJsonFilesRecursive(root);
    return files.filter(file => path.resolve(file) !== path.resolve(indexPath));
}

export async function loadEvidenceIndex(projectDir) {
    const indexPath = evidenceIndexPath(projectDir);
    if (!(await pathExists(indexPath))) {
        return { schemaVersion: 1, records: {} };
    }
    const index = await readJsonFile(indexPath);
    if (!index || typeof index !== 'object' || Array.isArray(index) || typeof index.records !== 'object') {
        throw new Error(`Evidence index is invalid: ${indexPath}.`);
    }
    return index;
}

export async function saveEvidenceIndex(projectDir, index) {
    await writeJsonFile(evidenceIndexPath(projectDir), index);
    return index;
}

export async function collectEvidence(projectDir, { scope = '' } = {}) {
    const files = await listEvidenceFiles(projectDir);
    const index = await loadEvidenceIndex(projectDir);
    const output = { files: [], records: [], issues: [] };
    for (const file of files) {
        const fileLabel = toPosixRelative(projectDir, file);
        let json = null;
        try {
            json = await readJsonFile(file);
        } catch (e) {
            output.issues.push(`${fileLabel}: failed to parse JSON. ${e?.message || ''}`.trim());
            output.files.push({ file: fileLabel, scope: '', ok: false, recordCount: 0 });
            continue;
        }
        const fileScope = String(json?.scope || '');
        const fileDeckId = String(json?.deckId || '');
        if (scope && fileScope !== scope) continue;
        const { issues, records } = validateEvidenceFile(json, { fileLabel });
        output.issues.push(...issues);
        output.files.push({ file: fileLabel, scope: fileScope, ok: !issues.length, recordCount: records.length });
        for (const record of records) {
            const id = String(record?.id || '').trim();
            if (!id) continue;
            const key = `${fileScope}/${id}`;
            const review = index.records[key] || { status: 'pending' };
            output.records.push({
                key,
                scope: fileScope,
                deckId: fileDeckId,
                id,
                title: String(record?.title || ''),
                file: fileLabel,
                status: EVIDENCE_STATUSES.includes(review.status) ? review.status : 'pending',
                note: String(review.note || ''),
                factCount: Array.isArray(record?.facts) ? record.facts.length : 0,
                keyEntities: Array.isArray(record?.keyEntities) ? record.keyEntities : [],
                authoringSignals: Array.isArray(record?.authoringSignals) ? record.authoringSignals : [],
            });
        }
    }
    return output;
}

export async function setEvidenceStatus(projectDir, { scope, ids = [], all = false, status, note = '' }) {
    if (!EVIDENCE_STATUSES.includes(status)) {
        throw new Error(`Unknown evidence status: ${JSON.stringify(status)}.`);
    }
    const collected = await collectEvidence(projectDir, { scope });
    const targets = collected.records.filter(record => all || ids.includes(record.id) || ids.includes(record.key));
    if (!targets.length) {
        throw new Error(`No evidence records matched${scope ? ` scope ${scope}` : ''}${all ? '' : ` ids ${ids.join(', ')}`}.`);
    }
    const index = await loadEvidenceIndex(projectDir);
    for (const record of targets) {
        index.records[record.key] = {
            status,
            ...(note ? { note } : {}),
            updatedAt: nowIso(),
        };
    }
    await saveEvidenceIndex(projectDir, index);
    return targets.map(record => record.key);
}

export function countEvidence(records) {
    const counts = { total: records.length, accepted: 0, pending: 0, rejected: 0 };
    for (const record of records) counts[record.status] = (counts[record.status] || 0) + 1;
    return counts;
}

/**
 * Returns a Map<key, deckId> of every accepted evidence record, keyed the
 * same way as before (so existing `.has(ref)` callers are unaffected); the
 * value is the evidence file's declared deckId ('' if unset), letting
 * callers additionally detect cross-deck citations without a second lookup.
 */
export async function acceptedEvidenceKeys(projectDir) {
    const collected = await collectEvidence(projectDir, {});
    return new Map(collected.records.filter(record => record.status === 'accepted').map(record => [record.key, record.deckId]));
}
