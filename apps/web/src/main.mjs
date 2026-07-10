import {
    DEFAULT_RENDER_OPTIONS,
    ThreeBlockRenderer
} from '../modules/blockRenderer/src/core/index.mjs';
import {
    GENERATION_TIMEOUT_MS,
    generateBlockJson,
    isBlockGenerationTimeoutError
} from './api/blockGeneratorWasm.mjs';
import {
    normalizeBlockJsonData,
    selectBlock
} from './api/blockJsonBrowser.mjs';

const app = document.querySelector('.app');
const settingsPanel = document.querySelector('#settingsPanel');
const settingsOpenButton = document.querySelector('#settingsOpenButton');
const settingsCloseButton = document.querySelector('#settingsCloseButton');
const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
const canvas = document.querySelector('#renderCanvas');
const canvasWrap = document.querySelector('.canvas-wrap');
const generationOverlay = document.querySelector('#generationOverlay');
const status = document.querySelector('#status');
const heightDataOutput = document.querySelector('#heightData');
const blockPosition = document.querySelector('#blockPosition');
const blockMeta = document.querySelector('#blockMeta');
const generatorForm = document.querySelector('#generatorForm');
const startButton = document.querySelector('#startButton');
const prevButton = document.querySelector('#prevButton');
const nextButton = document.querySelector('#nextButton');
const downloadButton = document.querySelector('#downloadButton');
const resetRenderButton = document.querySelector('#resetRenderButton');
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
const CAMERA_DRAG_SENSITIVITY_DEG = 0.35;
const CAMERA_WHEEL_DISTANCE_STEP = 0.5;
const START_BUTTON_IDLE_LABEL = startButton.textContent;

const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
let activeBlockJson = null;
let activeBlock = null;
let activeIndex = 0;
let cameraDragState = null;
let pendingRenderFrame = 0;

function setSettingsPanelOpen(isOpen, shouldFocus = false) {
    app.classList.toggle('settings-collapsed', !isOpen);
    settingsPanel.setAttribute('aria-hidden', String(!isOpen));
    settingsOpenButton.hidden = isOpen;
    settingsOpenButton.setAttribute('aria-expanded', String(isOpen));
    settingsCloseButton.setAttribute('aria-expanded', String(isOpen));

    if (isOpen && shouldFocus) {
        settingsCloseButton.focus();
    }

    if (!isOpen && settingsPanel.contains(document.activeElement)) {
        settingsOpenButton.focus();
    }
}

function setActiveSettingsTab(tabName, shouldFocus = false) {
    for (const button of tabButtons) {
        const isActive = button.dataset.tabTarget === tabName;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', String(isActive));
        button.tabIndex = isActive ? 0 : -1;

        if (isActive && shouldFocus) {
            button.focus();
        }
    }

    for (const panel of tabPanels) {
        const isActive = panel.dataset.tabPanel === tabName;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
    }
}

function moveSettingsTab(offset) {
    const activeTabIndex = tabButtons.findIndex((button) =>
        button.getAttribute('aria-selected') === 'true'
    );
    const nextIndex = (activeTabIndex + offset + tabButtons.length) % tabButtons.length;

    setActiveSettingsTab(tabButtons[nextIndex].dataset.tabTarget, true);
}

function bindSettingsShellEvents() {
    settingsOpenButton.addEventListener('click', () => {
        setSettingsPanelOpen(true, true);
    });
    settingsCloseButton.addEventListener('click', () => {
        setSettingsPanelOpen(false);
    });

    for (const button of tabButtons) {
        button.addEventListener('click', () => {
            setActiveSettingsTab(button.dataset.tabTarget);
        });
        button.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveSettingsTab(1);
                return;
            }

            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveSettingsTab(-1);
                return;
            }

            if (event.key === 'Home') {
                event.preventDefault();
                setActiveSettingsTab(tabButtons[0].dataset.tabTarget, true);
                return;
            }

            if (event.key === 'End') {
                event.preventDefault();
                setActiveSettingsTab(
                    tabButtons[tabButtons.length - 1].dataset.tabTarget,
                    true
                );
            }
        });
    }
}

function formatDuration(milliseconds) {
    return `${milliseconds / 1000} seconds`;
}

function setStatus(message, state = 'idle') {
    status.textContent = message;
    status.dataset.state = state;
}

function setGenerationBusy(isBusy) {
    startButton.disabled = isBusy;
    startButton.textContent = isBusy ? 'Generating...' : START_BUTTON_IDLE_LABEL;
    generatorForm.classList.toggle('is-generating', isBusy);
    generatorForm.setAttribute('aria-busy', String(isBusy));
    canvasWrap.classList.toggle('is-generating', isBusy);
    generationOverlay.hidden = !isBusy;
    generationOverlay.setAttribute('aria-hidden', String(!isBusy));
    status.setAttribute('aria-busy', String(isBusy));
}

function setGenerationErrorStatus(error) {
    if (isBlockGenerationTimeoutError(error)) {
        const timeoutMs = error.timeoutMs ?? GENERATION_TIMEOUT_MS;
        setStatus(
            `Generation timed out after ${formatDuration(timeoutMs)}. ` +
                'Reduce block count or increase Rows, Columns, or Height.',
            'error'
        );
        return;
    }

    setStatus(error.message, 'error');
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

function formatControlValue(value) {
    return String(Math.round(Number(value) * 1000) / 1000);
}

function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
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
    const nextValue = clampToControlRange(Number(value), controls[name]);
    controls[name].value = formatControlValue(nextValue);
    valueControls[name].value = controls[name].value;
}

function setCameraAngleValues(azimuthDeg, elevationDeg) {
    setControlPairValue('cameraAzimuthDeg', normalizeDegrees(azimuthDeg));
    setControlPairValue('cameraElevationDeg', elevationDeg);

    if (controls.lightFollowsCamera.checked) {
        syncLightPositionToCamera();
    }
}

function setCameraDistanceValue(distance) {
    setControlPairValue('cameraDistance', distance);
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

function resetRenderOptions() {
    controls.backgroundColor.value = DEFAULT_RENDER_OPTIONS.backgroundColor;
    controls.blockColor.value = DEFAULT_RENDER_OPTIONS.blockColor;
    controls.edgeColor.value = DEFAULT_RENDER_OPTIONS.edgeColor;
    controls.lightFollowsCamera.checked = DEFAULT_RENDER_OPTIONS.lightFollowsCamera;

    setControlPairValue('edgeThickness', DEFAULT_RENDER_OPTIONS.edgeThickness);
    setControlPairValue('cameraDistance', DEFAULT_RENDER_OPTIONS.cameraDistance);
    setControlPairValue('cameraAzimuthDeg', DEFAULT_RENDER_OPTIONS.cameraAzimuthDeg);
    setControlPairValue('cameraElevationDeg', DEFAULT_RENDER_OPTIONS.cameraElevationDeg);
    setControlPairValue(
        'ambientLightIntensity',
        DEFAULT_RENDER_OPTIONS.ambientLightIntensity
    );
    setControlPairValue(
        'directionalLightIntensity',
        DEFAULT_RENDER_OPTIONS.directionalLightIntensity
    );
    setControlPairValue('lightAzimuthDeg', DEFAULT_RENDER_OPTIONS.lightAzimuthDeg);
    setControlPairValue('lightElevationDeg', DEFAULT_RENDER_OPTIONS.lightElevationDeg);

    updateLightPositionControlState();
    renderActiveBlock();
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
    if (pendingRenderFrame !== 0) {
        cancelAnimationFrame(pendingRenderFrame);
        pendingRenderFrame = 0;
    }

    if (!activeBlock) {
        return;
    }

    renderer.render(activeBlock, readRenderOptions());
}

function requestRenderActiveBlock() {
    if (pendingRenderFrame !== 0) {
        return;
    }

    pendingRenderFrame = requestAnimationFrame(() => {
        pendingRenderFrame = 0;
        renderActiveBlock();
    });
}

function setActiveIndex(index) {
    if (!activeBlockJson) {
        return;
    }

    activeIndex = index;
    activeBlock = selectBlock(activeBlockJson, activeIndex);
    updateHeightData(activeBlock);
    updateBlockMeta(activeBlock);
    updateNavigationState();
    renderActiveBlock();
}

async function startGeneration() {
    const generatorOptions = readGeneratorOptions();

    setGenerationBusy(true);
    setStatus(
        `Generating blocks... Timeout after ${formatDuration(GENERATION_TIMEOUT_MS)}.`,
        'loading'
    );

    try {
        const generatedJson = await generateBlockJson(generatorOptions);
        activeBlockJson = normalizeBlockJsonData(generatedJson);
        activeBlock = null;
        activeIndex = 0;

        if (activeBlockJson.blocks.length === 0) {
            updateBlockMeta(null);
            updateNavigationState();
            setStatus('No blocks were generated.', 'warning');
            return;
        }

        setActiveIndex(0);
        setStatus(`Generated ${activeBlockJson.blocks.length} blocks.`, 'success');
    } catch (error) {
        setGenerationErrorStatus(error);
    } finally {
        setGenerationBusy(false);
    }
}

function requestGenerationStart() {
    if (startButton.disabled) {
        return;
    }

    startGeneration().catch((error) => setGenerationErrorStatus(error));
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
        setStatus('Generate a block before saving JPG.', 'warning');
        return false;
    }

    renderActiveBlock();
    renderer.downloadJpeg(`block-${activeBlock.index}.jpg`);
    return true;
}

function bindGeneratorEvents() {
    generatorForm.addEventListener('submit', (event) => {
        event.preventDefault();
        requestGenerationStart();
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
    resetRenderButton.addEventListener('click', resetRenderOptions);

    for (const name of ['backgroundColor', 'blockColor', 'edgeColor']) {
        controls[name].addEventListener('input', requestRenderActiveBlock);
        controls[name].addEventListener('change', renderActiveBlock);
    }

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

function isEditingText(element) {
    if (!element) {
        return false;
    }

    const tagName = element.tagName;
    return element.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'SELECT' ||
        tagName === 'TEXTAREA';
}

function hasShortcutModifier(event) {
    return event.altKey || event.ctrlKey || event.metaKey;
}

function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented || isEditingText(event.target)) {
            return;
        }

        if (event.key === ',' && !hasShortcutModifier(event)) {
            event.preventDefault();
            moveBlock(-1);
            return;
        }

        if (event.key === '.' && !hasShortcutModifier(event)) {
            event.preventDefault();
            moveBlock(1);
            return;
        }

        const key = event.key.toLowerCase();

        if (key === 'g' && !hasShortcutModifier(event)) {
            event.preventDefault();
            requestGenerationStart();
            return;
        }

        if (key === 's' && !event.altKey) {
            event.preventDefault();
            downloadImage();
        }
    });
}

function bindCanvasInteractionEvents() {
    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
            return;
        }

        cameraDragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startAzimuthDeg: Number(controls.cameraAzimuthDeg.value),
            startElevationDeg: Number(controls.cameraElevationDeg.value)
        };
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        canvasWrap.classList.add('is-dragging');
        event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!cameraDragState || event.pointerId !== cameraDragState.pointerId) {
            return;
        }

        const deltaX = event.clientX - cameraDragState.startX;
        const deltaY = event.clientY - cameraDragState.startY;
        setCameraAngleValues(
            cameraDragState.startAzimuthDeg - deltaX * CAMERA_DRAG_SENSITIVITY_DEG,
            cameraDragState.startElevationDeg + deltaY * CAMERA_DRAG_SENSITIVITY_DEG
        );
        renderActiveBlock();
        event.preventDefault();
    });

    const endCameraDrag = (event) => {
        if (!cameraDragState || event.pointerId !== cameraDragState.pointerId) {
            return;
        }

        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }

        cameraDragState = null;
        canvasWrap.classList.remove('is-dragging');
    };

    canvas.addEventListener('pointerup', endCameraDrag);
    canvas.addEventListener('pointercancel', endCameraDrag);

    canvas.addEventListener('wheel', (event) => {
        const direction = Math.sign(event.deltaY);
        if (direction === 0) {
            return;
        }

        const step = Number(controls.cameraDistance.step) || CAMERA_WHEEL_DISTANCE_STEP;
        setCameraDistanceValue(Number(controls.cameraDistance.value) + direction * step);
        renderActiveBlock();
        event.preventDefault();
    }, { passive: false });
}

bindSettingsShellEvents();
setSettingsPanelOpen(true);
bindGeneratorEvents();
bindRenderEvents();
bindCanvasInteractionEvents();
bindKeyboardShortcuts();
updateLightPositionControlState();
updateNavigationState();
