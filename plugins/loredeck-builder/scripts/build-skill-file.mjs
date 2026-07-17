#!/usr/bin/env node
/**
 * build-skill-file.mjs -- Saga loredeck-builder plugin
 *
 * Packages the skill as a standalone, self-contained `.skill` file — a zip of
 * the skill directory with everything it needs bundled inside it (the CLI, the
 * vendored Pack Health engine, the authoring docs, and one reference deck).
 * Inside a bare skill, resources are referenced via ${CLAUDE_SKILL_DIR}, so
 * the build rewrites the plugin's $CLAUDE_PLUGIN_ROOT references accordingly.
 *
 * Source of truth is the synced plugin bundle (run sync-from-repo.mjs first).
 * Output: plugins/loredeck-builder/dist/loredeck-builder.skill (gitignored).
 *
 * Usage: node plugins/loredeck-builder/scripts/build-skill-file.mjs
 */

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SKILL_NAME = 'loredeck-builder';
const distDir = path.join(PLUGIN_ROOT, 'dist');
const buildDir = path.join(distDir, 'build');
const skillDir = path.join(buildDir, SKILL_NAME);
const outFile = path.join(distDir, `${SKILL_NAME}.skill`);

function listFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

// In a bundled skill, the CLI/docs/reference-decks sit inside the skill dir and
// are addressed with ${CLAUDE_SKILL_DIR}. The plugin bundle already uses the
// same subpaths under $CLAUDE_PLUGIN_ROOT, so only the variable name changes.
function toSkillDirVar(text) {
  return text.replaceAll('$CLAUDE_PLUGIN_ROOT', '${CLAUDE_SKILL_DIR}');
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(skillDir, { recursive: true });

// 1. Skill files (SKILL.md + references + templates), with the path-var swap.
const srcSkill = path.join(PLUGIN_ROOT, 'skills', SKILL_NAME);
for (const file of listFiles(srcSkill)) {
  const rel = path.relative(srcSkill, file);
  const target = path.join(skillDir, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  if (/\.md$/.test(file)) writeFileSync(target, toSkillDirVar(readFileSync(file, 'utf8')));
  else cpSync(file, target);
}

// 2. Bundle the CLI, vendored engine, docs, and reference deck inside the skill.
for (const dir of ['cli', 'docs', 'reference-decks']) {
  cpSync(path.join(PLUGIN_ROOT, dir), path.join(skillDir, dir), { recursive: true });
}

// 3. Zip the skill directory (top-level `loredeck-builder/`) into the .skill.
rmSync(outFile, { force: true });
const zip = spawnSync('zip', ['-r', '-q', outFile, SKILL_NAME], { cwd: buildDir, encoding: 'utf8' });
if (zip.status !== 0) {
  // fallback: python3 zipfile
  const py = spawnSync('python3', ['-m', 'zipfile', '-c', outFile, SKILL_NAME], { cwd: buildDir, encoding: 'utf8' });
  if (py.status !== 0) {
    throw new Error(`Failed to create .skill archive (zip and python3 both failed): ${zip.stderr}${py.stderr}`);
  }
}

const bundledFileCount = listFiles(skillDir).length;
rmSync(buildDir, { recursive: true, force: true });
console.log(`Built ${path.relative(path.resolve(PLUGIN_ROOT, '..', '..'), outFile)} (${bundledFileCount} bundled files)`);
console.log('Install: unzip into ~/.claude/skills/ (or a project .claude/skills/), then invoke /loredeck-builder.');
