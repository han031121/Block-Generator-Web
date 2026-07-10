import {
    loadGeneratorModule,
    runBlockGenerator
} from './blockGeneratorRuntime.mjs';

let isReady = false;

function serializeError(error) {
    return {
        name: error?.name ?? 'Error',
        message: error?.message ?? 'Unknown blockGenerator error.'
    };
}

async function initializeGenerator() {
    try {
        await loadGeneratorModule();
        isReady = true;
        self.postMessage({ type: 'ready' });
    } catch (error) {
        self.postMessage({
            type: 'load-error',
            error: serializeError(error)
        });
    }
}

self.addEventListener('message', async (event) => {
    const message = event.data;

    if (message?.type !== 'generate') {
        return;
    }

    const { requestId, generatorOptions } = message;

    if (!isReady) {
        self.postMessage({
            type: 'error',
            requestId,
            error: {
                name: 'Error',
                message: 'blockGenerator WebAssembly is not ready.'
            }
        });
        return;
    }

    self.postMessage({ type: 'started', requestId });

    try {
        const blockJson = await runBlockGenerator(generatorOptions);
        self.postMessage({
            type: 'success',
            requestId,
            blockJson
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId,
            error: serializeError(error)
        });
    }
});

initializeGenerator();
