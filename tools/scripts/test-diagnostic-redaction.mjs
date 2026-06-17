import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  redactDiagnosticText,
  redactDiagnosticValue,
  stringifyRedactedDiagnostic,
} from '../../src/runtime/runtime-redaction.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const openAiStyleKey = ['sk', '1234567890abcdefghijklmnopqrstuvwxyz'].join('-');
const nestedOpenAiStyleKey = ['sk', 'nested1234567890abcdef'].join('-');
const anotherOpenAiStyleKey = ['sk', 'another1234567890abcdef'].join('-');
const bearerValue = ['Bearer', 'abcdefghijklmnopqrstuvwxyz123456'].join(' ');
const nestedBearerValue = ['Bearer', 'nested-secret-value'].join(' ');
const nestedHeaderBearerValue = ['Bearer', 'nested-header-secret-value'].join(' ');

const source = {
  category: 'secret',
  loreFact: 'A story secret should stay readable.',
  apiKey: openAiStyleKey,
  Authorization: bearerValue,
  providerHeaders: {
    Authorization: nestedBearerValue,
    'x-api-key': nestedOpenAiStyleKey,
  },
  nested: {
    headers: {
      Authorization: nestedHeaderBearerValue,
    },
    endpoint: 'https://user:pass@example.test/v1/chat?api_key=abc123&model=saga',
    note: `OpenAI key ${anotherOpenAiStyleKey} should be hidden.`,
    client_secret: 'client-secret-value',
  },
  continuityOpenAIKeyEncrypted: 'ciphertext',
};

const redacted = redactDiagnosticValue(source);

assert.equal(redacted.category, 'secret', 'Lore category values must not be redacted by name alone.');
assert.equal(redacted.loreFact, 'A story secret should stay readable.', 'Non-credential lore text must remain readable.');
assert.equal(redacted.apiKey, '<redacted>', 'API key fields must be redacted.');
assert.equal(redacted.Authorization, '<redacted>', 'Authorization fields must be redacted.');
assert.equal(redacted.providerHeaders, '<redacted>', 'Provider header objects must be redacted.');
assert.equal(redacted.nested.headers.Authorization, '<redacted>', 'Nested Authorization headers must be redacted.');
assert.equal(redacted.nested.client_secret, '<redacted>', 'Client secret fields must be redacted.');
assert.equal(redacted.continuityOpenAIKeyEncrypted, '<redacted>', 'Stored provider key material must be redacted.');
assert.equal(redacted.nested.endpoint, 'https://<redacted>@example.test/v1/chat?api_key=<redacted>&model=saga', 'URL userinfo and secret query params must be redacted.');
assert(!stringifyRedactedDiagnostic(source).includes('sk-'), 'Stringified diagnostics must not include OpenAI-style key material.');
assert(!redactDiagnosticText(`Authorization: ${bearerValue}`).includes('abcdefghijklmnopqrstuvwxyz'), 'Plain diagnostic text redaction must hide bearer values.');

const healthPanel = await readFile(path.join(repoRoot, 'src/loredecks/loredeck-health-panel.js'), 'utf8');
const liveSmoke = await readFile(path.join(repoRoot, 'tools/scripts/smoke-live-st-cdp.mjs'), 'utf8');
const lorePanel = await readFile(path.join(repoRoot, 'src/runtime/lore-panel.js'), 'utf8');
const creatorGenerationDiagnostics = await readFile(path.join(repoRoot, 'src/loredecks/loredeck-creator-generation-diagnostics.js'), 'utf8');

assert(healthPanel.includes('stringifyRedactedDiagnostic(context.report)'), 'Pack Health Copy Diagnostics must redact report JSON.');
assert(healthPanel.includes('downloadJson(redactDiagnosticValue(context.report)'), 'Pack Health Export Report must redact report JSON.');
assert(liveSmoke.includes('redactDiagnosticValue(payload)') && liveSmoke.includes('redactDiagnosticText(raw)'), 'Live smoke debug-frame logs must redact CDP payloads.');
assert(lorePanel.includes('buildLoredeckCreatorGenerationFailureDiagnostic(payload, unitConfig, requestOptions, { redactDiagnostic: redactDiagnosticValue })'), 'Deck Maker runtime must inject the diagnostic redactor before persistence.');
assert(creatorGenerationDiagnostics.includes('redactDiagnostic(diagnostic)'), 'Deck Maker diagnostics must apply the injected redactor before returning diagnostics.');

console.log('Diagnostic redaction contract passed.');
