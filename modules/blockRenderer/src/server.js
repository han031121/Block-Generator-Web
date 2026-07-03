const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const {
    DEFAULT_BLOCK_JSON_PATH,
    loadBlockByIndex,
    parseBlockIndex
} = require('./adapters/blockJson');

const MODULE_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(MODULE_ROOT, '..', '..');
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

function resolveStaticPath(pathname) {
    const cleanPathname = pathname === '/' ? '/index.html' : pathname;
    const decodedPath = decodeURIComponent(cleanPathname);
    const resolvedPath = path.resolve(MODULE_ROOT, `.${decodedPath}`);

    if (!isInside(MODULE_ROOT, resolvedPath)) {
        throw new Error('Static path is outside of the module root.');
    }

    return resolvedPath;
}

function resolveBlockJsonPath(fileParam) {
    if (!fileParam) {
        return DEFAULT_BLOCK_JSON_PATH;
    }

    const resolvedPath = path.isAbsolute(fileParam)
        ? path.resolve(fileParam)
        : path.resolve(MODULE_ROOT, fileParam);

    if (!isInside(WORKSPACE_ROOT, resolvedPath)) {
        throw new Error('Block JSON path is outside of the workspace.');
    }

    return resolvedPath;
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { 'Content-Type': MIME_TYPES['.json'] });
    response.end(JSON.stringify(data, null, 2));
}

async function handleBlockApi(requestUrl, response) {
    const index = parseBlockIndex(requestUrl.searchParams.get('index') ?? '0');
    const blockJsonPath = resolveBlockJsonPath(requestUrl.searchParams.get('file'));
    const result = await loadBlockByIndex(blockJsonPath, index);

    sendJson(response, 200, result);
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

            if (requestUrl.pathname === '/api/block') {
                await handleBlockApi(requestUrl, response);
                return;
            }

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
            console.log(`blockRenderer server: http://127.0.0.1:${port}/`);
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
    resolveBlockJsonPath,
    resolveStaticPath,
    startServer
};
