/**
 * Tag registry Deck Health helpers for Saga Loredecks.
 */

import {
    addHealthIssue,
    cleanHealthString,
    cleanTagIdForHealth,
    cleanTagLabelForHealth,
    isPlainObject,
} from './loredeck-health-core.js';

export function getTagRegistryRef(manifest = {}) {
    if (!isPlainObject(manifest)) return '';
    const registries = isPlainObject(manifest.registries) ? manifest.registries : {};
    const refs = [
        typeof registries.tags === 'string' ? registries.tags : '',
        typeof manifest.tagRegistry === 'string' ? manifest.tagRegistry : '',
        typeof manifest.tagsRegistry === 'string' ? manifest.tagsRegistry : '',
    ];
    for (const ref of refs) {
        const cleaned = cleanHealthString(ref, 400);
        if (cleaned) return cleaned;
    }
    return '';
}

export function normalizeHealthTagList(value, limit = 64, normalizeIds = false) {
    const rawItems = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const raw of rawItems) {
        const text = normalizeIds ? cleanTagIdForHealth(raw) : cleanTagLabelForHealth(raw, 160);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}

export function normalizeTagRegistryDefinitionForHealth(raw = {}, tagId = '') {
    const input = isPlainObject(raw) ? raw : {};
    const id = cleanTagIdForHealth(input.id || tagId);
    return {
        id,
        label: cleanTagLabelForHealth(input.label || '', 180),
        description: cleanHealthString(input.description || '', 1000),
        color: cleanHealthString(input.color || '', 32),
        textColor: cleanHealthString(input.textColor || '', 32),
        aliases: normalizeHealthTagList(input.aliases, 64, false),
        parents: normalizeHealthTagList(input.parents, 64, true),
        sensitive: input.sensitive === true,
        deprecated: input.deprecated === true,
        replacement: cleanTagIdForHealth(input.replacement || ''),
    };
}

export function normalizeTagRegistryForHealth(raw = {}) {
    if (!isPlainObject(raw)) return { tags: [] };
    const source = isPlainObject(raw.tags) ? raw.tags : raw;
    const tags = [];
    let count = 0;
    for (const [rawId, rawDef] of Object.entries(source || {})) {
        if (!isPlainObject(rawDef)) continue;
        const id = cleanTagIdForHealth(rawDef.id || rawId);
        if (!id) continue;
        tags.push(normalizeTagRegistryDefinitionForHealth(rawDef, id));
        count += 1;
        if (count >= 2000) break;
    }
    return { tags };
}

export function createEmptyTagRegistryHealthIndex(packId = '', tagRegistryRef = '') {
    return {
        packId,
        tagRegistryRef,
        hasSourceRegistry: false,
        hasCustomRegistry: false,
        hasRegistry: false,
        definitions: [],
        definitionById: new Map(),
        sourceDefinitionById: new Map(),
        customDefinitionById: new Map(),
    };
}

export function createTagRegistryHealthIndex(options = {}) {
    const packId = cleanHealthString(options.packId, 160);
    const tagRegistryRef = cleanHealthString(options.tagRegistryRef, 400);
    const sourceRegistry = normalizeTagRegistryForHealth(options.sourceRegistry);
    const customRegistry = normalizeTagRegistryForHealth(options.customRegistry);
    const sourceDefinitionById = new Map();
    const customDefinitionById = new Map();
    const definitionById = new Map();

    for (const def of sourceRegistry.tags || []) {
        const id = cleanTagIdForHealth(def.id);
        if (!id || sourceDefinitionById.has(id)) continue;
        sourceDefinitionById.set(id, { ...def, id });
        definitionById.set(id, { ...def, id, sourceDefined: true, customDefined: false });
    }
    for (const def of customRegistry.tags || []) {
        const id = cleanTagIdForHealth(def.id);
        if (!id || customDefinitionById.has(id)) continue;
        customDefinitionById.set(id, { ...def, id });
        definitionById.set(id, {
            ...(definitionById.get(id) || {}),
            ...def,
            id,
            sourceDefined: definitionById.has(id),
            customDefined: true,
        });
    }

    return {
        packId,
        tagRegistryRef,
        hasSourceRegistry: options.hasSourceRegistry === true || sourceDefinitionById.size > 0,
        hasCustomRegistry: customDefinitionById.size > 0,
        hasRegistry: options.hasSourceRegistry === true || sourceDefinitionById.size > 0 || customDefinitionById.size > 0,
        definitions: Array.from(definitionById.values()),
        definitionById,
        sourceDefinitionById,
        customDefinitionById,
    };
}

export function addTagHealthIssue(health, severity, code, message, extra = {}) {
    if (code === 'undefined_tag') health.summary.undefinedTagCount += Number(extra.affectedTagCount || 1) || 1;
    if (code === 'deprecated_tag_used') health.summary.deprecatedTagUsageCount += Number(extra.affectedTagCount || 1) || 1;
    if (code === 'duplicate_tag_alias') health.summary.duplicateTagAliasCount += Number(extra.affectedAliasCount || 1) || 1;
    if (code === 'orphaned_tag_definition') health.summary.orphanedTagCount += Number(extra.affectedTagCount || 1) || 1;
    if (['malformed_tag_namespace', 'malformed_tag_id', 'malformed_tag_reference'].includes(code)) {
        health.summary.malformedTagCount += Number(extra.affectedTagCount || 1) || 1;
    }
    addHealthIssue(health, severity, code, message, extra);
}

export function getTagIdFormatProblems(tagId = '') {
    const tag = cleanHealthString(tagId, 120);
    const problems = [];
    if (!tag) return ['empty tag id'];
    if (cleanTagIdForHealth(tag) !== tag) problems.push('contains unsupported characters');
    if (/\s/.test(tag)) problems.push('contains whitespace');
    if (tag.includes(':')) {
        const [namespace, ...rest] = tag.split(':');
        const value = rest.join(':');
        if (!namespace || !value) problems.push('has an incomplete namespace');
        if (namespace && !/^[\p{L}\p{N}_.-]+$/u.test(namespace)) problems.push('has an invalid namespace');
    }
    return problems;
}

function isBundledManifest(manifest = {}) {
    return cleanHealthString(manifest.type, 80) === 'bundled';
}

export async function loadTagRegistryForHealth(manifest = {}, baseUrl = null, health, registryRecord = null, fetchJsonDetailed = null) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const tagRegistryRef = getTagRegistryRef(manifest);
    let sourceRegistry = isPlainObject(manifest.tagRegistry) ? manifest.tagRegistry : null;
    let hasSourceRegistry = !!sourceRegistry || !!tagRegistryRef;

    if (tagRegistryRef && baseUrl && typeof fetchJsonDetailed === 'function') {
        let tagRegistryUrl = null;
        try {
            tagRegistryUrl = new URL(tagRegistryRef, baseUrl);
        } catch (_) {
            addHealthIssue(health, 'warning', 'tag_registry_invalid_ref', `Tag registry path is invalid: ${tagRegistryRef}.`, {
                tagRegistryRef,
            });
            hasSourceRegistry = false;
        }

        if (tagRegistryUrl) {
            const result = await fetchJsonDetailed(tagRegistryUrl);
            if (!result.ok) {
                addHealthIssue(health, 'warning', 'tag_registry_load_failed', `Tag registry failed to load: ${tagRegistryRef}.`, {
                    tagRegistryRef,
                    status: result.status,
                    detail: result.error || result.statusText || '',
                });
                hasSourceRegistry = false;
            } else {
                sourceRegistry = result.json;
                hasSourceRegistry = true;
            }
        }
    }

    const tagIndex = createTagRegistryHealthIndex({
        packId,
        tagRegistryRef,
        sourceRegistry,
        customRegistry: registryRecord?.tagRegistry,
        hasSourceRegistry,
    });
    health.summary.tagRegistryTagCount = tagIndex.definitions.length;
    analyzeTagRegistryDefinitionHealth(health, tagIndex, manifest);
    return tagIndex;
}

export function createInMemoryTagRegistryHealthIndex(manifest = {}, tagRegistry = null, registryRecord = null, health) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const tagRegistryRef = getTagRegistryRef(manifest);
    const sourceRegistry = isPlainObject(tagRegistry)
        ? tagRegistry
        : (isPlainObject(manifest.tagRegistry) ? manifest.tagRegistry : null);
    const tagIndex = createTagRegistryHealthIndex({
        packId,
        tagRegistryRef,
        sourceRegistry,
        customRegistry: registryRecord?.tagRegistry,
        hasSourceRegistry: !!sourceRegistry || !!tagRegistryRef,
    });
    health.summary.tagRegistryTagCount = tagIndex.definitions.length;
    analyzeTagRegistryDefinitionHealth(health, tagIndex, manifest);
    return tagIndex;
}

function analyzeTagIdHealth(health, tagId = '', context = {}) {
    const problems = getTagIdFormatProblems(tagId);
    if (!problems.length) return;
    addTagHealthIssue(health, 'warning', 'malformed_tag_namespace', `Tag ${tagId || '(empty)'} has malformed namespace/id syntax: ${problems.join(', ')}.`, {
        tagIds: tagId ? [tagId] : [],
        entryIds: context.entryId ? [context.entryId] : [],
        file: context.file || '',
        registryTag: context.registryTag === true,
        reasons: problems,
    });
}

export function analyzeTagRegistryDefinitionHealth(health, tagIndex = {}, manifest = {}) {
    const aliasMap = new Map();

    for (const def of tagIndex.definitions || []) {
        analyzeTagIdHealth(health, def.id, { registryTag: true });

        for (const parent of def.parents || []) {
            analyzeTagIdHealth(health, parent, { registryTag: true });
            if (tagIndex.definitionById?.has(parent)) continue;
            addTagHealthIssue(health, 'warning', 'tag_parent_missing', `Tag ${def.id} references unknown parent tag ${parent}.`, {
                tagIds: [def.id, parent],
                parentTagId: parent,
            });
        }

        if (def.replacement) {
            analyzeTagIdHealth(health, def.replacement, { registryTag: true });
            if (!tagIndex.definitionById?.has(def.replacement)) {
                addTagHealthIssue(health, 'warning', 'deprecated_tag_replacement_missing', `Deprecated tag ${def.id} references unknown replacement tag ${def.replacement}.`, {
                    tagIds: [def.id, def.replacement],
                    replacementTagId: def.replacement,
                });
            }
        }

        for (const alias of def.aliases || []) {
            const key = alias.toLowerCase();
            if (!key) continue;
            if (!aliasMap.has(key)) aliasMap.set(key, []);
            aliasMap.get(key).push(def.id);
        }

        if (isBundledManifest(manifest) && !def.id.includes(':')) {
            addHealthIssue(health, 'suggestion', 'unnamespaced_bundled_tag', `Bundled tag ${def.id} should use a namespace like namespace:value.`, {
                tagIds: [def.id],
            });
        }
    }

    const duplicates = [];
    for (const [alias, tagIds] of aliasMap.entries()) {
        const unique = Array.from(new Set(tagIds));
        if (unique.length > 1) duplicates.push({ alias, tagIds: unique });
    }
    if (duplicates.length) {
        addTagHealthIssue(health, 'warning', 'duplicate_tag_alias', `${duplicates.length} tag alias${duplicates.length === 1 ? '' : 'es'} resolve to multiple tag definitions.`, {
            affectedAliasCount: duplicates.length,
            aliases: duplicates.slice(0, 25),
        });
    }
}

function getEntryTagIdsForHealth(entry = {}) {
    return normalizeHealthTagList(Array.isArray(entry.tags) ? entry.tags : entry.tags || [], 128, false);
}

export function analyzeEntryTagHealth(health, entryFiles = [], tagIndex = {}, manifest = {}) {
    const usageByTag = new Map();
    let entryTagCount = 0;

    for (const fileRecord of entryFiles || []) {
        for (const entry of fileRecord.entries || []) {
            const entryId = cleanHealthString(entry?.id, 180);
            const tags = getEntryTagIdsForHealth(entry);
            for (const tag of tags) {
                entryTagCount += 1;
                analyzeTagIdHealth(health, tag, { entryId, file: fileRecord.file });
                if (!usageByTag.has(tag)) {
                    usageByTag.set(tag, {
                        tag,
                        entryIds: [],
                        files: new Set(),
                    });
                }
                const usage = usageByTag.get(tag);
                if (entryId && usage.entryIds.length < 50) usage.entryIds.push(entryId);
                if (fileRecord.file) usage.files.add(fileRecord.file);
            }
        }
    }

    if (entryTagCount && !tagIndex.hasRegistry) {
        addHealthIssue(health, 'suggestion', 'tag_registry_missing', `${usageByTag.size} Lorecard tag${usageByTag.size === 1 ? ' is' : 's are'} used, but this Loredeck has no tag registry.`, {
            tagIds: Array.from(usageByTag.keys()).slice(0, 50),
            affectedTagCount: usageByTag.size,
        });
        return;
    }

    const undefinedTags = [];
    const deprecatedTags = [];
    for (const [tag, usage] of usageByTag.entries()) {
        const def = tagIndex.definitionById?.get(tag);
        if (!def) {
            undefinedTags.push({
                tag,
                entryIds: usage.entryIds,
                files: Array.from(usage.files).slice(0, 10),
            });
            continue;
        }
        if (def.deprecated) {
            deprecatedTags.push({
                tag,
                replacement: def.replacement || '',
                entryIds: usage.entryIds,
                files: Array.from(usage.files).slice(0, 10),
            });
        }
    }

    if (undefinedTags.length) {
        addTagHealthIssue(health, 'warning', 'undefined_tag', `${undefinedTags.length} used tag${undefinedTags.length === 1 ? ' is' : 's are'} not defined in the active tag registry.`, {
            affectedTagCount: undefinedTags.length,
            tags: undefinedTags.slice(0, 50),
        });
    }

    if (deprecatedTags.length) {
        addTagHealthIssue(health, 'warning', 'deprecated_tag_used', `${deprecatedTags.length} deprecated tag${deprecatedTags.length === 1 ? ' is' : 's are'} still used by entries.`, {
            affectedTagCount: deprecatedTags.length,
            tags: deprecatedTags.slice(0, 50),
        });
    }

    const referencedByRegistry = new Set();
    for (const def of tagIndex.definitions || []) {
        for (const parent of def.parents || []) referencedByRegistry.add(parent);
        if (def.replacement) referencedByRegistry.add(def.replacement);
    }
    const orphaned = (tagIndex.definitions || [])
        .map(def => def.id)
        .filter(tagId => !usageByTag.has(tagId) && !referencedByRegistry.has(tagId));
    if (orphaned.length) {
        addTagHealthIssue(health, 'suggestion', 'orphaned_tag_definition', `${orphaned.length} tag definition${orphaned.length === 1 ? ' is' : 's are'} not used by entries or registry relationships.`, {
            affectedTagCount: orphaned.length,
            tagIds: orphaned.slice(0, 50),
        });
    }
}
