const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const APP_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(APP_ROOT, '..', '..');
const PUBLIC_ROOT = path.resolve(APP_ROOT, 'public');
const SRC_ROOT = path.resolve(APP_ROOT, 'src');
const BLOCK_RENDERER_ROOT = path.resolve(WORKSPACE_ROOT, 'modules', 'blockRenderer');
const BLOCK_RENDERER_CORE_ROOT = path.resolve(BLOCK_RENDERER_ROOT, 'src', 'core');
const THREE_ROOT = path.resolve(BLOCK_RENDERER_ROOT, 'node_modules', 'three');
const DEFAULT_PORT = 5173;

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm'
};

function isInside(parentPath, childPath) {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath === '' ||
        (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveInside(rootPath, relativePath) {
    const resolvedPath = path.resolve(rootPath, relativePath);

    if (!isInside(rootPath, resolvedPath)) {
        throw new Error('Static path is outside of the allowed root.');
    }

    return resolvedPath;
}

function stripRoutePrefix(pathname, prefix) {
    return decodeURIComponent(pathname.slice(prefix.length));
}

function resolveStaticPath(pathname) {
    if (pathname === '/') {
        return path.resolve(PUBLIC_ROOT, 'index.html');
    }

    if (pathname.startsWith('/src/')) {
        return resolveInside(SRC_ROOT, stripRoutePrefix(pathname, '/src/'));
    }

    if (pathname.startsWith('/generated/')) {
        return resolveInside(PUBLIC_ROOT, decodeURIComponent(pathname.slice(1)));
    }

    if (pathname.startsWith('/modules/blockRenderer/src/core/')) {
        return resolveInside(
            BLOCK_RENDERER_CORE_ROOT,
            stripRoutePrefix(pathname, '/modules/blockRenderer/src/core/')
        );
    }

    if (pathname.startsWith('/vendor/three/')) {
        return resolveInside(THREE_ROOT, stripRoutePrefix(pathname, '/vendor/three/'));
    }

    return resolveInside(PUBLIC_ROOT, decodeURIComponent(pathname.slice(1)));
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { 'Content-Type': MIME_TYPES['.json'] });
    response.end(JSON.stringify(data, null, 2));
}

async function serveStatic(requestUrl, response) {
    const filePath = resolveStaticPath(requestUrl.pathname);
    const extension = path.extname(filePath);
    const contentType = MIME_TYPES[extension] ?? 'application/octet-stream';
    const content = await fs.readFile(filePath);

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content);
}

function createServer() {
    return http.createServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url, 'http://localhost');
            await serveStatic(requestUrl, response);
        } catch (error) {
            if (error.code === 'ENOENT') {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end('Not found');
                return;
            }

            if (!response.headersSent) {
                sendJson(response, 500, { error: error.message });
            } else {
                response.end();
            }
        }
    });
}

function listen(server, port) {
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            reject(error);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
    });
}

async function startServer(preferredPort = DEFAULT_PORT) {
    let lastError = null;

    for (let offset = 0; offset < 20; offset += 1) {
        const port = preferredPort + offset;
        const server = createServer();

        try {
            await listen(server, port);
            console.log(`web app server: http://127.0.0.1:${port}/`);
            return { server, port };
        } catch (error) {
            lastError = error;
            if (error.code !== 'EADDRINUSE') {
                throw error;
            }
        }
    }

    throw lastError;
}

if (require.main === module) {
    const preferredPort = Number(process.env.PORT ?? process.argv[2] ?? DEFAULT_PORT);
    startServer(preferredPort).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    createServer,
    resolveStaticPath,
    startServer
};
