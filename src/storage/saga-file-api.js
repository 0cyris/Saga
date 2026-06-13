/**
 * Saga wrapper for SillyTavern's built-in user files API.
 */

import {
    assertSagaStorageFileName,
    assertSagaUserFilesPath,
    SAGA_STORAGE_JSON_EXTENSION,
} from './saga-storage-filenames.js';

const JSON_CONTENT_TYPE = 'application/json';

function getDefaultFetch() {
    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch is not available for Saga file storage.');
    }
    return fetchImpl.bind(globalThis);
}

function getDefaultRequestHeaders() {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (typeof ctx?.getRequestHeaders === 'function') return ctx.getRequestHeaders();
    return { 'Content-Type': JSON_CONTENT_TYPE };
}

function mergeJsonHeaders(headers = {}) {
    return {
        ...headers,
        'Content-Type': headers['Content-Type'] || headers['content-type'] || JSON_CONTENT_TYPE,
    };
}

function utf8ToBase64(text = '') {
    const value = String(text || '');
    if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return globalThis.btoa(binary);
}

function base64ToUtf8(base64 = '') {
    const value = String(base64 || '');
    if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('utf8');
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
}

async function parseResponse(response) {
    const text = typeof response?.text === 'function' ? await response.text() : '';
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function requireOk(response, fallbackMessage) {
    if (response?.ok) return response;
    const body = await parseResponse(response);
    const message = typeof body === 'string'
        ? body
        : (body?.error || body?.message || fallbackMessage || 'Saga file storage request failed.');
    const error = new Error(String(message || fallbackMessage || 'Saga file storage request failed.'));
    error.status = Number(response?.status) || 0;
    error.body = body;
    throw error;
}

function normalizeVerifyResult(value = {}) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function createSagaFileApi(options = {}) {
    const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : getDefaultFetch();
    const getRequestHeaders = typeof options.getRequestHeaders === 'function'
        ? options.getRequestHeaders
        : getDefaultRequestHeaders;
    const baseUrl = String(options.baseUrl || '').replace(/\/+$/g, '');

    const url = path => `${baseUrl}${path}`;
    const headers = () => mergeJsonHeaders(getRequestHeaders() || {});

    async function postJson(path, body, fallbackMessage) {
        const response = await fetchImpl(url(path), {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify(body || {}),
        });
        await requireOk(response, fallbackMessage);
        return parseResponse(response);
    }

    async function uploadBase64File(fileName = '', base64Data = '', options = {}) {
        const name = assertSagaStorageFileName(fileName, {
            allowedExtensions: options.allowedExtensions,
        });
        const data = String(base64Data || '').trim();
        if (!data) throw new Error('Saga file upload data is required.');
        const result = await postJson('/api/files/upload', { name, data }, 'Saga file upload failed.');
        const path = assertSagaUserFilesPath(result?.path || '', {
            allowedExtensions: options.allowedExtensions,
        });
        return { path, fileName: name };
    }

    async function writeTextFile(fileName = '', text = '', options = {}) {
        return uploadBase64File(fileName, utf8ToBase64(text), options);
    }

    async function writeJsonFile(fileName = '', value = {}, options = {}) {
        const space = options.pretty === false ? 0 : 2;
        const text = `${JSON.stringify(value ?? null, null, space)}\n`;
        return writeTextFile(fileName, text, {
            ...options,
            allowedExtensions: options.allowedExtensions || [SAGA_STORAGE_JSON_EXTENSION],
        });
    }

    async function readTextFile(path = '', options = {}) {
        const safePath = assertSagaUserFilesPath(path, options);
        const response = await fetchImpl(url(safePath), {
            method: 'GET',
            headers: getRequestHeaders() || {},
        });
        await requireOk(response, 'Saga file read failed.');
        return typeof response.text === 'function' ? response.text() : '';
    }

    async function readJsonFile(path = '', options = {}) {
        const text = await readTextFile(path, {
            ...options,
            allowedExtensions: options.allowedExtensions || [SAGA_STORAGE_JSON_EXTENSION],
        });
        try {
            return JSON.parse(text);
        } catch (error) {
            const wrapped = new Error(`Saga JSON file could not be parsed: ${error?.message || error}`);
            wrapped.cause = error;
            throw wrapped;
        }
    }

    async function verifyFiles(paths = [], options = {}) {
        const safePaths = [...new Set((Array.isArray(paths) ? paths : [])
            .map(path => assertSagaUserFilesPath(path, options)))];
        if (!safePaths.length) return {};
        const result = await postJson('/api/files/verify', { urls: safePaths }, 'Saga file verification failed.');
        return normalizeVerifyResult(result);
    }

    async function deleteFile(path = '', options = {}) {
        const safePath = assertSagaUserFilesPath(path, options);
        await postJson('/api/files/delete', { path: safePath }, 'Saga file deletion failed.');
        return { ok: true, path: safePath };
    }

    return {
        uploadBase64File,
        writeTextFile,
        writeJsonFile,
        readTextFile,
        readJsonFile,
        verifyFiles,
        deleteFile,
    };
}

export const __sagaFileApiTestHooks = {
    utf8ToBase64,
    base64ToUtf8,
    parseResponse,
};

