import {
    DEFAULT_RENDER_OPTIONS,
    ThreeBlockRenderer
} from '../core/index.mjs';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const heightDataOutput = document.querySelector('#heightData');
const controls = {
    filePath: document.querySelector('#filePath'),
    blockIndex: document.querySelector('#blockIndex'),
    blockColor: document.querySelector('#blockColor'),
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
const loadButton = document.querySelector('#loadButton');
const downloadButton = document.querySelector('#downloadButton');
const LIGHT_POSITION_CONTROL_NAMES = ['lightAzimuthDeg', 'lightElevationDeg'];

const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
let activeBlock = null;

function setStatus(message) {
    status.textContent = message;
}

function readRenderOptions() {
    return {
        blockColor: controls.blockColor.value,
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

function renderActiveBlock() {
    if (!activeBlock) {
        return;
    }

    renderer.render(activeBlock, readRenderOptions());
    setStatus(`index ${activeBlock.index} / cubes ${activeBlock.cubes.length}`);
}

async function loadBlock() {
    const requestUrl = new URL('/api/block', window.location.origin);
    requestUrl.searchParams.set('file', controls.filePath.value);
    requestUrl.searchParams.set('index', controls.blockIndex.value);

    setStatus('loading');
    const response = await fetch(requestUrl);
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error ?? 'Cannot load block data.');
    }

    activeBlock = payload.block;
    updateHeightData(activeBlock);
    renderActiveBlock();
}

function downloadImage() {
    if (!activeBlock) {
        return;
    }

    renderer.downloadJpeg(`block-${activeBlock.index}.jpg`);
}

function bindControlEvents() {
    loadButton.addEventListener('click', () => {
        loadBlock().catch((error) => setStatus(error.message));
    });
    downloadButton.addEventListener('click', downloadImage);

    controls.blockColor.addEventListener('input', renderActiveBlock);
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

bindControlEvents();
updateLightPositionControlState();
loadBlock().catch((error) => setStatus(error.message));
