/** The project presentation shares this Pages host; live store paths remain independent. */
export const studioHref = import.meta.env.DEV
  ? "http://127.0.0.1:5290/design-lab/universe/index.html"
  : `${new URL(import.meta.env.BASE_URL, location.href).pathname.replace(/(?:live|launch|studio)\/$/, "")}studio/`;
