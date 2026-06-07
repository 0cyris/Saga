import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function readArg(name, fallback) {
    const prefixed = `--${name}=`;
    const inline = args.find(arg => arg.startsWith(prefixed));
    if (inline) return inline.slice(prefixed.length);
    const index = args.indexOf(`--${name}`);
    if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
    return fallback;
}

const host = readArg('host', '127.0.0.1');
const port = Number(readArg('port', '8765'));
const checkOnly = args.includes('--check');

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.ico', 'image/x-icon'],
]);

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'content-type': contentType,
        'cache-control': 'no-store',
    });
    res.end(body);
}

function resolveRequestPath(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
    const relative = decoded === '/' ? 'tests/visual-smoke.html' : decoded.replace(/^\/+/, '');
    const fullPath = path.resolve(root, relative);
    if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) return null;
    return fullPath;
}

const server = http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || '')) {
        send(res, 405, 'Method not allowed');
        return;
    }

    const filePath = resolveRequestPath(req.url || '/');
    if (!filePath) {
        send(res, 403, 'Forbidden');
        return;
    }

    try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) {
            send(res, 404, 'Not found');
            return;
        }
        const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
        if (req.method === 'HEAD') {
            res.writeHead(200, {
                'content-type': contentType,
                'cache-control': 'no-store',
            });
            res.end();
            return;
        }
        const body = await fs.readFile(filePath);
        send(res, 200, body, contentType);
    } catch (error) {
        if (error?.code === 'ENOENT') send(res, 404, 'Not found');
        else send(res, 500, error?.message || 'Server error');
    }
});

server.on('error', error => {
    console.error(`Visual smoke server failed: ${error.message}`);
    process.exitCode = 1;
});

server.listen(Number.isFinite(port) ? port : 8765, host, async () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    const url = `http://${host}:${actualPort}/tests/visual-smoke.html`;
    if (!checkOnly) {
        console.log(`Saga visual smoke harness: ${url}`);
        console.log('Press Ctrl+C to stop.');
        return;
    }

    try {
        const responses = await Promise.all([
            fetch(url),
            fetch(`http://${host}:${actualPort}/tests/visual-smoke.html?tab=context&review=context-proposals`),
            fetch(`http://${host}:${actualPort}/tests/fixtures/arlong-park-update.saga-loredeck.json`),
        ]);
        for (const response of responses) {
            if (!response.ok) throw new Error(`${response.url} returned HTTP ${response.status}`);
        }
        const html = await responses[0].text();
        const contextHtml = await responses[1].text();
        const fixture = await responses[2].json();
        if (!html.includes('Saga Visual Smoke Harness')) throw new Error('Harness HTML did not load expected title.');
        if (!contextHtml.includes('Saga Visual Smoke Harness')) throw new Error('Context harness HTML did not load expected title.');
        if (fixture?.pack?.packId !== 'smoke-arlong-park') throw new Error('Fixture JSON did not load expected pack.');
        console.log('Visual smoke server check passed.');
    } catch (error) {
        console.error(error?.message || 'Visual smoke server check failed.');
        process.exitCode = 1;
    } finally {
        server.close();
    }
});
