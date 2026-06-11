const checks = [
  './test-jjk-family-coverage.mjs',
  './test-jjk-canon-review-readiness.mjs',
  './test-jjk-spoiler-boundaries.mjs',
  './test-jjk-loredeck-health.mjs',
  './test-jjk-loredeck-v3-conformance.mjs',
  './test-jjk-reference-deck-conformance.mjs',
  './test-hp-reference-deck-conformance.mjs',
  './test-repository-layout.mjs',
];

for (const check of checks) {
  await import(new URL(check, import.meta.url));
}

console.log('JJK Loredeck validation suite passed.');
