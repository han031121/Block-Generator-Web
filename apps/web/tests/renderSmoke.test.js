const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('../../../modules/blockRenderer/node_modules/playwright-core');

const { startServer } = require('../src/server');

const EDGE_PATH = process.env.PLAYWRIGHT_EDGE_PATH ??
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('runs the web generation flow and renders a nonblank Three.js canvas', {
    skip: fs.existsSync(EDGE_PATH) ? false : `Edge executable not found: ${EDGE_PATH}`
}, async (t) => {
    const { server, port } = await startServer(5193);
    t.after(() => server.close());

    const browser = await chromium.launch({
        executablePath: EDGE_PATH,
        headless: true
    });
    t.after(() => browser.close());

    const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });

    const readLayoutState = async () => page.evaluate(() => {
        const canvasRect = document.querySelector('.canvas-wrap').getBoundingClientRect();
        const scrollElement = document.scrollingElement;

        return {
            pageScrollsVertically: scrollElement.scrollHeight > scrollElement.clientHeight,
            settingsOverflowY: getComputedStyle(
                document.querySelector('.settings-scroll')
            ).overflowY,
            panelAriaHidden: document.querySelector('#settingsPanel')
                .getAttribute('aria-hidden'),
            openButtonHidden: document.querySelector('#settingsOpenButton').hidden,
            canvasInsideViewport: canvasRect.left >= 0 &&
                canvasRect.top >= 0 &&
                canvasRect.right <= window.innerWidth + 1 &&
                canvasRect.bottom <= window.innerHeight + 1,
            canvasWidth: canvasRect.width,
            canvasHeight: canvasRect.height
        };
    });

    let layoutState = await readLayoutState();
    assert.equal(layoutState.pageScrollsVertically, false);
    assert.equal(layoutState.settingsOverflowY, 'auto');
    assert.equal(layoutState.panelAriaHidden, 'false');
    assert.equal(layoutState.openButtonHidden, true);
    assert.equal(layoutState.canvasInsideViewport, true);
    assert.equal(layoutState.canvasWidth, layoutState.canvasHeight);

    const iconButtonState = await page.evaluate(() => {
        const closeRect = document.querySelector('#settingsCloseButton')
            .getBoundingClientRect();
        const prevRect = document.querySelector('#prevButton').getBoundingClientRect();
        const nextRect = document.querySelector('#nextButton').getBoundingClientRect();

        return {
            closeText: document.querySelector('#settingsCloseButton').innerText.trim(),
            prevText: document.querySelector('#prevButton').innerText.trim(),
            nextText: document.querySelector('#nextButton').innerText.trim(),
            closeWidth: closeRect.width,
            closeHeight: closeRect.height,
            prevWidth: prevRect.width,
            prevHeight: prevRect.height,
            nextWidth: nextRect.width,
            nextHeight: nextRect.height
        };
    });
    assert.equal(iconButtonState.closeText, '');
    assert.equal(iconButtonState.prevText, '');
    assert.equal(iconButtonState.nextText, '');
    assert.ok(iconButtonState.closeWidth <= 34);
    assert.equal(iconButtonState.closeWidth, iconButtonState.closeHeight);
    assert.equal(iconButtonState.prevWidth, iconButtonState.prevHeight);
    assert.equal(iconButtonState.nextWidth, iconButtonState.nextHeight);

    await page.click('#startButton');
    await page.waitForFunction(
        () => !document.querySelector('#generationOverlay')?.hidden,
        null,
        { timeout: 5000 }
    );
    let generationUiState = await page.evaluate(() => ({
        statusText: document.querySelector('#status').textContent,
        statusState: document.querySelector('#status').dataset.state,
        statusBusy: document.querySelector('#status').getAttribute('aria-busy'),
        formBusy: document.querySelector('#generatorForm').getAttribute('aria-busy'),
        overlayHidden: document.querySelector('#generationOverlay').hidden,
        startDisabled: document.querySelector('#startButton').disabled,
        startText: document.querySelector('#startButton').textContent
    }));
    assert.deepEqual(generationUiState, {
        statusText: 'Generating blocks... Timeout after 5 seconds.',
        statusState: 'loading',
        statusBusy: 'true',
        formBusy: 'true',
        overlayHidden: false,
        startDisabled: true,
        startText: 'Generating...'
    });

    await page.waitForFunction(
        () => document.querySelector('#status')?.textContent.includes('Generated'),
        null,
        { timeout: 30000 }
    );
    generationUiState = await page.evaluate(() => ({
        statusState: document.querySelector('#status').dataset.state,
        statusBusy: document.querySelector('#status').getAttribute('aria-busy'),
        formBusy: document.querySelector('#generatorForm').getAttribute('aria-busy'),
        overlayHidden: document.querySelector('#generationOverlay').hidden,
        startDisabled: document.querySelector('#startButton').disabled,
        startText: document.querySelector('#startButton').textContent
    }));
    assert.deepEqual(generationUiState, {
        statusState: 'success',
        statusBusy: 'false',
        formBusy: 'false',
        overlayHidden: true,
        startDisabled: false,
        startText: 'Start'
    });

    let blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    const blockMetaState = await page.evaluate(() => {
        const identifyBlock = document.querySelector('#blockMeta .block-identify-code');
        const identifyCode = identifyBlock?.querySelector('code');
        const identifyStyle = identifyBlock ? getComputedStyle(identifyBlock) : null;
        const labels = Array.from(
            document.querySelectorAll('#blockMeta .block-meta-label')
        );
        const blockDataTitle = document.querySelector('.block-data-title');

        return {
            hasIdentifyBlock: identifyBlock !== null,
            hasIdentifyCode: identifyCode !== null,
            identifyTextLength: identifyCode?.textContent.length ?? 0,
            whiteSpace: identifyStyle?.whiteSpace ?? null,
            overflowWrap: identifyStyle?.overflowWrap ?? null,
            overflowX: identifyStyle?.overflowX ?? null,
            labelTexts: labels.map((label) => label.textContent),
            labelWeights: labels.map((label) => getComputedStyle(label).fontWeight),
            blockDataTitleText: blockDataTitle?.textContent ?? null,
            blockDataTitleWeight: blockDataTitle ?
                getComputedStyle(blockDataTitle).fontWeight :
                null
        };
    });
    assert.equal(blockMetaState.hasIdentifyBlock, true);
    assert.equal(blockMetaState.hasIdentifyCode, true);
    assert.ok(blockMetaState.identifyTextLength > 0);
    assert.equal(blockMetaState.whiteSpace, 'pre-wrap');
    assert.equal(blockMetaState.overflowWrap, 'anywhere');
    assert.equal(blockMetaState.overflowX, 'hidden');
    assert.deepEqual(blockMetaState.labelTexts, ['Index', 'Cubes', 'Size', 'Identify']);
    assert.ok(blockMetaState.labelWeights.every((weight) => Number(weight) >= 700));
    assert.equal(blockMetaState.blockDataTitleText, 'Block data');
    assert.ok(Number(blockMetaState.blockDataTitleWeight) >= 700);

    const timeoutState = await page.evaluate(async () => {
        const {
            generateBlockJson,
            isBlockGenerationTimeoutError
        } = await import('/src/api/blockGeneratorWasm.mjs');

        try {
            await generateBlockJson({
                generate_count: 300,
                block_count_min: 5,
                block_count_max: 15,
                max_r: 4,
                max_c: 4,
                max_h: 5,
                density: 0,
                allow_duplicate: false
            }, { timeoutMs: 0 });

            return { timedOut: false };
        } catch (error) {
            return {
                timedOut: isBlockGenerationTimeoutError(error),
                name: error.name,
                message: error.message
            };
        }
    });
    assert.deepEqual(timeoutState, {
        timedOut: true,
        name: 'BlockGenerationTimeoutError',
        message: 'Block generation timed out after 0 seconds.'
    });

    await page.click('#nextButton');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '2 / 300');

    await page.click('#prevButton');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    await page.locator('#renderCanvas').evaluate((canvas) => canvas.focus());
    await page.keyboard.press('.');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '2 / 300');

    await page.keyboard.press(',');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    await page.fill('#generateCount', '2');
    await page.locator('#renderCanvas').evaluate((canvas) => canvas.focus());
    await page.keyboard.press('g');
    await page.waitForFunction(
        () => document.querySelector('#blockPosition')?.textContent === '1 / 2',
        null,
        { timeout: 30000 }
    );
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 2');

    await page.click('#settingsCloseButton');
    layoutState = await readLayoutState();
    assert.equal(layoutState.pageScrollsVertically, false);
    assert.equal(layoutState.panelAriaHidden, 'true');
    assert.equal(layoutState.openButtonHidden, false);
    assert.equal(layoutState.canvasInsideViewport, true);

    await page.click('#settingsOpenButton');
    layoutState = await readLayoutState();
    assert.equal(layoutState.panelAriaHidden, 'false');
    assert.equal(layoutState.openButtonHidden, true);
    assert.equal(layoutState.canvasInsideViewport, true);

    let tabState = await page.evaluate(() => ({
        generationSelected: document.querySelector('#generationTab')
            .getAttribute('aria-selected'),
        renderingSelected: document.querySelector('#renderingTab')
            .getAttribute('aria-selected'),
        generationHidden: document.querySelector('#generationPanel').hidden,
        renderingHidden: document.querySelector('#renderingPanel').hidden
    }));
    assert.deepEqual(tabState, {
        generationSelected: 'true',
        renderingSelected: 'false',
        generationHidden: false,
        renderingHidden: true
    });

    await page.click('#renderingTab');
    tabState = await page.evaluate(() => ({
        generationSelected: document.querySelector('#generationTab')
            .getAttribute('aria-selected'),
        renderingSelected: document.querySelector('#renderingTab')
            .getAttribute('aria-selected'),
        generationHidden: document.querySelector('#generationPanel').hidden,
        renderingHidden: document.querySelector('#renderingPanel').hidden
    }));
    assert.deepEqual(tabState, {
        generationSelected: 'false',
        renderingSelected: 'true',
        generationHidden: true,
        renderingHidden: false
    });

    let lightPositionState = await page.evaluate(() => ({
        followsCamera: document.querySelector('#lightFollowsCamera').checked,
        lightAzimuthDisabled: document.querySelector('#lightAzimuthDeg').disabled,
        lightAzimuthValueDisabled: document.querySelector('#lightAzimuthDegValue').disabled,
        lightElevationDisabled: document.querySelector('#lightElevationDeg').disabled,
        lightElevationValueDisabled: document.querySelector('#lightElevationDegValue').disabled,
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraElevation: document.querySelector('#cameraElevationDeg').value,
        lightAzimuth: document.querySelector('#lightAzimuthDeg').value,
        lightElevation: document.querySelector('#lightElevationDeg').value
    }));
    assert.equal(lightPositionState.followsCamera, false);
    assert.equal(lightPositionState.lightAzimuthDisabled, false);
    assert.equal(lightPositionState.lightAzimuthValueDisabled, false);
    assert.equal(lightPositionState.lightElevationDisabled, false);
    assert.equal(lightPositionState.lightElevationValueDisabled, false);

    await page.check('#lightFollowsCamera');
    lightPositionState = await page.evaluate(() => ({
        followsCamera: document.querySelector('#lightFollowsCamera').checked,
        lightAzimuthDisabled: document.querySelector('#lightAzimuthDeg').disabled,
        lightAzimuthValueDisabled: document.querySelector('#lightAzimuthDegValue').disabled,
        lightElevationDisabled: document.querySelector('#lightElevationDeg').disabled,
        lightElevationValueDisabled: document.querySelector('#lightElevationDegValue').disabled,
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraElevation: document.querySelector('#cameraElevationDeg').value,
        lightAzimuth: document.querySelector('#lightAzimuthDeg').value,
        lightElevation: document.querySelector('#lightElevationDeg').value
    }));
    assert.equal(lightPositionState.followsCamera, true);
    assert.equal(lightPositionState.lightAzimuthDisabled, true);
    assert.equal(lightPositionState.lightAzimuthValueDisabled, true);
    assert.equal(lightPositionState.lightElevationDisabled, true);
    assert.equal(lightPositionState.lightElevationValueDisabled, true);
    assert.equal(lightPositionState.lightAzimuth, lightPositionState.cameraAzimuth);
    assert.equal(lightPositionState.lightElevation, lightPositionState.cameraElevation);

    await page.fill('#edgeThicknessValue', '8');
    let syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#edgeThickness').value,
        number: document.querySelector('#edgeThicknessValue').value
    }));
    assert.deepEqual(syncedValues, { range: '8', number: '8' });

    await page.fill('#directionalLightIntensityValue', '6');
    syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#directionalLightIntensity').value,
        number: document.querySelector('#directionalLightIntensityValue').value
    }));
    assert.deepEqual(syncedValues, { range: '6', number: '6' });

    await page.locator('#cameraDistance').evaluate((control) => {
        control.value = '16';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#cameraDistance').value,
        number: document.querySelector('#cameraDistanceValue').value
    }));
    assert.deepEqual(syncedValues, { range: '16', number: '16' });

    await page.locator('#cameraAzimuthDeg').evaluate((control) => {
        control.value = '90';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    lightPositionState = await page.evaluate(() => ({
        cameraAzimuth: document.querySelector('#cameraAzimuthDeg').value,
        cameraAzimuthValue: document.querySelector('#cameraAzimuthDegValue').value,
        lightAzimuth: document.querySelector('#lightAzimuthDeg').value,
        lightAzimuthValue: document.querySelector('#lightAzimuthDegValue').value
    }));
    assert.deepEqual(lightPositionState, {
        cameraAzimuth: '90',
        cameraAzimuthValue: '90',
        lightAzimuth: '90',
        lightAzimuthValue: '90'
    });

    const cameraElevationBeforeDrag = await page.evaluate(() =>
        Number(document.querySelector('#cameraElevationDeg').value)
    );

    const canvasBox = await page.locator('#renderCanvas').boundingBox();
    assert.ok(canvasBox);

    await page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
        canvasBox.x + canvasBox.width / 2 + 40,
        canvasBox.y + canvasBox.height / 2 - 20
    );
    await page.mouse.up();

    lightPositionState = await page.evaluate(() => ({
        cameraAzimuth: Number(document.querySelector('#cameraAzimuthDeg').value),
        cameraAzimuthValue: Number(document.querySelector('#cameraAzimuthDegValue').value),
        cameraElevation: Number(document.querySelector('#cameraElevationDeg').value),
        cameraElevationValue: Number(document.querySelector('#cameraElevationDegValue').value),
        lightAzimuth: Number(document.querySelector('#lightAzimuthDeg').value),
        lightAzimuthValue: Number(document.querySelector('#lightAzimuthDegValue').value),
        lightElevation: Number(document.querySelector('#lightElevationDeg').value),
        lightElevationValue: Number(document.querySelector('#lightElevationDegValue').value)
    }));
    assert.deepEqual(lightPositionState, {
        cameraAzimuth: 76,
        cameraAzimuthValue: 76,
        cameraElevation: cameraElevationBeforeDrag - 7,
        cameraElevationValue: cameraElevationBeforeDrag - 7,
        lightAzimuth: 76,
        lightAzimuthValue: 76,
        lightElevation: cameraElevationBeforeDrag - 7,
        lightElevationValue: cameraElevationBeforeDrag - 7
    });

    await page.mouse.wheel(0, -100);
    syncedValues = await page.evaluate(() => ({
        range: document.querySelector('#cameraDistance').value,
        number: document.querySelector('#cameraDistanceValue').value
    }));
    assert.deepEqual(syncedValues, { range: '15.5', number: '15.5' });

    await page.uncheck('#lightFollowsCamera');
    lightPositionState = await page.evaluate(() => ({
        lightAzimuthDisabled: document.querySelector('#lightAzimuthDeg').disabled,
        lightAzimuthValueDisabled: document.querySelector('#lightAzimuthDegValue').disabled,
        lightElevationDisabled: document.querySelector('#lightElevationDeg').disabled,
        lightElevationValueDisabled: document.querySelector('#lightElevationDegValue').disabled
    }));
    assert.deepEqual(lightPositionState, {
        lightAzimuthDisabled: false,
        lightAzimuthValueDisabled: false,
        lightElevationDisabled: false,
        lightElevationValueDisabled: false
    });

    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-smoke.png'),
        fullPage: true
    });

    const readCanvasMetrics = async () => page.$eval('#renderCanvas', (canvas) => {
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        let darkPixels = 0;
        let nonBackgroundPixels = 0;
        let luminanceSum = 0;
        let luminanceCount = 0;

        gl.finish();
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            if (a === 0) {
                continue;
            }

            if (Math.abs(r - 246) > 5 || Math.abs(g - 247) > 5 || Math.abs(b - 249) > 5) {
                nonBackgroundPixels += 1;
                luminanceSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
                luminanceCount += 1;
            }

            if (r < 45 && g < 45 && b < 45) {
                darkPixels += 1;
            }
        }

        return {
            width: canvas.width,
            height: canvas.height,
            darkPixels,
            nonBackgroundPixels,
            averageLuminance: luminanceCount > 0 ? luminanceSum / luminanceCount : 0,
            hasJpgDataUrl: canvas.toDataURL('image/jpeg', 0.95)
                .startsWith('data:image/jpeg;base64,')
        };
    });

    let metrics = await readCanvasMetrics();
    assert.equal(metrics.width, 1200);
    assert.equal(metrics.height, 1200);
    assert.ok(metrics.nonBackgroundPixels > 1000);
    assert.ok(metrics.darkPixels > 50);
    assert.equal(metrics.hasJpgDataUrl, true);

    const rendererReuseState = await page.evaluate(async () => {
        const { DEFAULT_RENDER_OPTIONS, ThreeBlockRenderer } =
            await import('/modules/blockRenderer/src/core/index.mjs');
        const canvas = document.createElement('canvas');
        const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
        const block = {
            index: 1,
            size: { r: 2, c: 2, h: 2 },
            center: { r: 0.5, c: 0.5, h: 0.5 },
            cubes: [
                { r: 0, c: 0, h: 0 },
                { r: 0, c: 1, h: 0 },
                { r: 1, c: 0, h: 0 },
                { r: 1, c: 1, h: 1 }
            ]
        };

        renderer.render(block, DEFAULT_RENDER_OPTIONS);

        const initialBlockGroup = renderer.blockGroup;
        const initialBlockMaterial = renderer.blockMaterial;
        const initialEdgeOverlay = renderer.edgeOverlay;
        const initialEdgeMaterial = renderer.edgeMaterial;

        renderer.render(block, {
            ...DEFAULT_RENDER_OPTIONS,
            backgroundColor: '#ffffff',
            blockColor: '#ff0000',
            edgeColor: '#00ff00'
        });

        const colorOnlyState = {
            blockGroupReused: renderer.blockGroup === initialBlockGroup,
            blockMaterialReused: renderer.blockMaterial === initialBlockMaterial,
            edgeOverlayReused: renderer.edgeOverlay === initialEdgeOverlay,
            edgeMaterialReused: renderer.edgeMaterial === initialEdgeMaterial
        };

        renderer.render(block, {
            ...DEFAULT_RENDER_OPTIONS,
            cameraAzimuthDeg: 90
        });

        return {
            colorOnlyState,
            cameraState: {
                blockGroupReused: renderer.blockGroup === initialBlockGroup,
                edgeOverlayRebuilt: renderer.edgeOverlay !== initialEdgeOverlay
            }
        };
    });

    assert.deepEqual(rendererReuseState.colorOnlyState, {
        blockGroupReused: true,
        blockMaterialReused: true,
        edgeOverlayReused: true,
        edgeMaterialReused: true
    });
    assert.deepEqual(rendererReuseState.cameraState, {
        blockGroupReused: true,
        edgeOverlayRebuilt: true
    });

    await page.evaluate(() => {
        const originalClick = HTMLAnchorElement.prototype.click;
        window.__downloadClicks = [];
        window.__restoreAnchorClick = () => {
            HTMLAnchorElement.prototype.click = originalClick;
        };
        HTMLAnchorElement.prototype.click = function click() {
            window.__downloadClicks.push({
                download: this.download,
                href: this.href
            });
        };
    });
    await page.locator('#renderCanvas').evaluate((canvas) => canvas.focus());
    await page.keyboard.press('s');
    const downloadClicks = await page.evaluate(() => window.__downloadClicks);
    assert.equal(downloadClicks.length, 1);
    assert.match(downloadClicks[0].download, /^block-\d+\.jpg$/);
    assert.ok(downloadClicks[0].href.startsWith('data:image/jpeg;base64,'));
    await page.evaluate(() => window.__restoreAnchorClick());

    const litAverageLuminance = metrics.averageLuminance;
    await page.fill('#ambientLightIntensityValue', '0');
    await page.fill('#directionalLightIntensityValue', '0');
    metrics = await readCanvasMetrics();
    assert.ok(litAverageLuminance > metrics.averageLuminance + 20);

    await page.setViewportSize({ width: 390, height: 760 });
    layoutState = await readLayoutState();
    assert.equal(layoutState.pageScrollsVertically, false);
    assert.equal(layoutState.canvasInsideViewport, true);
    assert.equal(layoutState.canvasWidth, layoutState.canvasHeight);

    await page.click('#settingsCloseButton');
    layoutState = await readLayoutState();
    assert.equal(layoutState.panelAriaHidden, 'true');
    assert.equal(layoutState.openButtonHidden, false);
    assert.equal(layoutState.canvasInsideViewport, true);

    await page.screenshot({
        path: path.join(os.tmpdir(), 'block-generator-web-mobile-smoke.png'),
        fullPage: true
    });

    metrics = await readCanvasMetrics();
    assert.equal(metrics.width, 1200);
    assert.equal(metrics.height, 1200);
    assert.ok(metrics.nonBackgroundPixels > 1000);
    assert.equal(metrics.hasJpgDataUrl, true);
});
