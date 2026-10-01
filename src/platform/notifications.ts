import { LIVE } from "./mode";
import * as preview from "./preview/notifications";
import * as live from "./live/notifications";
export type { Audience, Notice, NoticeKind } from "./preview/notifications";
export const notices = LIVE ? live.notices : preview.notices;
export const useNotices = LIVE ? live.useNotices : preview.useNotices;
