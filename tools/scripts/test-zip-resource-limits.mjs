import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { createStoredZipArchive, readZipArchive } from '../../src/loredecks/loredeck-package-zip.js';

async function forgedDeflate(content, declaredSize) {
    const stored = await createStoredZipArchive([{ path: 'fixture.json', data: content }]);
    const end = stored.length - 22;
    const centralOffset = new DataView(stored.buffer).getUint32(end + 16, true);
    const header = stored.slice(0, 30 + new DataView(stored.buffer).getUint16(26, true));
    const compressed = deflateRawSync(content);
    const central = stored.slice(centralOffset, end);
    const eocd = stored.slice(end);
    const localView = new DataView(header.buffer); const centralView = new DataView(central.buffer);
    localView.setUint16(8, 8, true); localView.setUint32(18, compressed.length, true); localView.setUint32(22, declaredSize, true);
    centralView.setUint16(10, 8, true); centralView.setUint32(20, compressed.length, true); centralView.setUint32(24, declaredSize, true);
    new DataView(eocd.buffer).setUint32(16, header.length + compressed.length, true);
    const result = new Uint8Array(header.length + compressed.length + central.length + eocd.length);
    let offset = 0;
    for (const chunk of [header, compressed, central, eocd]) { result.set(chunk, offset); offset += chunk.length; }
    return result;
}

await test('forged expansion stops before collecting the complete output', async () => {
    const content = new Uint8Array(65536).fill(65);
    const input = await forgedDeflate(content, 1);
    const native = globalThis.DecompressionStream;
    let produced = 0;
    globalThis.DecompressionStream = class {
        constructor(format) {
            const stream = new native(format);
            return { writable: stream.writable, readable: stream.readable.pipeThrough(new TransformStream({
                transform(chunk, controller) { produced += chunk.byteLength; controller.enqueue(chunk); },
            })) };
        }
    };
    try {
        const archive = await readZipArchive(input, { limits: { maxSingleFileBytes: 16, maxUncompressedBytes: 16 } });
        await assert.rejects(archive.readFileBytes('fixture.json'), /limit|too large/i);
        assert.ok(produced < content.length, `must stop streaming early; collected ${produced} bytes`);
    } finally { globalThis.DecompressionStream = native; }
});

await test('known input size is checked before materializing a File', async () => {
    let materialized = false;
    const file = { size: 1000, async arrayBuffer() { materialized = true; return new ArrayBuffer(0); } };
    await assert.rejects(readZipArchive(file, { limits: { maxCompressedBytes: 16 } }), /too large/i);
    assert.equal(materialized, false);
});

await test('truncated central headers are reported as invalid archive data', async () => {
    const bytes = await createStoredZipArchive([{ path: 'fixture.json', data: '{}' }]);
    new DataView(bytes.buffer).setUint32(bytes.length - 22 + 16, bytes.length - 2, true);
    new DataView(bytes.buffer).setUint32(bytes.length - 22 + 12, 2, true);
    await assert.rejects(readZipArchive(bytes), error => !(error instanceof RangeError) && /central directory|truncated/i.test(error.message));
});

await test('aggregate budget and genuine deflate round trips stay bounded', async () => {
    const stored = await createStoredZipArchive([{ path: 'one.json', data: '12345' }, { path: 'two.json', data: '12345' }]);
    await assert.rejects(readZipArchive(stored, { limits: { maxUncompressedBytes: 9 } }), /limit/i);
    const content = new TextEncoder().encode('{"safe":true}');
    const archive = await readZipArchive(await forgedDeflate(content, content.length), { limits: { maxUncompressedBytes: 32, maxSingleFileBytes: 32 } });
    assert.deepEqual(await archive.readJson('fixture.json'), { safe: true });
});
