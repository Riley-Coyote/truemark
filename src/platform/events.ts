import { LIVE } from "./mode";
import * as preview from "./preview/events";
import * as live from "./live/events";
export type { PlatformEvent } from "./preview/events";
export const emit = LIVE ? live.emit : preview.emit;
export const onPlatformEvent = LIVE ? live.onPlatformEvent : preview.onPlatformEvent;
