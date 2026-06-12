import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolveManifestUrlForFetch } from '../../src/runtime/loredeck-manifest-runtime.js';

function normalizedPath(url) {
  return fileURLToPath(url).replace(/\\/g, '/');
}

const bundled = resolveManifestUrlForFetch('content/loredecks/hp-year-6-half-blood-prince/loredeck.json');
assert.ok(bundled, 'Bundled content/loredecks manifest path should resolve.');
assert.ok(
  normalizedPath(bundled).endsWith('/content/loredecks/hp-year-6-half-blood-prince/loredeck.json'),
  `Bundled manifest should resolve from the extension content root: ${bundled}`,
);
assert.ok(
  !normalizedPath(bundled).includes('/src/runtime/content/loredecks/'),
  `Bundled manifest must not resolve relative to src/runtime: ${bundled}`,
);

const bundledWithDotSlash = resolveManifestUrlForFetch('./content/loredecks/index.json');
assert.ok(
  normalizedPath(bundledWithDotSlash).endsWith('/content/loredecks/index.json'),
  `Dot-slash bundled manifest should resolve from the extension content root: ${bundledWithDotSlash}`,
);

const contentAsset = resolveManifestUrlForFetch('content/loredecks/index.json');
assert.ok(
  normalizedPath(contentAsset).endsWith('/content/loredecks/index.json'),
  `Extension content path should resolve from the extension root: ${contentAsset}`,
);

const relative = resolveManifestUrlForFetch('local/custom/loredeck.json');
assert.ok(
  normalizedPath(relative).endsWith('/src/runtime/local/custom/loredeck.json'),
  `Non-content relative paths keep the existing runtime-relative behavior: ${relative}`,
);

const remote = resolveManifestUrlForFetch('https://example.test/loredeck.json');
assert.equal(remote.href, 'https://example.test/loredeck.json');

console.log('loredeck manifest runtime resolver checks passed');
