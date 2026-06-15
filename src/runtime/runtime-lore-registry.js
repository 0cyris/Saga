/**
 * runtime-lore-registry.js - Saga
 * Lore taxonomy display helpers used across runtime panels.
 */

import { LORE_CATEGORY_VALUES } from '../lorecards/lore-relevance.js';
import { getLoreTaxonomySync } from '../context/canon-lore-db.js';

const CATEGORY_LABELS = Object.freeze({
    all: 'All',
    pinned: 'Elevated',
    elevated: 'Elevated',
    suppressed: 'Muted',
    pending: 'Pending',
    high: 'High Relevance',
    normal: 'Normal Relevance',
    low: 'Low Relevance',
    canon: 'Canon',
    au: 'AU',
    secret: 'Secret',
    rumor: 'Rumor',
    lie: 'Lie',
    character: 'Character',
    faction: 'Faction',
    location: 'Location',
    item: 'Item',
    event: 'Event',
    rule: 'Rule',
    relationship: 'Relationship',
    timeline: 'Timeline',
    knowledge: 'Knowledge',
    place: 'Place',
    spell: 'Spell',
    artifact: 'Artifact',
});

function getLoreRegistry(registryName) {
    const taxonomy = getLoreTaxonomySync();
    return taxonomy?.[registryName] || {};
}

export function getLoreRegistryValues(registryName, fallback = []) {
    if (registryName === 'canonStatuses') return ['canon', 'au'];
    if (registryName === 'categories') return LORE_CATEGORY_VALUES;
    const registry = getLoreRegistry(registryName);
    const values = Object.keys(registry);
    return values.length ? values : fallback;
}

function getLoreFieldRegistry(field) {
    if (field === 'category') return 'categories';
    if (field === 'canonStatus') return 'canonStatuses';
    if (field === 'truthStatus') return 'truthStatuses';
    if (field === 'revealPolicy') return 'revealPolicies';
    return '';
}

export function getLoreRegistryMeta(registryName, value) {
    const registry = getLoreRegistry(registryName);
    return registry?.[value] || null;
}

export function getCountLabel(value, label) {
    const count = Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0);
    return `${count} ${label}${count === 1 ? '' : 's'}`;
}

export function getLoreDisplayLabel(field, value) {
    if (field === 'priority') return `P${value}`;
    const registryName = getLoreFieldRegistry(field);
    const meta = registryName ? getLoreRegistryMeta(registryName, value) : null;
    return meta?.label || CATEGORY_LABELS[value] || String(value || '');
}
