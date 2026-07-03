const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DEFAULT_BLOCK_JSON_PATH,
    loadBlockByIndex,
    parseBlockIndex
} = require('../src/adapters/blockJson');

test('loads a selected block and derives cube coordinates', async () => {
    const { block } = await loadBlockByIndex(DEFAULT_BLOCK_JSON_PATH, 0);
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

test('rejects out-of-range block index', async () => {
    await assert.rejects(
        () => loadBlockByIndex(DEFAULT_BLOCK_JSON_PATH, 99999),
        /out of range/
    );
});
