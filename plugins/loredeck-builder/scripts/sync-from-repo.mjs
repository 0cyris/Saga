#!/usr/bin/env node
/**
 * sync-from-repo.mjs -- Saga loredeck-builder skill build
 *
 * Regenerates the loredeck-builder .skill bundle from the Saga repo. The repo
 * is the only source of truth; none of this script's output is committed to
 * git (see .gitignore) -- it's a build step, run before build-skill-file.mjs,
 * not something that can drift from a checked-in copy. This script copies
 * and path-rewrites:
 *   - the skill folder (.claude/skills/loredeck-builder)  -> skills/loredeck-builder
 *   - the CLI (tools/loredeck)                            -> cli/loredeck
 *   - the CLI's transitive src closure (12 modules)       -> cli/vendor (flattened)
 *   - the four authoring docs (docs/loredecks/*.md)       -> docs/
 *   - one bundled reference deck (content/loredecks/hp-core) -> reference-decks/hp-core
 *   - a wrapper that defaults the workshop root           -> cli/loredeck-plugin.mjs
 *
 * Run from anywhere: `node plugins/loredeck-builder/scripts/sync-from-repo.mjs`
 * Then `node plugins/loredeck-builder/scripts/build-skill-file.mjs` to zip it.
 */

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPO_ROOT = path.resolve(PLUGIN_ROOT, '..', '..');
const R = (...p) => path.join(REPO_ROOT, ...p);
const P = (...p) => path.join(PLUGIN_ROOT, ...p);

// Transitive closure of the CLI's src imports (computed from the repo; see
// tools/loredeck/commands/*.mjs and lib/node-loredeck-io.mjs). Flattened into
// cli/vendor/ so relative same-dir imports keep working.
const VENDOR_MODULES = [
  'src/loredecks/loredeck-source-health.js',
  'src/loredecks/loredeck-health-engine.js',
  'src/loredecks/loredeck-health-core.js',
  'src/loredecks/context-health.js',
  'src/loredecks/tag-registry-health.js',
  'src/loredecks/schema-v3-health.js',
  'src/loredecks/loredeck-normalizer.js',
  'src/loredecks/loredeck-package-service.js',
  'src/loredecks/loredeck-package-zip.js',
  'src/lorecards/lore-matrix.js',
  'src/lorecards/lore-relevance.js',
  'src/lorecards/lore-selection.js',
];

const AUTHORING_DOCS = [
  'SAGA_LOREDECK_SCHEMA.md',
  'LOREDECK_AND_LORECARD_CREATION_GUIDE.md',
  'LOREDECK_ZIP_PACKAGE_STRUCTURE.md',
  'LLM_LOREDECK_GENERATION_GUIDE.md',
];

const REFERENCE_DECK = 'hp-core';

function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/* ---- 1. Skill folder, with path rewrites for the plugin layout ---- */
function rewriteSkillText(text) {
  return text
    // CLI invocations go through the wrapper (which defaults the workshop root)
    .replaceAll('node tools/loredeck/loredeck-cli.mjs', 'node "$CLAUDE_PLUGIN_ROOT/cli/loredeck-plugin.mjs"')
    // any remaining CLI internals
    .replaceAll('tools/loredeck/', '$CLAUDE_PLUGIN_ROOT/cli/loredeck/')
    // authoring docs and reference deck now live inside the plugin
    .replaceAll('docs/loredecks/', '$CLAUDE_PLUGIN_ROOT/docs/')
    .replaceAll('content/loredecks/hp-core', '$CLAUDE_PLUGIN_ROOT/reference-decks/hp-core')
    .replaceAll('content/loredecks/', '$CLAUDE_PLUGIN_ROOT/reference-decks/')
    // prose references to the health modules
    .replaceAll('src/loredecks/', '$CLAUDE_PLUGIN_ROOT/cli/vendor/')
    // repo-specific phrasing that has no path token to rewrite
    .replaceAll('(run from the repo root)', '(run from your working directory)')
    .replaceAll('the gitignored `workshop/` directory (override with `SAGA_WORKSHOP_ROOT`)',
      'a `loredeck-workshop/` directory in your project (override with `SAGA_WORKSHOP_ROOT`)');
}

function syncSkill() {
  const src = R('.claude', 'skills', 'loredeck-builder');
  const dest = P('skills', 'loredeck-builder');
  resetDir(dest);
  for (const file of listFiles(src)) {
    const rel = path.relative(src, file);
    const target = path.join(dest, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    if (/\.(md|json)$/.test(file)) {
      const raw = readFileSync(file, 'utf8');
      writeFileSync(target, /\.md$/.test(file) ? rewriteSkillText(raw) : raw);
    } else {
      cpSync(file, target);
    }
  }
}

/* ---- 2. CLI, with src import paths rewritten to the vendor dir ---- */
function syncCli() {
  const src = R('tools', 'loredeck');
  const dest = P('cli', 'loredeck');
  resetDir(dest);
  for (const file of listFiles(src)) {
    const rel = path.relative(src, file);
    const target = path.join(dest, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    let text = readFileSync(file, 'utf8');
    // tools/loredeck/{commands,lib}/x.mjs import ../../../src/loredecks/*.js;
    // in the plugin, cli/vendor/ is two levels up from those files.
    text = text.replaceAll('../../../src/loredecks/', '../../vendor/');
    writeFileSync(target, text);
  }
}

/* ---- 3. Vendored src closure, flattened, cross-dir import rewritten ---- */
function syncVendor() {
  const dest = P('cli', 'vendor');
  resetDir(dest);
  for (const mod of VENDOR_MODULES) {
    let text = readFileSync(R(mod), 'utf8');
    // the only cross-directory edge in the closure
    text = text.replaceAll('../lorecards/lore-matrix.js', './lore-matrix.js');
    writeFileSync(path.join(dest, path.basename(mod)), text);
  }
  // These files use ESM `import`/`export` syntax with a plain .js extension;
  // without a package.json declaring "type": "module" in an ancestor
  // directory, Node emits a MODULE_TYPELESS_PACKAGE_JSON warning (and pays a
  // detection-retry cost) on every command that loads them. The repo-side
  // source (src/loredecks/package.json, src/lorecards/package.json) covers
  // running the CLI from the repo; this covers the flattened packaged copy.
  writeFileSync(path.join(dest, 'package.json'), '{\n  "type": "module"\n}\n');
}

/* ---- 4. Authoring docs ---- */
function syncDocs() {
  const dest = P('docs');
  resetDir(dest);
  for (const doc of AUTHORING_DOCS) {
    // strip cross-links to sibling repo docs that don't travel; keep it simple:
    // copy verbatim (the four docs cross-link each other by filename, which
    // still resolves inside docs/).
    cpSync(R('docs', 'loredecks', doc), path.join(dest, doc));
  }
}

/* ---- 5. One bundled reference deck ---- */
function syncReferenceDeck() {
  const src = R('content', 'loredecks', REFERENCE_DECK);
  const dest = P('reference-decks', REFERENCE_DECK);
  resetDir(dest);
  cpSync(src, dest, { recursive: true });
}

/* ---- 6. Plugin CLI wrapper: default the workshop root into the user's project ---- */
function writeWrapper() {
  const wrapper = `#!/usr/bin/env node
/**
 * loredeck-plugin.mjs -- generated by scripts/sync-from-repo.mjs; do not edit.
 * Plugin entry point for the loredeck CLI. Defaults the workshop root to the
 * user's project so WIP canon projects land in their workspace, not the
 * plugin cache. Override with SAGA_WORKSHOP_ROOT.
 */
import path from 'node:path';
if (!process.env.SAGA_WORKSHOP_ROOT) {
  const base = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  process.env.SAGA_WORKSHOP_ROOT = path.join(base, 'loredeck-workshop');
}
await import('./loredeck/loredeck-cli.mjs');
`;
  writeFileSync(P('cli', 'loredeck-plugin.mjs'), wrapper);
}

syncSkill();
syncCli();
syncVendor();
syncDocs();
syncReferenceDeck();
writeWrapper();

const counts = {
  skill: listFiles(P('skills')).length,
  cli: listFiles(P('cli', 'loredeck')).length,
  vendor: VENDOR_MODULES.length,
  docs: AUTHORING_DOCS.length,
  referenceDeck: listFiles(P('reference-decks')).length,
};
console.log('Synced loredeck-builder plugin bundle from repo:');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v} files`);
console.log('Done. Verify with: node plugins/loredeck-builder/cli/loredeck-plugin.mjs health plugins/loredeck-builder/reference-decks/hp-core --strict');
