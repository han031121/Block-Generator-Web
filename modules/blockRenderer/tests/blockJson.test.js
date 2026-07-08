const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    loadBlockByIndex,
    parseBlockIndex
} = require('../src/adapters/blockJson');

const SAMPLE_BLOCK_JSON = {
    input: {
        generate_count: 1,
        block_count_min: 3,
        block_count_max: 3,
        max_r: 2,
        max_c: 2,
        max_h: 2,
        density: 0,
        allow_duplicate: false
    },
    blocks: [
        {
            index: 0,
            generated: true,
            block_count: 3,
            size: { r: 1, c: 2, h: 2 },
            height_data: [
                [1, 2],
                [0, 0]
            ],
            identify: '12_12',
            center: { r: 0, c: 0.5, h: 0.5 }
        }
    ]
};

async function writeSampleBlockJson(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'block-json-test-'));
    const filePath = path.join(directory, 'blocks.json');

    await fs.writeFile(filePath, JSON.stringify(SAMPLE_BLOCK_JSON), 'utf8');
    t.after(() => fs.rm(directory, { recursive: true, force: true }));

    return filePath;
}

test('loads a selected block and derives cube coordinates', async (t) => {
    const filePath = await writeSampleBlockJson(t);
    const { block } = await loadBlockByIndex(filePath, 0);
    const expectedCubeCount = block.heightData
        .flat()
        .reduce((sum, height) => sum + height, 0);

    assert.equal(block.position, 0);
    assert.equal(block.index, 0);
    assert.equal(block.generated, true);
    assert.equal(block.cubes.length, block.blockCount);
    assert.equal(block.cubes.length, expectedCubeCount);

    for (const cube of block.cubes) {
        assert.ok(cube.h >= 0);
        assert.ok(cube.h < block.heightData[cube.r][cube.c]);
    }
});

test('parses non-negative integer index text', () => {
    assert.equal(parseBlockIndex('12'), 12);
    assert.equal(parseBlockIndex(' 3 '), 3);
});

test('rejects invalid index text', () => {
    assert.throws(() => parseBlockIndex('-1'), /non-negative integer/);
    assert.throws(() => parseBlockIndex('1.5'), /non-negative integer/);
});

test('rejects out-of-range block index', async (t) => {
    const filePath = await writeSampleBlockJson(t);

    await assert.rejects(
        () => loadBlockByIndex(filePath, 99999),
        /out of range/
    );
});
