/*
 * The room's living parts, lent between pages. The collection's room is one room whichever page shows it: the opening
 * sees all of it, a product page sees one of its pedestals up close. Its loop (a <video>) and its floor mist (a WebGL
 * canvas with its air) each exist once and are drawn in one place at a time, carried from the opening's plate into the
 * product's as the camera settles there, and back as the camera pulls out (flight.ts), so the room never changes:
 * the same frame of the same loop, the same mist, in the same air.
 *
 * Each part keeps its own owner (Rooms.tsx RoomLoop, fog/FloorMist.tsx). A host whose page comes in while another
 * page shows the part waits; the part goes to it when the camera hands the room over (claimRoom), or when the page
 * that showed it leaves.
 */

type Claimant = { node: Element; claim: () => void };
const claimants = new Set<Claimant>();

/** A host that may be given a shared part: `claim` brings the part into it. Returns the host's unregistration. */
export function registerClaimant(node: Element, claim: () => void) {
  const entry = { node, claim };
  claimants.add(entry);
  return () => { claimants.delete(entry); };
}

/** Bring every shared part of the room into the hosts within `container` (a page's view slot). */
export function claimRoom(container: Element | null | undefined) {
  if (!container) return;
  for (const entry of [...claimants]) if (container.contains(entry.node)) entry.claim();
}

/** Move a node into a host, keeping its state where the browser can (a playing video, a canvas's frame). */
export function moveInto(host: Element, node: Element) {
  if (node.parentNode === host) return;
  const atomic = (host as Element & { moveBefore?: (node: Node, child: Node | null) => void }).moveBefore;
  if (typeof atomic === "function" && host.isConnected && node.isConnected) {
    try {
      atomic.call(host, node, null);
      return;
    } catch {
      /* not movable atomically here: moved the ordinary way below */
    }
  }
  host.appendChild(node);
}
