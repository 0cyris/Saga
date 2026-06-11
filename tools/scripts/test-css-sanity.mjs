import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const cssPath = path.join(repoRoot, manifest.css || '');

assert(manifest.css, 'Manifest must declare a CSS file.');
assert(existsSync(cssPath), `Manifest CSS file must exist: ${manifest.css}`);

const css = readFileSync(cssPath, 'utf8');
assert(!/[<]{7}|[=]{7}|[>]{7}/.test(css), 'CSS must not contain merge conflict markers.');
assert(!/\bundefined\b|\bNaN\b/.test(css), 'CSS must not contain obvious generated invalid values.');

let depth = 0;
let inComment = false;
let quote = '';
let escaped = false;
const lineForIndex = index => css.slice(0, index).split(/\r?\n/).length;

for (let index = 0; index < css.length; index += 1) {
  const char = css[index];
  const next = css[index + 1] || '';

  if (inComment) {
    if (char === '*' && next === '/') {
      inComment = false;
      index += 1;
    }
    continue;
  }

  if (quote) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) quote = '';
    continue;
  }

  if (char === '/' && next === '*') {
    inComment = true;
    index += 1;
    continue;
  }

  if (char === '"' || char === "'") {
    quote = char;
    continue;
  }

  if (char === '{') {
    depth += 1;
    continue;
  }

  if (char === '}') {
    depth -= 1;
    assert(depth >= 0, `CSS has an unmatched closing brace near line ${lineForIndex(index)}.`);
  }
}

assert(!inComment, 'CSS has an unclosed comment.');
assert(!quote, 'CSS has an unclosed quoted string.');
assert.equal(depth, 0, 'CSS braces must be balanced.');

console.log('CSS sanity contract passed.');
