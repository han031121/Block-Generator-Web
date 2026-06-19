const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_BLOCK_JSON_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    'blockGenerator',
    'fixtures',
    'output',
    'test_output.json'
); 
// 블록 JSON의 기본 경로

function assertObject(value, name) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${name} must be an object.`);
    }
}
// 값 검증

function readInteger(value, name, min = Number.MIN_SAFE_INTEGER) {
    if (!Number.isInteger(value) || value < min) {
        throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
    }

    return value;
}
// 변수 유효성 검증

function readNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number.`);
    }

    return value;
}
// 숫자 크기 검증

function parseBlockIndex(value) {
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) {
        throw new Error('Block index must be a non-negative integer.');
    }

    const index = Number(text);
    if (!Number.isSafeInteger(index)) {
        throw new Error('Block index is too large.');
    }

    return index;
}
// cli로 받은 값을 블록 인덱스로 변환

function normalizePoint(value, name) {
    if (value === null) {
        return null;
    }

    assertObject(value, name);
    return {
        r: readNumber(value.r, `${name}.r`),
        c: readNumber(value.c, `${name}.c`),
        h: readNumber(value.h, `${name}.h`)
    };
}
// 좌표 정규화

function normalizeSize(value, name) {
    assertObject(value, name);
    return {
        r: readInteger(value.r, `${name}.r`, 0),
        c: readInteger(value.c, `${name}.c`, 0),
        h: readInteger(value.h, `${name}.h`, 0)
    };
}
// 크기 정보 정규화

function normalizeHeightData(value, name) {
    if (!Array.isArray(value)) {
        throw new Error(`${name} must be an array.`);
    }

    let expectedWidth = null;
    return value.map((row, rowIndex) => {
        if (!Array.isArray(row)) {
            throw new Error(`${name}[${rowIndex}] must be an array.`);
        }

        if (expectedWidth === null) {
            expectedWidth = row.length;
        } else if (row.length !== expectedWidth) {
            throw new Error(`${name} must be rectangular.`);
        }

        return row.map((height, colIndex) =>
            readInteger(height, `${name}[${rowIndex}][${colIndex}]`, 0)
        );
    });
}
// 2차원 배열(height_data) 검증

function buildCubes(heightData) {
    const cubes = [];
    for (let r = 0; r < heightData.length; r += 1) {
        for (let c = 0; c < heightData[r].length; c += 1) {
            for (let h = 0; h < heightData[r][c]; h += 1) {
                cubes.push({ r, c, h });
            }
        }
    }

    return cubes;
}
// 2차원 배열(height_data)을 좌표 목록으로 바꿈

function maxHeight(heightData) {
    return heightData.reduce(
        (max, row) => Math.max(max, ...row),
        0
    );
}
// 최대 좌표 구하기

function normalizeBlock(rawBlock, position) {
    const name = `blocks[${position}]`;
    assertObject(rawBlock, name);

    const generated = rawBlock.generated;
    if (typeof generated !== 'boolean') {
        throw new Error(`${name}.generated must be a boolean.`);
    }

    const heightData = normalizeHeightData(rawBlock.height_data, `${name}.height_data`);
    const cubes = buildCubes(heightData);
    const blockCount = readInteger(rawBlock.block_count, `${name}.block_count`, 0);
    const size = normalizeSize(rawBlock.size, `${name}.size`);
    const identify = rawBlock.identify;

    if (identify !== null && typeof identify !== 'string') {
        throw new Error(`${name}.identify must be a string or null.`);
    }

    if (generated && cubes.length !== blockCount) {
        throw new Error(
            `${name}.block_count does not match the cube count from height_data.`
        );
    }

    if (generated && size.h !== maxHeight(heightData)) {
        throw new Error(`${name}.size.h does not match height_data.`);
    }

    return {
        position,
        index: readInteger(rawBlock.index, `${name}.index`, 0),
        generated,
        blockCount,
        size,
        center: normalizePoint(rawBlock.center, `${name}.center`),
        identify,
        heightData,
        cubes
    };
}
// 블록 군집 하나 정규화

async function readBlockJson(filePath = DEFAULT_BLOCK_JSON_PATH) {
    const sourcePath = path.resolve(filePath);
    let text;

    try {
        text = await fs.readFile(sourcePath, 'utf8');
    } catch (error) {
        throw new Error(`Cannot open block json file: ${sourcePath}\n${error.message}`);
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error(`Cannot parse block json file: ${sourcePath}\n${error.message}`);
    }

    assertObject(data, 'block json root');
    if (!Array.isArray(data.blocks)) {
        throw new Error('block json root.blocks must be an array.');
    }

    return {
        sourcePath,
        input: data.input ?? null,
        blocks: data.blocks
    };
}
// JSON 파싱 -> {sourcePath, input, blocks}

function selectBlock(blockJson, index) {
    const position = readInteger(index, 'block index', 0);
    if (position >= blockJson.blocks.length) {
        throw new Error(
            `Block index ${position} is out of range. Available range: 0-${blockJson.blocks.length - 1}.`
        );
    }

    return normalizeBlock(blockJson.blocks[position], position);
}
// 인덱스에 다라 블록 군집 선택, 정규화

async function loadBlockByIndex(filePath, index) {
    const blockJson = await readBlockJson(filePath);
    const block = selectBlock(blockJson, index);

    return {
        sourcePath: blockJson.sourcePath,
        input: blockJson.input,
        block
    };
}
// 외부에서 사용하는 함수, JSON 읽고 블록 군집 선택

module.exports = {
    DEFAULT_BLOCK_JSON_PATH,
    buildCubes,
    loadBlockByIndex,
    parseBlockIndex,
    readBlockJson,
    selectBlock
};
