const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const {
    DEFAULT_BLOCK_JSON_PATH,
    loadBlockByIndex,
    parseBlockIndex
} = require('./adapters/blockJson');

function isIndexLike(value) {
    return /^\d+$/.test(String(value ?? '').trim());
}

function parseArgs(argv) {
    if (argv.length === 0) {
        return {
            blockJsonPath: DEFAULT_BLOCK_JSON_PATH,
            blockIndexText: null
        };
    }

    if (argv.length === 1 && isIndexLike(argv[0])) {
        return {
            blockJsonPath: DEFAULT_BLOCK_JSON_PATH,
            blockIndexText: argv[0]
        };
    }

    return {
        blockJsonPath: argv[0],
        blockIndexText: argv[1] ?? null
    };
}

async function promptBlockIndex() {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
        return await rl.question('Block index: ');
    } finally {
        rl.close();
    }
}

function printSelectedBlock(sourcePath, block) {
    console.log(`Loaded block json: ${sourcePath}`);
    console.log(`Selected array index: ${block.position}`);
    console.log(`Block index: ${block.index}`);
    console.log(`Generated: ${block.generated}`);
    console.log(`Identify: ${block.identify ?? 'null'}`);
    console.log(`Block count: ${block.blockCount}`);
    console.log(`Cube count: ${block.cubes.length}`);
    console.log(`Size: r=${block.size.r}, c=${block.size.c}, h=${block.size.h}`);

    if (block.center) {
        console.log(
            `Center: r=${block.center.r}, c=${block.center.c}, h=${block.center.h}`
        );
    } else {
        console.log('Center: null');
    }

    console.log('Height Data:');
    for (const row of block.heightData) {
        console.log(`  ${row.map((height) => height === 0 ? '.' : height).join(' ')}`);
    }
}

async function main() {
    const { blockJsonPath, blockIndexText } = parseArgs(process.argv.slice(2));
    const indexText = blockIndexText ?? await promptBlockIndex();
    const blockIndex = parseBlockIndex(indexText);
    const { sourcePath, block } = await loadBlockByIndex(blockJsonPath, blockIndex);

    printSelectedBlock(sourcePath, block);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
