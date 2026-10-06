import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fingerprintGenerationInput } from '../../src/generation/generation-input-identity.js';
import { fingerprintLoredeckCreatorGenerationInput } from '../../src/loredecks/loredeck-creator-generation-commit.js';

test('portable input fingerprints retain SHA-256 parity including multiblock UTF-8 inputs', () => {
    for (const input of [{}, { a: '中文', b: [1, 2] }, { content: 'x'.repeat(5000) }]) {
        assert.equal(fingerprintGenerationInput(input), createHash('sha256').update(JSON.stringify(input)).digest('hex'));
    }
    assert.equal(fingerprintGenerationInput({ z: { b: 2, a: 1 }, a: 1 }), fingerprintGenerationInput({ a: 1, z: { a: 1, b: 2 } }));
    assert.notEqual(fingerprintGenerationInput({ input: 'before' }), fingerprintGenerationInput({ input: 'after' }));
});

test('Deck input receipts work on HTTP/LAN hosts without WebCrypto', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const expected = await fingerprintLoredeckCreatorGenerationInput({ fixture: 'same stable input' });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    try { assert.equal(await fingerprintLoredeckCreatorGenerationInput({ fixture: 'same stable input' }), expected); }
    finally { if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); else delete globalThis.crypto; }
});
