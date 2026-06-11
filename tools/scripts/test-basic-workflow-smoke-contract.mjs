import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const liveSmoke = await readText('tools/scripts/smoke-live-st-cdp.mjs');
const alphaSystems = await readText('docs/development/SAGA_ALPHA_RELEASE_SYSTEMS.md');

function assertIncludes(source, token, message) {
  assert(source.includes(token), message || `Expected source to include ${token}.`);
}

assertIncludes(liveSmoke, 'SAGA_SMOKE_TARGET', 'Live smoke helper must expose targeted smoke modes.');
assertIncludes(liveSmoke, 'REPO_LOCAL_HARNESS_TARGETS', 'Live smoke helper must declare repo-local harness targets.');
assertIncludes(liveSmoke, "'guide-harness'", 'Live smoke helper must include the guide harness target.');
assertIncludes(liveSmoke, "if (target === 'guide-harness') return '?mode=basic&tab=session';", 'Guide harness must open the Basic Session tab.');
assertIncludes(liveSmoke, 'async function runGuideHarnessSmoke', 'Guide harness smoke must have a dedicated runner.');
assertIncludes(liveSmoke, "SMOKE_TARGET === 'guide-harness'", 'Live smoke main dispatch must run the guide harness target.');
assertIncludes(liveSmoke, 'window.__sagaSmokeReady === true', 'Guide smoke must wait for the repo-local harness ready marker.');
assertIncludes(liveSmoke, 'Guide harness did not open in Basic mode.', 'Guide smoke must assert Basic mode.');
assertIncludes(liveSmoke, 'Guide harness did not open the Basic Session tab.', 'Guide smoke must assert the Session tab.');
assertIncludes(liveSmoke, 'Basic guide card did not render the expected title and full walkthrough action.', 'Guide smoke must verify the Basic walkthrough launch card.');
assertIncludes(liveSmoke, 'Basic rail exposed hidden Injection or Continuity tabs.', 'Guide smoke must guard Basic rail visibility.');
assertIncludes(liveSmoke, 'hiddenActionButtons', 'Guide smoke must guard Basic against Advanced-only action buttons.');
assertIncludes(liveSmoke, 'Start Basic Walkthrough', 'Guide smoke must click the Basic walkthrough launch action.');
assertIncludes(liveSmoke, 'Basic Workflow Orientation', 'Guide smoke must verify the Basic full-tour first step.');
assertIncludes(liveSmoke, 'Loredecks as Source Packs', 'Guide smoke must verify a focused Basic module start.');
assertIncludes(liveSmoke, 'Library Layout', 'Guide smoke must verify prepared fullscreen Library targeting.');
assertIncludes(liveSmoke, 'saga-loredeck-library-overlay', 'Guide smoke must open the fullscreen Library overlay.');
assertIncludes(liveSmoke, "activeTab !== 'loredecks'", 'Guide smoke must verify Basic module tab navigation.');
assertIncludes(liveSmoke, 'When to use:', 'Guide smoke must require walkthrough usability detail.');
assertIncludes(liveSmoke, 'Expected result:', 'Guide smoke must require walkthrough outcome detail.');

for (const label of ['First Run', 'Loredecks', 'Context', 'Lorecards', 'Continue Roleplay', 'Settings']) {
  assertIncludes(liveSmoke, label, `Guide smoke must verify the Basic module label: ${label}.`);
}

for (const screenshot of [
  'guide-harness-01-basic-card',
  'guide-harness-02-basic-module',
  'guide-harness-03-basic-prepared-library',
  'guide-harness-04-basic-tour',
]) {
  assertIncludes(liveSmoke, screenshot, `Guide smoke must capture ${screenshot}.`);
}

assert.match(
  alphaSystems,
  /Basic workflow smoke contract|repo-local Basic workflow smoke/i,
  'Alpha systems doc must name the Basic workflow smoke contract.'
);

console.log('Basic workflow smoke contract passed.');
