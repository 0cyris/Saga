/**
 * deck-fs.mjs -- Saga loredeck CLI
 * Filesystem helpers, id rules, and workshop path resolution shared by the
 * loredeck CLI commands. Dependency-free Node built-ins only.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

export function getWorkshopRoot() {
    const override = String(process.env.SAGA_WORKSHOP_ROOT || '').trim();
    if (override) return path.resolve(override);
    return path.join(REPO_ROOT, 'workshop');
}

export function isValidSlug(value) {
    return /^[a-z0-9][a-z0-9-]*$/.test(String(value || ''));
}

export function resolveProjectDir(projectId) {
    if (!isValidSlug(projectId)) {
        throw new Error(`Invalid project id: ${JSON.stringify(projectId)}. Use lowercase letters, digits, and hyphens.`);
    }
    return path.join(getWorkshopRoot(), projectId);
}

export async function pathExists(target) {
    try {
        await stat(target);
        return true;
    } catch (_) {
        return false;
    }
}

export async function ensureDir(target) {
    await mkdir(target, { recursive: true });
}

export async function readJsonFile(filePath) {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

export async function readJsonFileOrNull(filePath) {
    try {
        return await readJsonFile(filePath);
    } catch (_) {
        return null;
    }
}

export async function writeJsonFile(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function writeTextFile(filePath, text) {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

export async function listJsonFilesRecursive(rootDir) {
    const output = [];
    if (!(await pathExists(rootDir))) return output;
    const walk = async (dir) => {
        const items = await readdir(dir, { withFileTypes: true });
        for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                await walk(fullPath);
            } else if (item.isFile() && item.name.endsWith('.json')) {
                output.push(fullPath);
            }
        }
    };
    await walk(rootDir);
    return output;
}

export function toPosixRelative(fromDir, filePath) {
    return path.relative(fromDir, filePath).split(path.sep).join('/');
}

export function nowIso() {
    return new Date().toISOString();
}
