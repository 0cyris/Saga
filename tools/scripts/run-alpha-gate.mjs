import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const syntaxTargets = [
  'src/extension/index.js',
  'src/runtime/lore-panel.js',
  'src/runtime/runtime-redaction.js',
  'src/runtime/runtime-guide-content.js',
  'src/context/context-workbench-panel.js',
  'src/lorecards/lorecards-panel.js',
  'src/loredecks/loredeck-health-panel.js',
  'src/ui/ui.js',
  'src/settings/settings-panel.js',
  'src/state/constants.js',
  'src/state/state-manager.js',
  'src/continuity/prompt-injector.js',
  'src/continuity/memo-builder.js',
  'tools/scripts/smoke-live-st-cdp.mjs',
];

const gateScripts = [
  'tools/scripts/test-manifest-alpha.mjs',
  'tools/scripts/test-repository-layout.mjs',
  'tools/scripts/test-basic-readiness.mjs',
  'tools/scripts/test-experience-modes.mjs',
  'tools/scripts/test-loredeck-context-health.mjs',
  'tools/scripts/test-loredeck-creator-reset.mjs',
  'tools/scripts/test-loredeck-creator-stage-reset-ui.mjs',
  'tools/scripts/test-hp-loredeck-health.mjs',
  'tools/scripts/test-loredeck-health-center-refresh.mjs',
  'tools/scripts/test-context-resolver.mjs',
  'tools/scripts/test-context-gating.mjs',
  'tools/scripts/test-canon-context-retrieval.mjs',
  'tools/scripts/test-retrieval-audit.mjs',
  'tools/scripts/test-lore-response-normalizer.mjs',
  'tools/scripts/test-generation-response-shapes.mjs',
  'tools/scripts/test-prompt-compression-contract.mjs',
  'tools/scripts/test-context-model-resolver.mjs',
  'tools/scripts/test-hp-reference-deck-conformance.mjs',
  'tools/scripts/test-loredeck-zip-package.mjs',
  'tools/scripts/test-context-current-contract.mjs',
  'tools/scripts/test-context-workbench-picker.mjs',
  'tools/scripts/test-state-safety-contract.mjs',
  'tools/scripts/test-diagnostic-redaction.mjs',
  'tools/scripts/test-prompt-injection-stale-state.mjs',
  'tools/scripts/test-prompt-injection-chat-change-smoke.mjs',
  'tools/scripts/test-prompt-injection-event-lifecycle-smoke.mjs',
  'tools/scripts/test-basic-workflow-smoke-contract.mjs',
  'tools/scripts/test-css-sanity.mjs',
  'tools/scripts/test-runtime-ui-confirm-dialog.mjs',
  'tools/scripts/test-visual-smoke-harness.mjs',
  'tools/scripts/scan-secrets.mjs',
];

function runNode(args, label) {
  console.log(`\n[alpha-gate] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
}

for (const target of syntaxTargets) {
  runNode(['--check', target], `node --check ${target}`);
}

for (const script of gateScripts) {
  runNode([script], script);
}

console.log('\nAlpha gate passed.');
