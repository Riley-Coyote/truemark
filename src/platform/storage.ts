import { LIVE } from "./mode";
import * as preview from "./preview/storage";
import * as live from "./live/storage";
export const STORE_CHANGE = LIVE ? live.STORE_CHANGE : preview.STORE_CHANGE;
export const read = LIVE ? live.read : preview.read;
export const write = LIVE ? live.write : preview.write;
export const worldNow = LIVE ? live.worldNow : preview.worldNow;
