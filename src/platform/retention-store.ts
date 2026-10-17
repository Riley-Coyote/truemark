import { LIVE } from './mode';
import { live } from './live/runtime';
import { createPreviewRetention } from './preview/retention';
export function retentionStore(scope = '') { return LIVE ? live().retention : createPreviewRetention(scope); }
