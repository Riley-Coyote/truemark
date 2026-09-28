/**
 * The review layer's shapes. A note is anything a reviewer leaves: a comment pinned to a
 * spot, a note about a whole page, a reply in a thread, or an answer to one of Riley's
 * questions. Both storage adapters (this device, or Supabase) speak these shapes.
 */

export type NoteKind = "comment" | "page" | "reply" | "answer";
export type NoteStatus = "open" | "resolved";
export type Category = "change" | "missing" | "question" | "love";
export type AuthorKind = "client" | "designer";
export type Breakpoint = "desktop" | "mobile";

/** Where a comment was left: the element, and the click point as fractions of its box. */
export type Anchor = {
  selector: string;
  dx: number;
  dy: number;
  /** The element's text when the note was left; used to find it again if the page changes. */
  text: string;
  viewport: { w: number; h: number };
  breakpoint: Breakpoint;
};

export type Author = {
  id: string;
  name: string;
  role?: string;
  kind: AuthorKind;
};

export type Answer = { choices: string[]; text?: string };

export type Note = {
  id: string;
  project: string;
  kind: NoteKind;
  threadId?: string;
  questionId?: string;
  route: string;
  pageTitle: string;
  anchor?: Anchor;
  body: string;
  category?: Category;
  answer?: Answer;
  author: Author;
  status: NoteStatus;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

/** What a caller supplies; the store adds the id, project and times. */
export type NewNote = Omit<Note, "id" | "project" | "createdAt" | "updatedAt"> & { id?: string };

/** What may change after a note is written: resolving or reopening it. `null` clears. */
export type NotePatch = {
  status: NoteStatus;
  resolvedBy?: string | null;
};

/** A shared store's connection: "live" once the notes have loaded and the channel has joined. */
export type LiveState = "connecting" | "live";

export type Identity = Author;

/** Someone with the preview open right now (live mode only). */
export type Person = {
  id: string;
  name: string;
  role?: string;
  kind: AuthorKind;
  /** The page they are on. */
  route: string;
};

export type PresenceHandle = {
  /** Tell everyone the viewer moved to another page. */
  move(route: string): void;
  leave(): void;
};

export interface ReviewStore {
  readonly mode: "local" | "supabase";
  list(): Promise<Note[]>;
  /** Calls `onChange` with every note whenever anything changes, here or elsewhere. */
  subscribe(onChange: (notes: Note[]) => void): () => void;
  add(note: NewNote): Promise<Note>;
  update(id: string, patch: NotePatch): Promise<Note | null>;
  presence?(me: Identity, route: string, onPeople: (people: Person[]) => void): PresenceHandle;
  /** Shared stores: hear where the connection stands (and once now). */
  state?(onChange: (state: LiveState) => void): () => void;
  /** Shared stores: leave the live channel. */
  close?(): void;
}

export type Question = {
  /** Also the `data-review` anchor where the question belongs. */
  id: string;
  route: string;
  title: string;
  prompt: string;
  choices?: string[];
  multiple?: boolean;
  allowText: boolean;
  placeholder?: string;
};
