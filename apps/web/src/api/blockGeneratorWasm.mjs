let modulePromise = null;

async function createGeneratorModule() {
    let moduleFactory;

    try {
        const moduleUrl = new URL('../../generated/blockGenerator.js', import.meta.url);
        moduleFactory = (await import(moduleUrl.href)).default;
    } catch (error) {
        throw new Error(
            'Cannot load blockGenerator WebAssembly. Run mingw32-make wasm in modules/blockGenerator.'
        );
    }

    return moduleFactory({
        locateFile(path) {
            return new URL(`../../generated/${path}`, import.meta.url).href;
        }
    });
}

async function getGeneratorModule() {
    if (modulePromise === null) {
        modulePromise = createGeneratorModule();
    }

    return modulePromise;
}

export async function generateBlockJson(generatorOptions) {
    const module = await getGeneratorModule();
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
