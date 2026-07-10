const assert = require('node:assert/strict');
const test = require('node:test');

test('web block json normalization hides failed generated blocks', async () => {
    const { normalizeBlockJsonData, selectBlock } =
        await import('../src/api/blockJsonBrowser.mjs');

    const blockJson = normalizeBlockJsonData({
        input: { generate_count: 2 },
        blocks: [
            {
                index: 0,
                generated: true,
                block_count: 1,
                size: { r: 1, c: 1, h: 1 },
                height_data: [[1]],
                identify: '11_1',
                center: { r: 0, c: 0, h: 0 }
            },
            {
                index: 1,
                generated: false,
                block_count: 1,
                size: { r: 0, c: 0, h: 0 },
                height_data: [[0]],
                identify: null,
                center: null
            }
        ]
    });

    assert.equal(blockJson.blocks.length, 1);
    assert.equal(selectBlock(blockJson, 0).index, 0);
});
