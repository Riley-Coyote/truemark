/**
 * The opening's room as files in public/: a graded still of the room, for wide and tall screens, and the sharper cut of
 * each (Rooms.tsx). Named once, here, because the page's head readies the still for the screen's shape before any of
 * the site's code has arrived (vite.config.ts), and it must ask for exactly the file the room shows.
 */
export const OPENING_MEDIA = {
  wide: { poster: "media/open-crisp.jpg", large: { poster: "media/open-crisp-4k.jpg" } },
  tall: { poster: "media/open-phone-crisp.jpg", large: { poster: "media/open-phone-crisp-4k.jpg" } },
} as const;

/** The screens that see the tall cut, with its middle three pedestals: a phone held upright (MistOpening.tsx, flight.ts,
 *  Product.tsx). Every other window, a desktop's of any shape or a tablet's, sees all five. */
export const TALL_SCREEN = "(max-width: 560px) and (max-aspect-ratio: 11/10)";
