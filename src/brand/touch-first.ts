/**
 * Whether the home page below the opening behaves as on a phone or a tablet (Procession.tsx's native carousel and flat
 * wall): a narrow window, or a device whose main pointer is a finger (coarse, and it can't hover). A
 * touchscreen laptop's main pointer is its trackpad or mouse (fine, and it hovers), so it has the desktop page, though
 * its screen takes a finger too: "(any-pointer: coarse)" is true there, and once gave it the phone's page.
 */
export const TOUCH_FIRST = "(max-width: 700px), (pointer: coarse) and (hover: none)";
