export const IMAGE_SIZE = 1200;

export const DEFAULT_RENDER_OPTIONS = Object.freeze({
    backgroundColor: '#f6f7f9',
    blockColor: '#c0aa81',
    edgeColor: '#000000',
    edgeThickness: 4,
    cameraDistance: 12,
    cameraAzimuthDeg: 35,
    cameraElevationDeg: 25,
    fitScale: 1.35,
    ambientLightIntensity: 0.15,
    directionalLightIntensity: 4.0,
    lightFollowsCamera: false,
    lightDistance: 12,
    lightAzimuthDeg: 30,
    lightElevationDeg: 20
});

export function mergeRenderOptions(options = {}) {
    return {
        ...DEFAULT_RENDER_OPTIONS,
        ...options
    };
}
