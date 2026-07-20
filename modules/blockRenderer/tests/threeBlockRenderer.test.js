const assert = require('node:assert/strict');
const test = require('node:test');

const THREE = require('three');

async function createCameraFixture({
    size,
    target = new THREE.Vector3(),
    cameraDistance = 12,
    cameraAzimuthDeg = 35,
    cameraElevationDeg = 25
}) {
    const { DEFAULT_RENDER_OPTIONS, ThreeBlockRenderer } = await import(
        '../src/core/index.mjs'
    );
    const blockGroup = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
    blockGroup.add(mesh);

    const fixture = {
        blockGroup,
        camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000),
        options: {
            ...DEFAULT_RENDER_OPTIONS,
            cameraDistance,
            cameraAzimuthDeg,
            cameraElevationDeg
        }
    };

    ThreeBlockRenderer.prototype.updateCamera.call(fixture, target);
    return { fixture, target, DEFAULT_RENDER_OPTIONS };
}

function getSurfaceDistances(fixture, target) {
    const bounds = new THREE.Box3().setFromObject(fixture.blockGroup);
    const viewDirection = fixture.camera.position.clone().sub(target).normalize();
    const cameraDistance = fixture.camera.position.distanceTo(target);
    const corners = [];

    for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
                corners.push(new THREE.Vector3(x, y, z));
            }
        }
    }

    const depths = corners.map((corner) =>
        cameraDistance - corner.clone().sub(target).dot(viewDirection)
    );

    return {
        nearest: Math.min(...depths),
        farthest: Math.max(...depths)
    };
}

test('keeps the camera outside a large block without changing its fitted scale', async () => {
    const size = [13, 13, 13];
    const cameraDistance = 6;
    const { fixture, target, DEFAULT_RENDER_OPTIONS } = await createCameraFixture({
        size,
        cameraDistance
    });
    const bounds = new THREE.Box3().setFromObject(fixture.blockGroup);
    const surfaceDistances = getSurfaceDistances(fixture, target);
    const radius = Math.sqrt(13 ** 2 * 3) / 2;
    const expectedViewSize = radius * 2 * DEFAULT_RENDER_OPTIONS.fitScale *
        cameraDistance / DEFAULT_RENDER_OPTIONS.cameraDistance;

    assert.equal(bounds.containsPoint(fixture.camera.position), false);
    assert.ok(Math.abs(surfaceDistances.nearest - cameraDistance) < 1e-10);
    assert.ok(Math.abs(fixture.camera.right - fixture.camera.left - expectedViewSize) < 1e-10);
    assert.ok(surfaceDistances.nearest > fixture.camera.near);
    assert.ok(surfaceDistances.farthest < fixture.camera.far);
});

test('keeps an off-center target and the full block in front of the camera', async () => {
    const target = new THREE.Vector3(-20, 4, 7);
    const cameraDistance = 12;
    const { fixture } = await createCameraFixture({
        size: [40, 25, 70],
        target,
        cameraDistance,
        cameraAzimuthDeg: 225,
        cameraElevationDeg: 15
    });
    const surfaceDistances = getSurfaceDistances(fixture, target);

    assert.ok(surfaceDistances.nearest >= cameraDistance - 1e-10);
    assert.ok(surfaceDistances.nearest > fixture.camera.near);
    assert.ok(surfaceDistances.farthest < fixture.camera.far);
});
