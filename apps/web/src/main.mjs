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
import {
    getLocale,
    setLocale,
    t,
    translateDocument
} from './i18n/index.mjs';

const app = document.querySelector('.app');
const settingsPanel = document.querySelector('#settingsPanel');
const settingsToggleButton = document.querySelector('#settingsToggleButton');
const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
const renderingPanel = document.querySelector('#renderingPanel');
const renderingControls = document.querySelector('#renderingControls');
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
const languageSwitcher = document.querySelector('#languageSwitcher');
const languageMenuButton = document.querySelector('#languageMenuButton');
const languageMenu = document.querySelector('#languageMenu');
const languageButtons = Array.from(document.querySelectorAll('[data-locale]'));
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

class LocalizedError extends Error {
    constructor(translationKey, params = {}) {
        super(translationKey);
        this.name = 'LocalizedError';
        this.translationKey = translationKey;
        this.translationParams = params;
    }
}

const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
let activeBlockJson = null;
let activeBlock = null;
let activeIndex = 0;
let cameraDragState = null;
let pendingRenderFrame = 0;
let isGenerationBusy = false;
let currentStatus = {
    key: 'status.ready',
    params: {},
    state: 'idle'
};

function setSettingsPanelOpen(isOpen, shouldFocus = false) {
    app.classList.toggle('settings-collapsed', !isOpen);
    settingsPanel.setAttribute('aria-hidden', String(!isOpen));
    settingsToggleButton.setAttribute('aria-expanded', String(isOpen));
    settingsToggleButton.setAttribute(
        'aria-label',
        t(isOpen ? 'settings.hide' : 'settings.show')
    );

    if (shouldFocus || (!isOpen && settingsPanel.contains(document.activeElement))) {
        settingsToggleButton.focus();
    }
}

function setActiveSettingsTab(tabName, shouldFocus = false) {
    const targetButton = tabButtons.find((button) =>
        button.dataset.tabTarget === tabName
    );
    if (!targetButton || targetButton.disabled) {
        return;
    }

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
    const enabledTabButtons = tabButtons.filter((button) => !button.disabled);
    const activeTabIndex = enabledTabButtons.findIndex((button) =>
        button.getAttribute('aria-selected') === 'true'
    );
    const nextIndex = (
        activeTabIndex + offset + enabledTabButtons.length
    ) % enabledTabButtons.length;

    setActiveSettingsTab(enabledTabButtons[nextIndex].dataset.tabTarget, true);
}

function bindSettingsShellEvents() {
    settingsToggleButton.addEventListener('click', () => {
        const isOpen = settingsToggleButton.getAttribute('aria-expanded') === 'true';
        setSettingsPanelOpen(!isOpen, true);
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

function renderCurrentStatus() {
    const params = { ...currentStatus.params };
    if (params.labelKey) {
        params.label = t(params.labelKey);
        delete params.labelKey;
    }

    status.textContent = t(currentStatus.key, params);
    status.dataset.state = currentStatus.state;
}

function setStatus(key, params = {}, state = 'idle') {
    currentStatus = { key, params, state };
    renderCurrentStatus();
}

function setGenerationBusy(isBusy) {
    isGenerationBusy = isBusy;
    startButton.disabled = isBusy;
    startButton.textContent = t(
        isBusy ? 'generation.generating' : 'generation.start'
    );
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
            'errors.timeout',
            { seconds: timeoutMs / 1000 },
            'error'
        );
        return;
    }

    if (error instanceof LocalizedError) {
        setStatus(error.translationKey, error.translationParams, 'error');
        return;
    }

    console.error(error);
    setStatus('errors.generationFailed', {}, 'error');
}

function readIntegerInput(control, labelKey) {
    const value = Number(control.value);
    const min = Number(control.min);
    const max = Number(control.max);

    if (!Number.isInteger(value) || value < min || value > max) {
        throw new LocalizedError('errors.outOfRange', { labelKey });
    }

    return value;
}

function readNumberInput(control, labelKey) {
    const value = Number(control.value);
    const min = Number(control.min);
    const max = Number(control.max);

    if (!Number.isFinite(value) || value < min || value > max) {
        throw new LocalizedError('errors.outOfRange', { labelKey });
    }

    return value;
}

function readGeneratorOptions() {
    const generateCount = readIntegerInput(
        generatorControls.generateCount,
        'generation.generateCount'
    );
    const blockCountMin = readIntegerInput(
        generatorControls.blockCountMin,
        'generation.blockCountMin'
    );
    const blockCountMax = readIntegerInput(
        generatorControls.blockCountMax,
        'generation.blockCountMax'
    );
    const maxRows = readIntegerInput(generatorControls.maxRows, 'generation.rows');
    const maxCols = readIntegerInput(generatorControls.maxCols, 'generation.columns');
    const maxHeight = readIntegerInput(generatorControls.maxHeight, 'generation.height');
    const capacity = maxRows * maxCols * maxHeight;

    if (blockCountMin > blockCountMax) {
        throw new LocalizedError('errors.minGreaterThanMax');
    }

    if (blockCountMax > capacity) {
        throw new LocalizedError('errors.exceedsCapacity', { capacity });
    }

    return {
        generate_count: generateCount,
        block_count_min: blockCountMin,
        block_count_max: blockCountMax,
        max_r: maxRows,
        max_c: maxCols,
        max_h: maxHeight,
        density: readNumberInput(generatorControls.density, 'generation.density'),
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
    const shouldDisable = activeBlock === null || controls.lightFollowsCamera.checked;

    if (controls.lightFollowsCamera.checked) {
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
    const hasActiveBlock = activeBlock !== null;

    blockPosition.textContent = total === 0 ? '0 / 0' : `${activeIndex + 1} / ${total}`;
    prevButton.disabled = total === 0 || activeIndex === 0;
    nextButton.disabled = total === 0 || activeIndex + 1 >= total;
    downloadButton.disabled = !hasActiveBlock;
    renderingControls.disabled = !hasActiveBlock;
    renderingPanel.setAttribute('aria-disabled', String(!hasActiveBlock));

    updateLightPositionControlState();
}

function updateBlockMeta(block) {
    if (!block) {
        blockMeta.replaceChildren();
        heightDataOutput.textContent = '';
        return;
    }

    const rows = [
        ['blockMeta.index', block.index],
        ['blockMeta.cubes', block.cubes.length],
        ['blockMeta.size', `${block.size.r} x ${block.size.c} x ${block.size.h}`]
    ].map(([labelKey, value]) => {
        const row = document.createElement('div');
        const labelElement = document.createElement('strong');
        const valueElement = document.createTextNode(` ${value}`);

        row.className = 'block-meta-line';
        labelElement.className = 'block-meta-label';
        labelElement.textContent = t(labelKey);
        row.append(labelElement, valueElement);
        return row;
    });

    const identifyLabel = document.createElement('div');
    const identifyLabelText = document.createElement('strong');

    identifyLabel.className = 'block-meta-line';
    identifyLabelText.className = 'block-meta-label';
    identifyLabelText.textContent = t('blockMeta.id');
    identifyLabel.append(identifyLabelText);

    const identifyCode = document.createElement('code');
    identifyCode.textContent = block.identify ?? 'null';

    const identifyBlock = document.createElement('pre');
    identifyBlock.className = 'block-identify-code';
    identifyBlock.append(identifyCode);

    blockMeta.replaceChildren(...rows, identifyLabel, identifyBlock);
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
        'status.generating',
        { seconds: GENERATION_TIMEOUT_MS / 1000 },
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
            setStatus('status.noBlocks', {}, 'warning');
            return;
        }

        setActiveIndex(0);
        setStatus(
            'status.generated',
            { count: activeBlockJson.blocks.length },
            'success'
        );
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
        setStatus('status.saveBeforeGeneration', {}, 'warning');
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

function applyLocale() {
    const locale = getLocale();
    document.documentElement.lang = locale;
    document.title = t('app.title');
    translateDocument();

    for (const button of languageButtons) {
        const isActive = button.dataset.locale === locale;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-checked', String(isActive));
    }

    const settingsOpen = settingsToggleButton.getAttribute('aria-expanded') === 'true';
    settingsToggleButton.setAttribute(
        'aria-label',
        t(settingsOpen ? 'settings.hide' : 'settings.show')
    );
    setGenerationBusy(isGenerationBusy);
    renderCurrentStatus();

    if (activeBlock) {
        updateBlockMeta(activeBlock);
    }
}

function setLanguageMenuOpen(isOpen, focusTarget = null) {
    languageMenu.hidden = !isOpen;
    languageMenuButton.setAttribute('aria-expanded', String(isOpen));

    if (!isOpen) {
        return;
    }

    if (focusTarget === 'last') {
        languageButtons.at(-1)?.focus();
    } else if (focusTarget === 'active') {
        const activeButton = languageButtons.find(
            (button) => button.dataset.locale === getLocale()
        );
        (activeButton ?? languageButtons[0])?.focus();
    }
}

function bindLanguageEvents() {
    languageMenuButton.addEventListener('click', () => {
        setLanguageMenuOpen(languageMenu.hidden);
    });
    languageMenuButton.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }

        setLanguageMenuOpen(true, event.key === 'ArrowUp' ? 'last' : 'active');
        event.preventDefault();
    });

    for (const button of languageButtons) {
        button.addEventListener('click', () => {
            if (setLocale(button.dataset.locale)) {
                applyLocale();
            }
            setLanguageMenuOpen(false);
            languageMenuButton.focus();
        });
    }

    languageMenu.addEventListener('keydown', (event) => {
        const currentIndex = languageButtons.indexOf(document.activeElement);
        if (currentIndex < 0) {
            return;
        }

        let nextIndex = null;
        if (event.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % languageButtons.length;
        } else if (event.key === 'ArrowUp') {
            nextIndex = (
                currentIndex - 1 + languageButtons.length
            ) % languageButtons.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = languageButtons.length - 1;
        }

        if (nextIndex !== null) {
            languageButtons[nextIndex].focus();
            event.preventDefault();
        }
    });

    languageSwitcher.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !languageMenu.hidden) {
            setLanguageMenuOpen(false);
            languageMenuButton.focus();
            event.preventDefault();
        }
    });
    languageSwitcher.addEventListener('focusout', (event) => {
        if (!languageSwitcher.contains(event.relatedTarget)) {
            setLanguageMenuOpen(false);
        }
    });
    document.addEventListener('pointerdown', (event) => {
        if (!languageSwitcher.contains(event.target)) {
            setLanguageMenuOpen(false);
        }
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
        if (!activeBlock || event.button !== 0) {
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
        if (!activeBlock) {
            return;
        }

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
bindLanguageEvents();
applyLocale();
bindGeneratorEvents();
bindRenderEvents();
bindCanvasInteractionEvents();
bindKeyboardShortcuts();
updateLightPositionControlState();
updateNavigationState();
