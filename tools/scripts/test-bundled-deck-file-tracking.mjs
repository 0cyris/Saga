import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const targets = [];
for (const deck of readdirSync(path.join(root, 'content', 'loredecks'), { withFileTypes: true })) {
    if (!deck.isDirectory()) continue;
    const manifestPath = path.join(root, 'content', 'loredecks', deck.name, 'loredeck.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const file of manifest.files || []) {
        const target = `content/loredecks/${deck.name}/${file}`;
        assert.equal(existsSync(path.join(root, target)), true, `Manifest-declared file is missing: ${target}`);
        targets.push(target);
    }
}
const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: root, input: targets.join('\n') + '\n', encoding: 'utf8', windowsHide: true,
});
if (result.error) throw result.error;
assert.ok(result.status === 0 || result.status === 1, result.stderr);
assert.equal(result.stdout.trim(), '', 'Manifest-declared Lorecards must be eligible for Git tracking.');
const privatePaths = ['secrets/local.json', 'content/loredecks/star-trek-tng-season-1/secrets/api-keys-local.json', 'content/loredecks/star-trek-tng-season-1/secrets/private.json'];
const privateResult = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: root, input: privatePaths.join('\n') + '\n', encoding: 'utf8', windowsHide: true,
});
if (privateResult.error) throw privateResult.error;
assert.equal(privateResult.status, 0);
assert.equal(privateResult.stdout.trim().split(/\r?\n/).length, privatePaths.length, 'Private credential paths stay ignored.');
console.log(`Bundled file tracking passed (${targets.length} declared files).`);
