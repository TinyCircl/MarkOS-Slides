import {MARKOS_WEB_ENGINE_NAME, markosWebRenderEngine} from "./markos-web/index.mjs";

export const DEFAULT_RENDER_ENGINE = MARKOS_WEB_ENGINE_NAME;

export function resolveRenderEngine(engineId = process.env.MARKOS_RENDER_ENGINE) {
    const normalizedEngineId = String(engineId || DEFAULT_RENDER_ENGINE).trim().toLowerCase();

    switch (normalizedEngineId) {
        case MARKOS_WEB_ENGINE_NAME:
            return markosWebRenderEngine;
        default:
            throw new Error(`Unsupported render engine: ${normalizedEngineId}`);
    }
}

export function getRenderEngine() {
    return resolveRenderEngine();
}
