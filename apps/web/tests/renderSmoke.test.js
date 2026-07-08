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
    await page.click('#startButton');
    await page.waitForFunction(
        () => document.querySelector('#status')?.textContent.includes('Generated'),
        null,
        { timeout: 30000 }
    );

    let blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

    await page.click('#nextButton');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '2 / 300');

    await page.click('#prevButton');
    blockPositionText = await page.textContent('#blockPosition');
    assert.equal(blockPositionText, '1 / 300');

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
    assert.deepEqual(lightPositionState, {
        followsCamera: true,
        lightAzimuthDisabled: true,
        lightAzimuthValueDisabled: true,
        lightElevationDisabled: true,
        lightElevationValueDisabled: true,
        cameraAzimuth: '45',
        cameraElevation: '25',
        lightAzimuth: '45',
        lightElevation: '25'
    });

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

    const litAverageLuminance = metrics.averageLuminance;
    await page.fill('#ambientLightIntensityValue', '0');
    await page.fill('#directionalLightIntensityValue', '0');
    metrics = await readCanvasMetrics();
    assert.ok(litAverageLuminance > metrics.averageLuminance + 20);
});
