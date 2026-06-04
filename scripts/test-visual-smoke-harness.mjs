import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const harnessPath = path.join(root, 'tests', 'visual-smoke.html');
const fixturePath = path.join(root, 'tests', 'fixtures', 'arlong-park-update.saga-lorepack.json');
const panelPath = path.join(root, 'lore-panel.js');
const stylePath = path.join(root, 'style.css');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const harness = read(harnessPath);
const fixture = JSON.parse(read(fixturePath));
const panel = read(panelPath);
const style = read(stylePath);

assert(harness.includes("import { showLorePanel } from '../lore-panel.js';"), 'Harness must import the real runtime panel.');
assert(harness.includes('window.SillyTavern'), 'Harness must stub SillyTavern before importing modules.');
assert(harness.includes('window.__sagaSmokeReady = true'), 'Harness must expose a smoke-ready marker.');
assert(harness.includes("activeTab: 'lorepacks'"), 'Harness must open directly to the Loredecks tab.');
assert(harness.includes("selectedLorepackId: customPack.packId"), 'Harness must select the seeded Custom Loredeck.');
assert(harness.includes('pendingChanges'), 'Harness must seed Pending Review content.');
assert(harness.includes('source: {'), 'Harness must seed source/update metadata.');
assert(harness.includes('./fixtures/arlong-park-update.saga-lorepack.json'), 'Harness must point at the local update fixture.');

assert(fixture.bundleType === 'saga_lorepack_json', 'Fixture must be a Saga Loredeck bundle.');
assert(fixture.pack?.packId === 'smoke-arlong-park', 'Fixture pack ID must match the harness deck.');
assert(fixture.manifest?.id === fixture.pack.packId, 'Fixture manifest ID must match the pack ID.');
assert(fixture.pack?.version === '1.0.1', 'Fixture should simulate a newer published version.');
assert(Array.isArray(fixture.entries) && fixture.entries.length >= 2, 'Fixture must include embedded Lorecards.');
for (const entry of fixture.entries) {
    assert(entry.schemaVersion === 3, `Fixture entry ${entry.id || '(missing id)'} must use schema v3.`);
    assert(entry.id && entry.title, 'Fixture entries need IDs and titles.');
    assert(entry.content?.fact && entry.content?.injection, `Fixture entry ${entry.id} needs high-value content fields.`);
    assert(entry.position && typeof entry.position === 'object', `Fixture entry ${entry.id} needs Story Position metadata.`);
    assert(entry.retrieval && typeof entry.retrieval === 'object', `Fixture entry ${entry.id} needs retrieval metadata.`);
}
assert(fixture.timelineRegistry?.anchors?.length, 'Fixture must include timeline anchors.');
assert(fixture.tagRegistry?.tags?.length, 'Fixture must include tag definitions.');

for (const token of [
    'Check Updates',
    'Loredeck Update Preview',
    'Update This Deck',
    'Install As New Copy',
    'Pending Review',
    'Loredeck Creator',
    'Deck Health Center',
    'Open Health Center',
    'Health Report',
    'renderSettingsTab',
]) {
    assert(panel.includes(token), `Runtime panel is missing expected smoke token: ${token}`);
}

for (const token of [
    'wandlight-lorepack-install-shell',
    'wandlight-runtime-rail',
    'wandlight-runtime-drawer',
    'wandlight-lorepack-detail-card',
    'wandlight-lorepack-health-center-shell',
    'wandlight-lorepack-health-severity-card',
]) {
    assert(style.includes(token), `Stylesheet is missing expected smoke selector: ${token}`);
}

console.log('Visual smoke harness contract passed.');
