import {
    DEFAULT_RENDER_OPTIONS,
    ThreeBlockRenderer
} from '/modules/blockRenderer/src/core/index.mjs';
import { generateBlockJson } from './api/blockGeneratorWasm.mjs';
import {
    normalizeBlockJsonData,
    selectBlock
} from './api/blockJsonBrowser.mjs';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const heightDataOutput = document.querySelector('#heightData');
const blockPosition = document.querySelector('#blockPosition');
const blockMeta = document.querySelector('#blockMeta');
const generatorForm = document.querySelector('#generatorForm');
const startButton = document.querySelector('#startButton');
const prevButton = document.querySelector('#prevButton');
const nextButton = document.querySelector('#nextButton');
const downloadButton = document.querySelector('#downloadButton');
const generatorControls = {
    generateCount: document.querySelector('#generateCount'),
    blockCountMin: document.querySelector('#blockCountMin'),
    blockCountMax: document.querySelector('#blockCountMax'),
    maxRows: document.querySelector('#maxRows'),
    maxCols: document.querySelector('#maxCols'),
    maxHeight: document.querySelector('#maxHeight'),
    density: document.querySelector('#density'),
    allowDuplicate: document.querySelector('#allowDuplicate')
};
const generatorValueControls = {
    density: document.querySelector('#densityValue')
};
const controls = {
    backgroundColor: document.querySelector('#backgroundColor'),
    blockColor: document.querySelector('#blockColor'),
    edgeColor: document.querySelector('#edgeColor'),
    edgeThickness: document.querySelector('#edgeThickness'),
    cameraDistance: document.querySelector('#cameraDistance'),
    cameraAzimuthDeg: document.querySelector('#cameraAzimuthDeg'),
    cameraElevationDeg: document.querySelector('#cameraElevationDeg'),
    ambientLightIntensity: document.querySelector('#ambientLightIntensity'),
    directionalLightIntensity: document.querySelector('#directionalLightIntensity'),
    lightFollowsCamera: document.querySelector('#lightFollowsCamera'),
    lightAzimuthDeg: document.querySelector('#lightAzimuthDeg'),
    lightElevationDeg: document.querySelector('#lightElevationDeg')
};
const valueControls = {
    edgeThickness: document.querySelector('#edgeThicknessValue'),
    cameraDistance: document.querySelector('#cameraDistanceValue'),
    cameraAzimuthDeg: document.querySelector('#cameraAzimuthDegValue'),
    cameraElevationDeg: document.querySelector('#cameraElevationDegValue'),
    ambientLightIntensity: document.querySelector('#ambientLightIntensityValue'),
    directionalLightIntensity: document.querySelector('#directionalLightIntensityValue'),
    lightAzimuthDeg: document.querySelector('#lightAzimuthDegValue'),
    lightElevationDeg: document.querySelector('#lightElevationDegValue')
};
const LIGHT_POSITION_CONTROL_NAMES = ['lightAzimuthDeg', 'lightElevationDeg'];

const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
let activeBlockJson = null;
let activeBlock = null;
let activeIndex = 0;

function setStatus(message) {
    status.textContent = message;
}

function readIntegerInput(control, label) {
    const value = Number(control.value);
    const min = Number(control.min);
    const max = Number(control.max);

    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${label} is outside the allowed range.`);
    }

    return value;
}

function readNumberInput(control, label) {
    const value = Number(control.value);
    const min = Number(control.min);
    const max = Number(control.max);

    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${label} is outside the allowed range.`);
    }

    return value;
}

function readGeneratorOptions() {
    const generateCount = readIntegerInput(generatorControls.generateCount, 'Generate count');
    const blockCountMin = readIntegerInput(generatorControls.blockCountMin, 'Block count min');
    const blockCountMax = readIntegerInput(generatorControls.blockCountMax, 'Block count max');
    const maxRows = readIntegerInput(generatorControls.maxRows, 'Rows');
    const maxCols = readIntegerInput(generatorControls.maxCols, 'Columns');
    const maxHeight = readIntegerInput(generatorControls.maxHeight, 'Height');
    const capacity = maxRows * maxCols * maxHeight;

    if (blockCountMin > blockCountMax) {
        throw new Error('Block count min cannot be greater than block count max.');
    }

    if (blockCountMax > capacity) {
        throw new Error(`Block count max cannot exceed the current capacity ${capacity}.`);
    }

    return {
        generate_count: generateCount,
        block_count_min: blockCountMin,
        block_count_max: blockCountMax,
        max_r: maxRows,
        max_c: maxCols,
        max_h: maxHeight,
        density: readNumberInput(generatorControls.density, 'Density'),
        allow_duplicate: generatorControls.allowDuplicate.checked
    };
}

function readRenderOptions() {
    return {
        backgroundColor: controls.backgroundColor.value,
        blockColor: controls.blockColor.value,
        edgeColor: controls.edgeColor.value,
        edgeThickness: Number(controls.edgeThickness.value),
        cameraDistance: Number(controls.cameraDistance.value),
        cameraAzimuthDeg: Number(controls.cameraAzimuthDeg.value),
        cameraElevationDeg: Number(controls.cameraElevationDeg.value),
        ambientLightIntensity: Number(controls.ambientLightIntensity.value),
        directionalLightIntensity: Number(controls.directionalLightIntensity.value),
        lightFollowsCamera: controls.lightFollowsCamera.checked,
        lightAzimuthDeg: Number(controls.lightAzimuthDeg.value),
        lightElevationDeg: Number(controls.lightElevationDeg.value)
    };
}

function clampToControlRange(value, control) {
    const min = Number(control.min);
    const max = Number(control.max);
    return Math.min(max, Math.max(min, value));
}

function syncRangeToNumber(name) {
    valueControls[name].value = controls[name].value;
}

function syncNumberToRange(name) {
    const value = Number(valueControls[name].value);
    if (!Number.isFinite(value)) {
        return false;
    }

    controls[name].value = String(clampToControlRange(value, controls[name]));
    valueControls[name].value = controls[name].value;
    return true;
}

function syncGeneratorRangeToNumber(name) {
    generatorValueControls[name].value = generatorControls[name].value;
}

function syncGeneratorNumberToRange(name) {
    const value = Number(generatorValueControls[name].value);
    if (!Number.isFinite(value)) {
        return false;
    }

    generatorControls[name].value = String(
        clampToControlRange(value, generatorControls[name])
    );
    generatorValueControls[name].value = generatorControls[name].value;
    return true;
}

function setControlPairValue(name, value) {
    controls[name].value = String(value);
    valueControls[name].value = controls[name].value;
}

function syncLightPositionToCamera() {
    setControlPairValue('lightAzimuthDeg', controls.cameraAzimuthDeg.value);
    setControlPairValue('lightElevationDeg', controls.cameraElevationDeg.value);
}

function updateLightPositionControlState() {
    const shouldDisable = controls.lightFollowsCamera.checked;

    if (shouldDisable) {
        syncLightPositionToCamera();
    }

    for (const name of LIGHT_POSITION_CONTROL_NAMES) {
        controls[name].disabled = shouldDisable;
        valueControls[name].disabled = shouldDisable;
    }
}

function updateHeightData(block) {
    heightDataOutput.textContent = block.heightData
        .map((row) => row.map((height) => height === 0 ? '.' : height).join(' '))
        .join('\n');
}

function updateNavigationState() {
    const total = activeBlockJson?.blocks.length ?? 0;
    blockPosition.textContent = total === 0 ? '0 / 0' : `${activeIndex + 1} / ${total}`;
    prevButton.disabled = total === 0 || activeIndex === 0;
    nextButton.disabled = total === 0 || activeIndex + 1 >= total;
    downloadButton.disabled = activeBlock === null;
}

function updateBlockMeta(block) {
    if (!block) {
        blockMeta.textContent = '';
        heightDataOutput.textContent = '';
        return;
    }

    blockMeta.textContent = [
        `Index ${block.index}`,
        `Cubes ${block.cubes.length}`,
        `Size ${block.size.r} x ${block.size.c} x ${block.size.h}`,
        `Identify ${block.identify ?? 'null'}`
    ].join('\n');
}

function renderActiveBlock() {
    if (!activeBlock) {
        return;
    }

    renderer.render(activeBlock, readRenderOptions());
    updateBlockMeta(activeBlock);
    updateNavigationState();
}

function setActiveIndex(index) {
    if (!activeBlockJson) {
        return;
    }

    activeIndex = index;
    activeBlock = selectBlock(activeBlockJson, activeIndex);
    updateHeightData(activeBlock);
    renderActiveBlock();
}

async function startGeneration() {
    const generatorOptions = readGeneratorOptions();

    startButton.disabled = true;
    setStatus('Generating...');

    try {
        const generatedJson = await generateBlockJson(generatorOptions);
        activeBlockJson = normalizeBlockJsonData(generatedJson);
        activeBlock = null;
        activeIndex = 0;

        if (activeBlockJson.blocks.length === 0) {
            updateBlockMeta(null);
            updateNavigationState();
            setStatus('No blocks were generated.');
            return;
        }

        setActiveIndex(0);
        setStatus(`Generated ${activeBlockJson.blocks.length} blocks.`);
    } finally {
        startButton.disabled = false;
    }
}

function moveBlock(offset) {
    if (!activeBlockJson) {
        return;
    }

    const nextIndex = activeIndex + offset;
    if (nextIndex < 0 || nextIndex >= activeBlockJson.blocks.length) {
        return;
    }

    setActiveIndex(nextIndex);
}

function downloadImage() {
    if (!activeBlock) {
        return;
    }

    renderer.downloadJpeg(`block-${activeBlock.index}.jpg`);
}

function bindGeneratorEvents() {
    generatorForm.addEventListener('submit', (event) => {
        event.preventDefault();
        startGeneration().catch((error) => setStatus(error.message));
    });
    prevButton.addEventListener('click', () => moveBlock(-1));
    nextButton.addEventListener('click', () => moveBlock(1));
    downloadButton.addEventListener('click', downloadImage);

    generatorControls.density.addEventListener('input', () => {
        syncGeneratorRangeToNumber('density');
    });
    generatorValueControls.density.addEventListener('input', () => {
        syncGeneratorNumberToRange('density');
    });
}

function bindRenderEvents() {
    controls.backgroundColor.addEventListener('input', renderActiveBlock);
    controls.blockColor.addEventListener('input', renderActiveBlock);
    controls.edgeColor.addEventListener('input', renderActiveBlock);
    controls.lightFollowsCamera.addEventListener('change', () => {
        updateLightPositionControlState();
        renderActiveBlock();
    });

    for (const name of Object.keys(valueControls)) {
        controls[name].addEventListener('input', () => {
            syncRangeToNumber(name);
            if (controls.lightFollowsCamera.checked &&
                (name === 'cameraAzimuthDeg' || name === 'cameraElevationDeg')) {
                syncLightPositionToCamera();
            }
            renderActiveBlock();
        });
        valueControls[name].addEventListener('input', () => {
            if (syncNumberToRange(name)) {
                if (controls.lightFollowsCamera.checked &&
                    (name === 'cameraAzimuthDeg' || name === 'cameraElevationDeg')) {
                    syncLightPositionToCamera();
                }
                renderActiveBlock();
            }
        });
    }
}

bindGeneratorEvents();
bindRenderEvents();
updateLightPositionControlState();
updateNavigationState();
