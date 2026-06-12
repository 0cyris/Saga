/**
 * loredeck-edit-proposals.js - Saga
 * Runtime Loredeck edit proposal builders that queue Pending Review changes.
 */

let editProposalDeps = {};

export function configureLoredeckEditProposals(deps = {}) {
    editProposalDeps = { ...editProposalDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof editProposalDeps[name] === 'function' ? editProposalDeps[name] : fallback;
}

function toast(message, type = 'info') { return dep('toast')(message, type); }
function queueLoredeckPendingChange(pack, change, message = '') { return dep('queueLoredeckPendingChange', () => false)(pack, change, message); }
function createLoredeckRecordPatchChange(fields = {}) { return dep('createLoredeckRecordPatchChange', input => input)(fields); }
function normalizeLoredeckTimelineId(value = '') { return dep('normalizeLoredeckTimelineId', input => String(input || '').trim().toLowerCase())(value); }
function normalizeLoredeckTimelineAnchor(raw = {}, fallbackId = '') { return dep('normalizeLoredeckTimelineAnchor', input => input || null)(raw, fallbackId); }
function normalizeLoredeckTimelineWindow(raw = {}, fallbackId = '') { return dep('normalizeLoredeckTimelineWindow', input => input || null)(raw, fallbackId); }
function normalizeLoredeckTagId(value = '') { return dep('normalizeLoredeckTagId', input => String(input || '').trim().toLowerCase())(value); }
function normalizeLoredeckTagDefinition(raw = {}, tagId = '') { return dep('normalizeLoredeckTagDefinition', input => input || {})(raw, tagId); }
function parseLoredeckEntryTags(value = []) { return dep('parseLoredeckEntryTags', input => Array.isArray(input) ? input : [])(value); }
function humanizeLoredeckTagId(tagId = '') { return dep('humanizeLoredeckTagId', value => String(value || 'tag'))(tagId); }
function getExpectedLoredeckEntrySchemaVersion(pack = {}) { return dep('getExpectedLoredeckEntrySchemaVersion', input => Number(input?.entrySchemaVersion) || 0)(pack); }
function normalizeLoreEntry(entry = {}) { return dep('normalizeLoreEntry', input => input || {})(entry); }
function normalizeLoredeckEntryForSchemaV3(entry = {}) { return dep('normalizeLoredeckEntryForSchemaV3', input => input || {})(entry); }
function getLoredeckEntryTags(entry = {}) { return dep('getLoredeckEntryTags', input => parseLoredeckEntryTags(input?.tags || []))(entry); }

function mergeLoredeckEntryTags(current = [], additions = []) {
    const tags = parseLoredeckEntryTags(current);
    const seen = new Set(tags.map(tag => tag.toLowerCase()));
    for (const tag of parseLoredeckEntryTags(additions)) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
    }
    return tags.slice(0, 64);
}

function removeLoredeckEntryTags(current = [], removals = []) {
    const removeSet = new Set(parseLoredeckEntryTags(removals).map(tag => tag.toLowerCase()));
    if (!removeSet.size) return parseLoredeckEntryTags(current);
    return parseLoredeckEntryTags(current).filter(tag => !removeSet.has(tag.toLowerCase()));
}

function replaceLoredeckEntryTag(current = [], fromTag = '', toTag = '') {
    const from = parseLoredeckEntryTags([fromTag])[0] || '';
    if (!from) return parseLoredeckEntryTags(current);
    const to = parseLoredeckEntryTags([toTag])[0] || '';
    const next = removeLoredeckEntryTags(current, [from]);
    return to ? mergeLoredeckEntryTags(next, [to]) : next;
}

function getLoredeckEntryRowsForBulk(rows = []) {
    return (rows || []).filter(row => row?.id && !row.disabled);
}

export function buildBulkLoredeckTagOverrideEntry(pack, row, tags = []) {
    const baseEntry = row.overrideEntry || row.sourceEntry || row.entry || {};
    const entrySchemaVersion = Math.max(Number(baseEntry.schemaVersion) || 0, getExpectedLoredeckEntrySchemaVersion(pack));
    const id = String(row.id || baseEntry.id || '').trim();
    const title = String(baseEntry.title || id || 'Lorecard').trim();
    const fact = String(baseEntry.content?.fact || baseEntry.fact || baseEntry.description || baseEntry.detail || title).trim();
    const injection = String(baseEntry.content?.injection || baseEntry.injection || fact).trim();
    const cleanTags = parseLoredeckEntryTags(tags);
    let entry = normalizeLoreEntry({
        ...baseEntry,
        id,
        title,
        tags: cleanTags,
        content: {
            ...(baseEntry.content || {}),
            fact,
            injection,
        },
        userEditable: true,
        userEdited: true,
        extensions: {
            ...(baseEntry.extensions || {}),
            sagaLoredeckOverride: {
                kind: row.sourceEntry ? 'override' : 'addition',
                packId: pack.packId,
                sourceEntryId: row.sourceEntry?.id || '',
                updatedAt: Date.now(),
            },
        },
    });
    entry.id = id;
    entry.tags = cleanTags;
    if (entrySchemaVersion >= 3) {
        entry = normalizeLoredeckEntryForSchemaV3({
            ...entry,
            id,
            schemaVersion: 3,
            tags: cleanTags,
        });
        entry.tags = cleanTags;
    }
    return entry;
}

export function computeLoredeckBulkTagUpdates(pack, rows = [], mode = 'add', fields = {}) {
    const updates = [];
    const addTags = parseLoredeckEntryTags(fields.addTags);
    const removeTags = parseLoredeckEntryTags(fields.removeTags);
    const fromTag = parseLoredeckEntryTags([fields.fromTag])[0] || '';
    const toTag = parseLoredeckEntryTags([fields.toTag])[0] || '';

    for (const row of getLoredeckEntryRowsForBulk(rows)) {
        const current = getLoredeckEntryTags(row.entry || {});
        let next = current;
        if (mode === 'add') next = mergeLoredeckEntryTags(current, addTags);
        else if (mode === 'remove') next = removeLoredeckEntryTags(current, removeTags);
        else if (mode === 'replace') next = replaceLoredeckEntryTag(current, fromTag, toTag);

        if (JSON.stringify(current.map(tag => tag.toLowerCase()).sort()) === JSON.stringify(next.map(tag => tag.toLowerCase()).sort())) continue;
        updates.push(buildBulkLoredeckTagOverrideEntry(pack, row, next));
    }
    return updates;
}

export function saveLoredeckTimelineAnchorDefinition(pack, anchor, message = '') {
    const id = normalizeLoredeckTimelineId(anchor?.id);
    if (!id) {
        toast('Timeline anchor needs a valid ID.', 'warning');
        return false;
    }
    const def = normalizeLoredeckTimelineAnchor({ ...anchor, id }, id);
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_timeline_anchor',
        targetKind: 'timeline_anchor',
        title: `Save timeline anchor: ${id}`,
        description: 'Creates or updates a Custom timeline anchor overlay after review.',
        affectedTimelineIds: [id],
        payload: {
            timelineAnchors: { [id]: def },
            timelineAnchorIdsEnable: [id],
        },
        preview: {
            after: def.label || id,
        },
    }), message || `Queued timeline anchor for ${id}.`);
}

export function saveLoredeckTimelineWindowDefinition(pack, windowDef, message = '') {
    const id = normalizeLoredeckTimelineId(windowDef?.id);
    if (!id) {
        toast('Timeline window needs a valid ID.', 'warning');
        return false;
    }
    const def = normalizeLoredeckTimelineWindow({ ...windowDef, id }, id);
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_timeline_window',
        targetKind: 'timeline_window',
        title: `Save timeline window: ${id}`,
        description: 'Creates or updates a Custom timeline window overlay after review.',
        affectedTimelineIds: [id, def.anchorFrom, def.anchorTo].filter(Boolean),
        payload: {
            timelineWindows: { [id]: def },
            timelineWindowIdsEnable: [id],
        },
        preview: {
            after: def.label || `${def.anchorFrom || '?'} -> ${def.anchorTo || '?'}`,
        },
    }), message || `Queued timeline window for ${id}.`);
}

export function removeLoredeckTimelineDefinition(pack, kind = 'anchor', id = '') {
    const cleanId = normalizeLoredeckTimelineId(id);
    if (!cleanId) return false;
    const isWindow = kind === 'window';
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: isWindow ? 'remove_timeline_window' : 'remove_timeline_anchor',
        targetKind: isWindow ? 'timeline_window' : 'timeline_anchor',
        title: `Forget timeline ${isWindow ? 'window' : 'anchor'}: ${cleanId}`,
        description: 'Removes the Custom timeline overlay after review. Source definitions remain unless disabled.',
        affectedTimelineIds: [cleanId],
        payload: isWindow
            ? { timelineWindows: { [cleanId]: null } }
            : { timelineAnchors: { [cleanId]: null } },
        preview: {
            after: 'Custom timeline overlay will be removed.',
        },
    }), `Queued timeline overlay removal for ${cleanId}.`);
}

export function setLoredeckTimelineItemDisabled(pack, kind = 'anchor', id = '', disabled = true) {
    const cleanId = normalizeLoredeckTimelineId(id);
    if (!cleanId) return false;
    const isWindow = kind === 'window';
    const payload = isWindow
        ? {
            timelineWindowIdsDisable: disabled ? [cleanId] : [],
            timelineWindowIdsEnable: disabled ? [] : [cleanId],
        }
        : {
            timelineAnchorIdsDisable: disabled ? [cleanId] : [],
            timelineAnchorIdsEnable: disabled ? [] : [cleanId],
        };
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: disabled ? 'disable_timeline_definition' : 'enable_timeline_definition',
        targetKind: isWindow ? 'timeline_window' : 'timeline_anchor',
        title: `${disabled ? 'Disable' : 'Enable'} timeline ${isWindow ? 'window' : 'anchor'}: ${cleanId}`,
        description: `${disabled ? 'Suppresses' : 'Restores'} this timeline definition after review.`,
        affectedTimelineIds: [cleanId],
        payload,
        preview: {
            after: disabled ? 'Definition will be disabled in this Custom overlay.' : 'Definition will be restored in this Custom overlay.',
        },
    }), `Queued timeline ${disabled ? 'disable' : 'enable'} for ${cleanId}.`);
}

export function saveLoredeckTagRegistryDefinition(pack, tagId, definition, message = '') {
    const id = normalizeLoredeckTagId(tagId);
    if (!id) {
        toast('Tag definition needs a valid tag ID.', 'warning');
        return false;
    }
    const def = normalizeLoredeckTagDefinition(definition, id);
    delete def.id;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_tag_definition',
        targetKind: 'tag',
        title: `Save tag definition: ${id}`,
        description: 'Creates or updates a Custom tag registry definition after review.',
        affectedTagIds: [id],
        payload: {
            tagDefinitions: { [id]: def },
        },
        preview: {
            after: def.description || def.label || id,
        },
    }), message || `Queued pending tag definition for ${id}.`);
}

export function removeLoredeckTagRegistryDefinition(pack, tagId) {
    const id = normalizeLoredeckTagId(tagId);
    if (!id) return false;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'remove_tag_definition',
        targetKind: 'tag',
        title: `Forget tag definition: ${id}`,
        description: 'Removes the Custom tag registry definition after review without changing entry tags.',
        affectedTagIds: [id],
        payload: {
            tagDefinitions: { [id]: null },
        },
        preview: {
            after: 'Custom tag definition will be removed.',
        },
    }), `Queued pending tag definition removal for ${id}.`);
}

export function queueLoredeckTagRenameProposal(pack, options = {}) {
    const fromTag = normalizeLoredeckTagId(options.fromTag);
    const toTag = normalizeLoredeckTagId(options.toTag);
    if (!fromTag || !toTag || toTag.toLowerCase() === fromTag.toLowerCase()) return false;

    const item = options.item || {};
    const updates = Array.isArray(options.updates) ? options.updates : [];
    const sourceDef = normalizeLoredeckTagDefinition(item.definition || {}, fromTag);
    const tagDefinitions = {};
    const targetDef = normalizeLoredeckTagDefinition({
        ...sourceDef,
        label: sourceDef.label && sourceDef.label !== humanizeLoredeckTagId(fromTag)
            ? sourceDef.label
            : humanizeLoredeckTagId(toTag),
        deprecated: false,
        replacement: '',
    }, toTag);
    delete targetDef.id;
    tagDefinitions[toTag] = targetDef;

    if (options.deprecateOld || item.sourceDefined) {
        const oldDef = normalizeLoredeckTagDefinition({
            ...sourceDef,
            deprecated: true,
            replacement: toTag,
        }, fromTag);
        delete oldDef.id;
        tagDefinitions[fromTag] = oldDef;
    } else {
        tagDefinitions[fromTag] = null;
    }

    const entryOverrides = {};
    const entryIds = [];
    for (const entry of updates) {
        if (!entry.id) continue;
        entryOverrides[entry.id] = entry;
        entryIds.push(entry.id);
    }

    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'rename_tag',
        targetKind: 'tags',
        title: `Rename tag: ${fromTag} -> ${toTag}`,
        description: `Renames or merges a tag definition${entryIds.length ? ` and updates ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}` : ''} after review.`,
        affectedEntryIds: entryIds,
        affectedTagIds: [fromTag, toTag],
        payload: {
            tagDefinitions,
            entryOverrides,
            disabledEntryIdsRemove: entryIds,
        },
        preview: {
            before: fromTag,
            after: toTag,
        },
    }), `Queued tag rename ${fromTag} -> ${toTag}.`);
}

export function queueLoredeckBulkTagUpdate(pack, options = {}) {
    const updates = Array.isArray(options.updates) ? options.updates : [];
    const mode = String(options.mode || 'add').trim() || 'add';
    const entryOverrides = {};
    const entryIds = [];
    for (const entry of updates) {
        if (!entry.id) continue;
        entryOverrides[entry.id] = entry;
        entryIds.push(entry.id);
    }
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'bulk_tag_update',
        targetKind: 'entries',
        title: `Bulk tag ${mode}`,
        description: `Updates tags on ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'} after review.`,
        affectedEntryIds: entryIds,
        affectedTagIds: [
            ...parseLoredeckEntryTags(options.addTags),
            ...parseLoredeckEntryTags(options.removeTags),
            ...parseLoredeckEntryTags([options.fromTag]),
            ...parseLoredeckEntryTags([options.toTag]),
        ],
        payload: {
            entryOverrides,
            disabledEntryIdsRemove: entryIds,
        },
        preview: {
            after: `Tag changes will apply to ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}.`,
        },
    }), `Queued bulk tag update for ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}.`);
}

export function queueLoredeckBulkContextUpdate(pack, options = {}) {
    const entries = Array.isArray(options.entries) ? options.entries : [];
    const contextGate = options.contextGate && typeof options.contextGate === 'object' && !Array.isArray(options.contextGate)
        ? options.contextGate
        : {};
    const entryOverrides = {};
    const entryIds = [];
    for (const entry of entries) {
        if (!entry.id) continue;
        entryOverrides[entry.id] = entry;
        entryIds.push(entry.id);
    }
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'bulk_context_update',
        targetKind: 'entries',
        title: 'Bulk Context update',
        description: `Applies one Context/retrieval block to ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'} after review.`,
        affectedEntryIds: entryIds,
        payload: {
            entryOverrides,
            disabledEntryIdsRemove: entryIds,
        },
        preview: {
            after: contextGate.label || 'Context metadata will be updated.',
        },
    }), `Queued Context update for ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}.`);
}

export function saveLoredeckEntryOverride(pack, entry) {
    const id = String(entry?.id || '').trim();
    if (!id) {
        toast('Entry override needs an ID.', 'warning');
        return false;
    }
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_entry',
        targetKind: 'entry',
        title: `Save entry: ${entry.title || id}`,
        description: 'Creates or updates a Custom Loredeck entry override after review.',
        affectedEntryIds: [id],
        payload: {
            entryOverrides: { [id]: entry },
            disabledEntryIdsRemove: [id],
        },
        preview: {
            after: entry.content?.fact || entry.fact || entry.title || id,
        },
    }), `Queued pending entry change for ${entry.title || id}.`);
}

export function removeLoredeckEntryOverride(pack, entryId) {
    const id = String(entryId || '').trim();
    if (!id) return false;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'remove_entry_override',
        targetKind: 'entry',
        title: `Remove override: ${id}`,
        description: 'Removes the Custom override after review. Source entry remains unless disabled.',
        affectedEntryIds: [id],
        payload: {
            entryOverrides: { [id]: null },
        },
        preview: {
            after: 'Custom override will be removed.',
        },
    }), `Queued pending override removal for ${id}.`);
}

export function setLoredeckEntryDisabled(pack, entryId, disabled) {
    const id = String(entryId || '').trim();
    if (!id) return false;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: disabled ? 'disable_entry' : 'restore_entry',
        targetKind: 'entry',
        title: `${disabled ? 'Disable' : 'Restore'} entry: ${id}`,
        description: disabled
            ? 'Suppresses this entry in the Custom Loredeck after review.'
            : 'Removes this entry from the Custom disabled list after review.',
        affectedEntryIds: [id],
        payload: disabled
            ? { disabledEntryIdsAdd: [id] }
            : { disabledEntryIdsRemove: [id] },
        preview: {
            after: disabled ? 'Entry will be disabled.' : 'Entry will be restored.',
        },
    }), `Queued pending ${disabled ? 'disable' : 'restore'} for ${id}.`);
}
