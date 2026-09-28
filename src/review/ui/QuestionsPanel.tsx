import { useEffect, useRef } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { latestAnswer } from "../export";
import { pageLabel } from "../pages";
import type { Note, Question } from "../types";
import { Dot } from "./bits";
import { Panel } from "./Panel";
import { QuestionForm } from "./QuestionCard";

/** Every question Riley has asked, answerable in place, each with a way to its spot. */
export function QuestionsPanel({
  questions,
  notes,
  now,
  expanded,
  onExpand,
  onGoTo,
  onSave,
  onClose,
}: {
  questions: Question[];
  notes: Note[];
  now: number;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onGoTo: (question: Question) => void;
  onSave: (question: Question, choices: string[], text: string) => Promise<void>;
  onClose: () => void;
}) {
  const answered = questions.filter((q) => latestAnswer(notes, q.id)).length;
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!expanded) return;
    list.current?.querySelector(`[data-question="${CSS.escape(expanded)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [expanded]);

  return (
    <Panel
      id="rl-questions"
      title="Riley asks"
      sub={
        <span>
          {answered} of {questions.length} answered
        </span>
      }
      onClose={onClose}
    >
      <ol ref={list} className="rl-qlist">
        {questions.map((q) => {
          const answer = latestAnswer(notes, q.id);
          const open = expanded === q.id;
          return (
            <li key={q.id} className="rl-qitem" data-question={q.id} data-open={open || undefined}>
              <div className="rl-qitem-row">
                <button
                  type="button"
                  className="rl-qitem-toggle"
                  aria-expanded={open}
                  aria-controls={`rl-q-${q.id}`}
                  onClick={() => onExpand(open ? null : q.id)}
                >
                  <span className="rl-qitem-mark">
                    {answer ? (
                      <>
                        <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                        <span className="rl-sr">Answered.</span>
                      </>
                    ) : (
                      <Dot label="Not answered yet." />
                    )}
                  </span>
                  <span className="rl-qitem-text">
                    <span className="rl-qitem-title">{q.title}</span>
                    <span className="rl-qitem-meta">
                      {pageLabel(q.route)}
                      {answer ? ` · answered by ${answer.author.name}` : ""}
                    </span>
                  </span>
                  <ChevronDown className="rl-qitem-chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <button type="button" className="rl-btn rl-btn-ghost rl-goto" onClick={() => onGoTo(q)} aria-label={`Go to ${q.title}`}>
                  Go to <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              {open && (
                <div id={`rl-q-${q.id}`} className="rl-qitem-body">
                  <p className="rl-q-prompt">{q.prompt}</p>
                  <QuestionForm
                    key={answer?.id ?? "none"}
                    question={q}
                    answer={answer}
                    now={now}
                    onSave={(choices, text) => onSave(q, choices, text)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
