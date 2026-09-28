import { ChevronDown, CircleHelp, MessageSquare, MessageSquarePlus, MessagesSquare } from "lucide-react";
import type { Person } from "../types";
import { Avatar, Dot } from "./bits";

/** The review tools, floating at the foot of every page. */
export function Dock({
  collapsed,
  commenting,
  panel,
  unanswered,
  openNotes,
  questionsNew,
  notesNew,
  people,
  phone,
  onComment,
  onQuestions,
  onNotes,
  onCollapse,
  onExpand,
}: {
  collapsed: boolean;
  commenting: boolean;
  panel: "notes" | "questions" | null;
  unanswered: number;
  openNotes: number;
  questionsNew: boolean;
  notesNew: boolean;
  /** Everyone here now, live mode only; empty otherwise. */
  people: Person[];
  phone: boolean;
  onComment: () => void;
  onQuestions: () => void;
  onNotes: () => void;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  if (collapsed) {
    return (
      <button type="button" className="rl-dock-pill" onClick={onExpand} aria-label={`Show the review tools${questionsNew || notesNew ? ", something new" : ""}`}>
        <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
        <span>Review</span>
        {(questionsNew || notesNew) && <Dot />}
      </button>
    );
  }

  const shown = people.slice(0, 3);
  return (
    <div className="rl-dock" role="toolbar" aria-label="Review tools">
      <button
        type="button"
        className="rl-dock-btn rl-dock-comment"
        aria-pressed={commenting}
        aria-keyshortcuts="C"
        aria-label={commenting ? "Stop commenting" : "Comment"}
        onClick={onComment}
      >
        <MessageSquarePlus size={16} strokeWidth={1.5} aria-hidden="true" />
        {!phone && <span className="rl-dock-label">Comment</span>}
        {!phone && (
          <kbd className="rl-kbd" aria-hidden="true">
            C
          </kbd>
        )}
      </button>
      <span className="rl-dock-sep" aria-hidden="true" />
      <button
        type="button"
        className="rl-dock-btn"
        aria-expanded={panel === "questions"}
        aria-controls="rl-questions"
        aria-label={`Questions, ${unanswered} unanswered${questionsNew ? ", new" : ""}`}
        onClick={onQuestions}
      >
        <span className="rl-icon-wrap">
          <CircleHelp size={16} strokeWidth={1.5} aria-hidden="true" />
          {questionsNew && <Dot />}
        </span>
        {!phone && <span className="rl-dock-label">Questions</span>}
        <span className="rl-count" aria-hidden="true">
          {unanswered}
        </span>
      </button>
      <button
        type="button"
        className="rl-dock-btn"
        aria-expanded={panel === "notes"}
        aria-controls="rl-notes"
        aria-label={`Notes, ${openNotes} open${notesNew ? ", new" : ""}`}
        onClick={onNotes}
      >
        <span className="rl-icon-wrap">
          <MessagesSquare size={16} strokeWidth={1.5} aria-hidden="true" />
          {notesNew && <Dot />}
        </span>
        {!phone && <span className="rl-dock-label">Notes</span>}
        <span className="rl-count" aria-hidden="true">
          {openNotes}
        </span>
      </button>
      {shown.length > 0 && (
        <>
          <span className="rl-dock-sep" aria-hidden="true" />
          <div className="rl-people" role="group" aria-label={`Here now: ${people.map((p) => p.name).join(", ")}`}>
            {shown.map((person) => (
              <span key={person.id} className="rl-person" title={person.name}>
                <Avatar person={person} />
              </span>
            ))}
            {people.length > shown.length && <span className="rl-people-more">+{people.length - shown.length}</span>}
            <span className="rl-live-dot" aria-hidden="true" />
          </div>
        </>
      )}
      <span className="rl-dock-sep" aria-hidden="true" />
      <button type="button" className="rl-dock-btn rl-dock-icon" aria-label="Hide the review tools" onClick={onCollapse}>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
