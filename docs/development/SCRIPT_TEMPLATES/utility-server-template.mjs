/**
 * Utility server template for serving test harnesses and development tools.
 *
 * This template demonstrates:
 * - Creating a lightweight HTTP server
 * - Serving static files with correct MIME types
 * - Safe path resolution to prevent directory traversal
 * - Command-line argument parsing (host, port)
 * - Graceful shutdown handling
 *
 * Usage:
 *   node tools/scripts/serve-example.mjs                    # Default: localhost:3456
 *   node tools/scripts/serve-example.mjs --port 8000        # Custom port
 *   node tools/scripts/serve-example.mjs --host 0.0.0.0    # Listen on all interfaces
 *
 * See: docs/development/SCRIPTS_GUIDE.md for utility server patterns
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Configuration
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = process.cwd();
const serveDir = path.join(root, 'tools/example-harness'); // Directory to serve from

// Parse command-line arguments
let host = 'localhost';
let port = 3456;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--host' && process.argv[i + 1]) {
    host = process.argv[i + 1];
    i += 1;
  }
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    port = parseInt(process.argv[i + 1], 10);
    i += 1;
  }
}

// ============================================================================
// MIME Type Mapping
// ============================================================================

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ============================================================================
// Request Handler
// ============================================================================

function handleRequest(req, res) {
  // Normalize URL path
  let urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Resolve file path safely
  const filePath = path.normalize(path.join(serveDir, urlPath));

  // Prevent directory traversal attacks
  const realPath = path.resolve(filePath);
  const realServeDir = path.resolve(serveDir);

  if (!realPath.startsWith(realServeDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: Path traversal detected');
    console.log(`[403] ${req.method} ${req.url} - Forbidden (traversal attempt)`);
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>404 Not Found</h1><p>${req.url}</p>`);
    console.log(`[404] ${req.method} ${req.url}`);
    return;
  }

  // Check if it's a directory
  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    // Try to serve index.html from directory
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveFile(indexPath, res, req.url);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>Directory listing disabled: ${req.url}</p>`);
      console.log(`[404] ${req.method} ${req.url} - No index.html`);
    }
    return;
  }

  // Serve the file
  serveFile(filePath, res, req.url);
}

function serveFile(filePath, res, urlPath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const mimeType = getMimeType(filePath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': Buffer.byteLength(content),
    });
    res.end(content);
    console.log(`[200] GET ${urlPath}`);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Internal Server Error: ${error.message}`);
    console.error(`[500] GET ${urlPath} - ${error.message}`);
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const server = http.createServer(handleRequest);

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Error: Port ${port} is already in use`);
    console.error(`Try: node ${path.basename(__filename)} --port ${port + 1}`);
  } else {
    console.error(`Server error: ${error.message}`);
  }
  process.exit(1);
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 5 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 5000);
});

// ============================================================================
// Start Server
// ============================================================================

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`\nServing from: ${serveDir}`);
  console.log(`Server running at ${url}`);
  console.log(`Press Ctrl+C to stop\n`);
});
