import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import {
    DEFAULT_RENDER_OPTIONS,
    IMAGE_SIZE,
    mergeRenderOptions
} from './renderConfig.mjs';

const MIN_AUTO_FIT_CLUSTER_SIZE = 3;

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function getMinimumAutoFitBaseSize(fitScale) {
    return Math.sqrt(3) * MIN_AUTO_FIT_CLUSTER_SIZE * fitScale;
}

function getBoundsDepthRange(bounds, target, viewDirection) {
    if (bounds.isEmpty()) {
        return { front: 0, back: 0 };
    }

    const centerOffset = bounds.getCenter(new THREE.Vector3()).sub(target);
    const halfSize = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const centerDepth = centerOffset.dot(viewDirection);
    const halfDepth =
        Math.abs(viewDirection.x) * halfSize.x +
        Math.abs(viewDirection.y) * halfSize.y +
        Math.abs(viewDirection.z) * halfSize.z;

    return {
        front: centerDepth + halfDepth,
        back: centerDepth - halfDepth
    };
}

function offsetFromAngles(distance, azimuthDeg, elevationDeg) {
    const azimuth = degreesToRadians(azimuthDeg);
    const elevation = degreesToRadians(elevationDeg);
    const horizontalDistance = distance * Math.cos(elevation);

    return new THREE.Vector3(
        horizontalDistance * Math.sin(azimuth),
        distance * Math.sin(elevation),
        horizontalDistance * Math.cos(azimuth)
    );
}

function blockCenterToVector(center) {
    return new THREE.Vector3(center.c, center.h, center.r);
}

function getFallbackCenter(cubes) {
    if (cubes.length === 0) {
        return new THREE.Vector3(0, 0, 0);
    }

    const bounds = new THREE.Box3();
    for (const cube of cubes) {
        bounds.expandByPoint(new THREE.Vector3(cube.c, cube.h, cube.r));
    }

    return bounds.getCenter(new THREE.Vector3());
}

function disposeGroup(group) {
    disposeObjectResources(group);
    group.clear();
}

function disposeObject(object) {
    if (!object) {
        return;
    }

    disposeObjectResources(object);

    if (object.parent) {
        object.parent.remove(object);
    }

    if (typeof object.clear === 'function') {
        object.clear();
    }
}

function disposeObjectResources(object) {
    const geometries = new Set();
    const materials = new Set();

    object.traverse((child) => {
        if (child.geometry) {
            geometries.add(child.geometry);
        }

        if (Array.isArray(child.material)) {
            for (const material of child.material) {
                materials.add(material);
            }
        } else if (child.material) {
            materials.add(child.material);
        }
    });

    for (const geometry of geometries) {
        geometry.dispose();
    }

    for (const material of materials) {
        material.dispose();
    }
}

function cubeKey(r, c, h) {
    return `${r},${c},${h}`;
}

function pointKey(point) {
    return `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
}

function edgeKey(start, end) {
    const startKey = pointKey(start);
    const endKey = pointKey(end);
    return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function getBlockGeometryKey(block) {
    const size = block.size
        ? `${block.size.r},${block.size.c},${block.size.h}`
        : '';
    const center = block.center
        ? `${block.center.r},${block.center.c},${block.center.h}`
        : '';
    const cubeKeys = block.cubes
        .map((cube) => `${cube.r},${cube.c},${cube.h}`)
        .join('|');

    return `${block.index ?? ''}|${size}|${center}|${cubeKeys}`;
}

function getCameraStateKey(options) {
    return [
        options.cameraDistance,
        options.cameraAzimuthDeg,
        options.cameraElevationDeg,
        options.fitScale
    ].join('|');
}

function getEdgeOverlayViewKey(options) {
    return [
        options.cameraAzimuthDeg,
        options.cameraElevationDeg
    ].join('|');
}

function getBlockTarget(block) {
    return block.center
        ? blockCenterToVector(block.center)
        : getFallbackCenter(block.cubes);
}

function addEdge(edges, edgeSet, start, end, offset) {
    const key = edgeKey(start, end);
    if (edgeSet.has(key)) {
        return;
    }

    edgeSet.add(key);
    edges.push(
        start.x + offset.x,
        start.y + offset.y,
        start.z + offset.z,
        end.x + offset.x,
        end.y + offset.y,
        end.z + offset.z
    );
}

function getFaceCorners(cube, axis, sign) {
    const minX = cube.c - 0.5;
    const maxX = cube.c + 0.5;
    const minY = cube.h - 0.5;
    const maxY = cube.h + 0.5;
    const minZ = cube.r - 0.5;
    const maxZ = cube.r + 0.5;

    if (axis === 'x') {
        const x = sign > 0 ? maxX : minX;
        return [
            new THREE.Vector3(x, minY, minZ),
            new THREE.Vector3(x, minY, maxZ),
            new THREE.Vector3(x, maxY, maxZ),
            new THREE.Vector3(x, maxY, minZ)
        ];
    }

    if (axis === 'y') {
        const y = sign > 0 ? maxY : minY;
        return [
            new THREE.Vector3(minX, y, minZ),
            new THREE.Vector3(maxX, y, minZ),
            new THREE.Vector3(maxX, y, maxZ),
            new THREE.Vector3(minX, y, maxZ)
        ];
    }

    const z = sign > 0 ? maxZ : minZ;
    return [
        new THREE.Vector3(minX, minY, z),
        new THREE.Vector3(maxX, minY, z),
        new THREE.Vector3(maxX, maxY, z),
        new THREE.Vector3(minX, maxY, z)
    ];
}

function buildVisibleEdgePositions(block, viewDirection) {
    const cubeSet = new Set(block.cubes.map((cube) => cubeKey(cube.r, cube.c, cube.h)));
    const edges = [];
    const edgeSet = new Set();
    const offset = viewDirection.clone().multiplyScalar(0.015);
    const faces = [
        { axis: 'x', sign: 1, delta: { r: 0, c: 1, h: 0 }, normal: new THREE.Vector3(1, 0, 0) },
        { axis: 'x', sign: -1, delta: { r: 0, c: -1, h: 0 }, normal: new THREE.Vector3(-1, 0, 0) },
        { axis: 'y', sign: 1, delta: { r: 0, c: 0, h: 1 }, normal: new THREE.Vector3(0, 1, 0) },
        { axis: 'y', sign: -1, delta: { r: 0, c: 0, h: -1 }, normal: new THREE.Vector3(0, -1, 0) },
        { axis: 'z', sign: 1, delta: { r: 1, c: 0, h: 0 }, normal: new THREE.Vector3(0, 0, 1) },
        { axis: 'z', sign: -1, delta: { r: -1, c: 0, h: 0 }, normal: new THREE.Vector3(0, 0, -1) }
    ];

    for (const cube of block.cubes) {
        for (const face of faces) {
            if (face.normal.dot(viewDirection) <= 0) {
                continue;
            }

            const neighborKey = cubeKey(
                cube.r + face.delta.r,
                cube.c + face.delta.c,
                cube.h + face.delta.h
            );
            if (cubeSet.has(neighborKey)) {
                continue;
            }

            const corners = getFaceCorners(cube, face.axis, face.sign);
            addEdge(edges, edgeSet, corners[0], corners[1], offset);
            addEdge(edges, edgeSet, corners[1], corners[2], offset);
            addEdge(edges, edgeSet, corners[2], corners[3], offset);
            addEdge(edges, edgeSet, corners[3], corners[0], offset);
        }
    }

    return edges;
}

export class ThreeBlockRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = mergeRenderOptions(options);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(IMAGE_SIZE, IMAGE_SIZE, false);

        this.blockGroup = new THREE.Group();
        this.lightTarget = new THREE.Object3D();
        this.ambientLight = new THREE.AmbientLight(
            0xffffff,
            this.options.ambientLightIntensity
        );
        this.directionalLight = new THREE.DirectionalLight(
            0xffffff,
            this.options.directionalLightIntensity
        );
        this.directionalLight.target = this.lightTarget;
        this.blockGeometryKey = null;
        this.cameraStateKey = null;
        this.edgeOverlayViewKey = null;
        this.blockMaterial = null;
        this.edgeMaterial = null;
        this.edgeOverlay = null;
        this.blockTarget = new THREE.Vector3();

        this.scene.add(this.blockGroup);
        this.scene.add(this.lightTarget);
        this.scene.add(this.ambientLight);
        this.scene.add(this.directionalLight);
    }

    render(block, options = {}) {
        this.options = mergeRenderOptions(options);
        this.renderer.setClearColor(this.options.backgroundColor, 1);

        if (this.canvas.width !== IMAGE_SIZE || this.canvas.height !== IMAGE_SIZE) {
            this.renderer.setSize(IMAGE_SIZE, IMAGE_SIZE, false);
        }

        const nextBlockGeometryKey = getBlockGeometryKey(block);
        const blockGeometryChanged = nextBlockGeometryKey !== this.blockGeometryKey;

        if (blockGeometryChanged) {
            this.rebuildBlockGroup(block);
            this.blockGeometryKey = nextBlockGeometryKey;
            this.blockTarget.copy(getBlockTarget(block));
            this.cameraStateKey = null;
            this.edgeOverlayViewKey = null;
        }

        const nextCameraStateKey = getCameraStateKey(this.options);
        if (nextCameraStateKey !== this.cameraStateKey) {
            this.updateCamera(this.blockTarget);
            this.cameraStateKey = nextCameraStateKey;
        }

        this.updateBlockMaterial();
        this.updateEdgeOverlay(block, this.blockTarget, blockGeometryChanged);
        this.updateLights(this.blockTarget);
        this.renderer.render(this.scene, this.camera);
    }

    rebuildBlockGroup(block) {
        disposeGroup(this.blockGroup);
        this.scene.remove(this.blockGroup);

        this.blockGroup = this.createBlockMeshGroup(block);
        this.edgeOverlay = null;
        this.edgeMaterial = null;
        this.scene.add(this.blockGroup);
    }

    createBlockMeshGroup(block) {
        const group = new THREE.Group();
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const blockMaterial = new THREE.MeshStandardMaterial({
            color: this.options.blockColor,
            roughness: 0.72,
            metalness: 0
        });
        this.blockMaterial = blockMaterial;

        for (const cube of block.cubes) {
            const position = new THREE.Vector3(cube.c, cube.h, cube.r);
            const mesh = new THREE.Mesh(boxGeometry, blockMaterial);

            mesh.position.copy(position);

            group.add(mesh);
        }

        return group;
    }

    createEdgeOverlay(block, target) {
        const viewDirection = this.camera.position.clone().sub(target).normalize();
        const positions = buildVisibleEdgePositions(block, viewDirection);
        const lineGeometry = new LineSegmentsGeometry();
        lineGeometry.setPositions(positions);

        const edgeMaterial = new LineMaterial({
            color: this.options.edgeColor,
            linewidth: this.options.edgeThickness,
            worldUnits: false
        });
        this.edgeMaterial = edgeMaterial;

        edgeMaterial.depthWrite = false;
        edgeMaterial.resolution.set(IMAGE_SIZE, IMAGE_SIZE);

        const edgeOverlay = new LineSegments2(lineGeometry, edgeMaterial);
        edgeOverlay.renderOrder = 10;
        return edgeOverlay;
    }

    updateBlockMaterial() {
        if (!this.blockMaterial) {
            return;
        }

        this.blockMaterial.color.set(this.options.blockColor);
    }

    updateEdgeMaterial() {
        if (!this.edgeMaterial) {
            return;
        }

        this.edgeMaterial.color.set(this.options.edgeColor);
        this.edgeMaterial.linewidth = this.options.edgeThickness;
        this.edgeMaterial.resolution.set(IMAGE_SIZE, IMAGE_SIZE);
    }

    updateEdgeOverlay(block, target, forceRebuild = false) {
        const nextEdgeOverlayViewKey = getEdgeOverlayViewKey(this.options);
        const shouldRebuild = forceRebuild ||
            !this.edgeOverlay ||
            nextEdgeOverlayViewKey !== this.edgeOverlayViewKey;

        if (shouldRebuild) {
            disposeObject(this.edgeOverlay);
            this.edgeOverlay = this.createEdgeOverlay(block, target);
            this.edgeOverlayViewKey = nextEdgeOverlayViewKey;
            this.blockGroup.add(this.edgeOverlay);
        }

        this.updateEdgeMaterial();
    }

    updateCamera(target) {
        const bounds = new THREE.Box3().setFromObject(this.blockGroup);
        const sphere = bounds.isEmpty()
            ? new THREE.Sphere(target, 1)
            : bounds.getBoundingSphere(new THREE.Sphere());
        const fittedBaseSize = sphere.radius * 2 * this.options.fitScale;
        const minimumBaseSize = getMinimumAutoFitBaseSize(this.options.fitScale);
        const baseSize = Math.max(fittedBaseSize, minimumBaseSize, 1);
        const distanceScale = this.options.cameraDistance /
            DEFAULT_RENDER_OPTIONS.cameraDistance;
        const viewSize = Math.max(baseSize * distanceScale, 1);
        const halfView = viewSize / 2;
        const viewDirection = offsetFromAngles(
            1,
            this.options.cameraAzimuthDeg,
            this.options.cameraElevationDeg
        );
        const depthRange = getBoundsDepthRange(bounds, target, viewDirection);
        const cameraPositionDistance = Math.max(
            this.options.cameraDistance,
            depthRange.front + this.options.cameraDistance
        );
        const farthestSurfaceDistance = cameraPositionDistance - depthRange.back;

        this.camera.left = -halfView;
        this.camera.right = halfView;
        this.camera.top = halfView;
        this.camera.bottom = -halfView;
        this.camera.near = 0.1;
        this.camera.far = Math.max(100, farthestSurfaceDistance + 1);
        this.camera.position.copy(target).addScaledVector(
            viewDirection,
            cameraPositionDistance
        );
        this.camera.lookAt(target);
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();
    }

    updateLights(target) {
        this.ambientLight.intensity = this.options.ambientLightIntensity;
        this.directionalLight.intensity = this.options.directionalLightIntensity;

        const lightOffset = this.options.lightFollowsCamera
            ? this.camera.position.clone().sub(target)
            : offsetFromAngles(
                this.options.lightDistance,
                this.options.lightAzimuthDeg,
                this.options.lightElevationDeg
            );

        this.lightTarget.position.copy(target);
        this.directionalLight.position.copy(target).add(lightOffset);
        this.directionalLight.target.updateMatrixWorld();
    }

    getJpegDataUrl(quality = 0.95) {
        return this.canvas.toDataURL('image/jpeg', quality);
    }

    downloadJpeg(filename = 'block-render.jpg', quality = 0.95) {
        const link = document.createElement('a');
        link.href = this.getJpegDataUrl(quality);
        link.download = filename;
        link.click();
    }
}
