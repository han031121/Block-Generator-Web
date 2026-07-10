export const GENERATION_TIMEOUT_MS = 5000;

export class BlockGenerationTimeoutError extends Error {
    constructor(timeoutMs) {
        super(`Block generation timed out after ${formatSeconds(timeoutMs)}.`);
        this.name = 'BlockGenerationTimeoutError';
        this.timeoutMs = timeoutMs;
    }
}

function formatSeconds(milliseconds) {
    return `${milliseconds / 1000} seconds`;
}

function deserializeWorkerError(errorData) {
    const error = new Error(errorData?.message ?? 'Unknown blockGenerator error.');
    error.name = errorData?.name ?? 'Error';
    return error;
}

function isMatchingRequest(message, requestId) {
    return message?.requestId === requestId;
}

function createRequestId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()}`;
}

function resolveTimeoutMs(timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new Error('Generation timeout must be a non-negative finite number.');
    }

    return timeoutMs;
}

export function isBlockGenerationTimeoutError(error) {
    return error instanceof BlockGenerationTimeoutError ||
        error?.name === 'BlockGenerationTimeoutError';
}

export async function generateBlockJson(generatorOptions, options = {}) {
    const timeoutMs = resolveTimeoutMs(
        options.timeoutMs ?? GENERATION_TIMEOUT_MS
    );
    const requestId = createRequestId();
    const worker = new Worker(
        new URL('./blockGeneratorWorker.mjs', import.meta.url),
        { type: 'module' }
    );

    return new Promise((resolve, reject) => {
        let generationTimer = null;
        let hasSettled = false;

        const cleanup = () => {
            if (generationTimer !== null) {
                clearTimeout(generationTimer);
            }

            worker.terminate();
        };

        const settle = (callback, value) => {
            if (hasSettled) {
                return;
            }

            hasSettled = true;
            cleanup();
            callback(value);
        };

        const startGenerationTimer = () => {
            if (generationTimer !== null) {
                return;
            }

            if (timeoutMs === 0) {
                settle(reject, new BlockGenerationTimeoutError(timeoutMs));
                return;
            }

            generationTimer = setTimeout(() => {
                settle(reject, new BlockGenerationTimeoutError(timeoutMs));
            }, timeoutMs);
        };

        worker.addEventListener('message', (event) => {
            const message = event.data;

            if (message?.type === 'ready') {
                worker.postMessage({
                    type: 'generate',
                    requestId,
                    generatorOptions
                });
                return;
            }

            if (message?.type === 'load-error') {
                settle(reject, deserializeWorkerError(message.error));
                return;
            }

            if (!isMatchingRequest(message, requestId)) {
                return;
            }

            if (message.type === 'started') {
                startGenerationTimer();
                return;
            }

            if (message.type === 'success') {
                settle(resolve, message.blockJson);
                return;
            }

            if (message.type === 'error') {
                settle(reject, deserializeWorkerError(message.error));
            }
        });

        worker.addEventListener('error', (event) => {
            settle(reject, new Error(event.message || 'blockGenerator worker failed.'));
        });

        worker.addEventListener('messageerror', () => {
            settle(reject, new Error('blockGenerator worker sent an unreadable message.'));
        });
    });
}
