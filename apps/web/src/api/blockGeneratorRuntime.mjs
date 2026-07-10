let modulePromise = null;

function rememberGlobalProperty(name) {
    return {
        name,
        descriptor: Object.getOwnPropertyDescriptor(globalThis, name)
    };
}

function restoreGlobalProperty(property) {
    if (property.descriptor) {
        Object.defineProperty(globalThis, property.name, property.descriptor);
        return;
    }

    delete globalThis[property.name];
}

function defineGlobalProperty(name, value) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value
    });
}

function applyWebOnlyEmscriptenWorkerShim() {
    if (!globalThis.WorkerGlobalScope) {
        return () => {};
    }

    const properties = [
        rememberGlobalProperty('window'),
        rememberGlobalProperty('WorkerGlobalScope')
    ];

    try {
        // blockGenerator is intentionally built as web-only today. The worker
        // still has the web APIs it uses, so hide worker detection during setup.
        defineGlobalProperty('window', globalThis);
        defineGlobalProperty('WorkerGlobalScope', undefined);
    } catch (error) {
        for (const property of properties.slice().reverse()) {
            restoreGlobalProperty(property);
        }

        return () => {};
    }

    return () => {
        for (const property of properties.slice().reverse()) {
            restoreGlobalProperty(property);
        }
    };
}

async function createGeneratorModule() {
    let moduleFactory;
    const restoreEnvironment = applyWebOnlyEmscriptenWorkerShim();

    try {
        const moduleUrl = new URL('../../generated/blockGenerator.js', import.meta.url);
        moduleFactory = (await import(moduleUrl.href)).default;
    } catch (error) {
        restoreEnvironment();
        throw new Error(
            'Cannot load blockGenerator WebAssembly. Run mingw32-make wasm in modules/blockGenerator.'
        );
    }

    try {
        return await moduleFactory({
            locateFile(path) {
                return new URL(`../../generated/${path}`, import.meta.url).href;
            }
        });
    } finally {
        restoreEnvironment();
    }
}

export async function loadGeneratorModule() {
    if (modulePromise === null) {
        modulePromise = createGeneratorModule();
    }

    return modulePromise;
}

export async function runBlockGenerator(generatorOptions) {
    const module = await loadGeneratorModule();
    const generate = module.cwrap('generate_blocks_json', 'number', ['string']);
    const freeGeneratedString = module.cwrap('free_generated_string', null, ['number']);
    const pointer = generate(JSON.stringify(generatorOptions));

    if (!pointer) {
        throw new Error('blockGenerator did not return a result string.');
    }

    try {
        const resultText = module.UTF8ToString(pointer);
        const result = JSON.parse(resultText);

        if (!result.success) {
            throw new Error(result.error ?? 'blockGenerator failed.');
        }

        return result.block_json;
    } finally {
        freeGeneratedString(pointer);
    }
}
