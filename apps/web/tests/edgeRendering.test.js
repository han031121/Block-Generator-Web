const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { chromium } = require('../../../modules/blockRenderer/node_modules/playwright-core');

const { startServer } = require('../src/server');

const EDGE_PATH = process.env.PLAYWRIGHT_EDGE_PATH ??
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('keeps thick edges visible at folded block corners', {
    skip: fs.existsSync(EDGE_PATH) ? false : `Edge executable not found: ${EDGE_PATH}`
}, async (t) => {
    const { server, port } = await startServer(5230);
    t.after(() => server.close());

    const browser = await chromium.launch({
        executablePath: EDGE_PATH,
        headless: true
    });
    t.after(() => browser.close());

    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });

    const metrics = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        document.body.replaceChildren(canvas);

        const { DEFAULT_RENDER_OPTIONS, ThreeBlockRenderer } = await import(
            '/modules/blockRenderer/src/core/index.mjs'
        );
        const THREE = await import('three');
        const renderer = new ThreeBlockRenderer(canvas, DEFAULT_RENDER_OPTIONS);
        const block = {
            index: 0,
            size: { r: 2, c: 2, h: 2 },
            center: { r: 0.5, c: 0.5, h: 0.5 },
            cubes: [
                { r: 0, c: 0, h: 0 },
                { r: 0, c: 0, h: 1 },
                { r: 0, c: 1, h: 0 },
                { r: 1, c: 0, h: 0 },
                { r: 1, c: 0, h: 1 },
                { r: 1, c: 1, h: 0 }
            ]
        };

        renderer.render(block, {
            ...DEFAULT_RENDER_OPTIONS,
            edgeThickness: 12,
            cameraAzimuthDeg: 35,
            cameraElevationDeg: 25
        });

        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.finish();
        gl.readPixels(
            0,
            0,
            canvas.width,
            canvas.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
        );

        const starts = renderer.edgeOverlay.geometry.attributes.instanceStart;
        const ends = renderer.edgeOverlay.geometry.attributes.instanceEnd;
        const overlayOffset = renderer.edgeOverlay.position;
        const project = (point) => {
            const projected = point.clone()
                .add(overlayOffset)
                .project(renderer.camera);

            return {
                x: (projected.x + 1) * canvas.width / 2,
                y: (1 - projected.y) * canvas.height / 2
            };
        };
        const strokeWidths = [];

        for (let index = 0; index < starts.count; index += 1) {
            const start = new THREE.Vector3().fromBufferAttribute(starts, index);
            const end = new THREE.Vector3().fromBufferAttribute(ends, index);
            const projectedStart = project(start);
            const projectedEnd = project(end);
            const dx = projectedEnd.x - projectedStart.x;
            const dy = projectedEnd.y - projectedStart.y;
            const length = Math.hypot(dx, dy);
            const normalX = -dy / length;
            const normalY = dx / length;
            const middleX = (projectedStart.x + projectedEnd.x) / 2;
            const middleY = (projectedStart.y + projectedEnd.y) / 2;
            let currentRun = 0;
            let longestRun = 0;

            for (let offset = -18; offset <= 18; offset += 1) {
                const x = Math.round(middleX + normalX * offset);
                const y = Math.round(middleY + normalY * offset);
                const pixelIndex = ((canvas.height - 1 - y) * canvas.width + x) * 4;
                const isEdgePixel = pixels[pixelIndex] < 45 &&
                    pixels[pixelIndex + 1] < 45 &&
                    pixels[pixelIndex + 2] < 45;

                if (isEdgePixel) {
                    currentRun += 1;
                    longestRun = Math.max(longestRun, currentRun);
                } else {
                    currentRun = 0;
                }
            }

            strokeWidths.push(longestRun);
        }

        return {
            materialWidth: renderer.edgeMaterial.linewidth,
            minimumStrokeWidth: Math.min(...strokeWidths),
            maximumStrokeWidth: Math.max(...strokeWidths)
        };
    });

    assert.equal(metrics.materialWidth, 12);
    assert.ok(metrics.minimumStrokeWidth >= 7, JSON.stringify(metrics));
    assert.ok(metrics.maximumStrokeWidth <= 12, JSON.stringify(metrics));
});
