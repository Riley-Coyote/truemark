/* The floor mist: the simulation (fog.ts), its rooms (scenes.ts) and the opening's layer (FloorMist.tsx). */
export { createFog, FOG_SCENES, fogTop } from "./fog";
export type { Fog, FogFallback, FogOptions, FogParams, FogPedestal, FogRegion, FogScene, FogStats } from "./fog";
export { FOCUS, focusMask } from "./scenes";
export { FloorMist } from "./FloorMist";
