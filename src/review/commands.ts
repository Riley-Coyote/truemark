/**
 * A small line from the rest of the site into the review layer (which loads on its own).
 * A command sent before the layer is ready waits for it.
 */
export type ReviewCommand = { type: "start" };

let handler: ((command: ReviewCommand) => void) | null = null;
let pending: ReviewCommand | null = null;

/** Open the welcome, or comment mode when the viewer is already known. */
export function startReviewing() {
  const command: ReviewCommand = { type: "start" };
  if (handler) handler(command);
  else pending = command;
}

export function connectCommands(next: (command: ReviewCommand) => void): () => void {
  handler = next;
  if (pending) {
    const waiting = pending;
    pending = null;
    next(waiting);
  }
  return () => {
    if (handler === next) handler = null;
  };
}
