export const IMAGE_SIZE = 1200;

export const DEFAULT_RENDER_OPTIONS = Object.freeze({
    backgroundColor: '#f6f7f9',
    blockColor: '#c0aa81',
    edgeColor: '#000000',
    edgeThickness: 4,
    cameraDistance: 12,
    cameraAzimuthDeg: 45,
    cameraElevationDeg: 25,
    fitScale: 1.35,
    ambientLightIntensity: 0.25,
    directionalLightIntensity: 4.0,
    lightFollowsCamera: true,
    lightDistance: 12,
    lightAzimuthDeg: 45,
    lightElevationDeg: 25
});

export function mergeRenderOptions(options = {}) {
    return {
        ...DEFAULT_RENDER_OPTIONS,
        ...options
    };
}
