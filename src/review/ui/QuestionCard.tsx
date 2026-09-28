import { useId, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { answerText } from "../export";
import type { Note, Question } from "../types";
import { AuthorLine, Dot, useAutosize, usePhone } from "./bits";
import { Float } from "./Float";

/** One of Riley's questions: its choices and a text field, or the answer given and who gave it. */
export function QuestionForm({
  question,
  answer,
  now,
  onSave,
  autoFocus = false,
}: {
  question: Question;
  answer: Note | null;
  now: number;
  onSave: (choices: string[], text: string) => Promise<void>;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [changing, setChanging] = useState(false);
  const [choices, setChoices] = useState<string[]>(answer?.answer?.choices ?? []);
  const [text, setText] = useState(answer?.answer?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useAutosize(area, text);

  const editing = !answer || changing;
  const hasChoices = Boolean(question.choices?.length);
  const valid = hasChoices ? choices.length > 0 : text.trim().length > 0;

  function toggle(choice: string) {
    if (question.multiple) setChoices((now) => (now.includes(choice) ? now.filter((c) => c !== choice) : [...now, choice]));
    else setChoices([choice]);
  }

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSave(choices, text.trim());
      setChanging(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!editing && answer) {
    return (
      <div className="rl-answer">
        <div className="rl-answer-box">
          <p className="rl-answer-label">Answer</p>
          <p className="rl-answer-text">{answerText(answer)}</p>
          <AuthorLine author={answer.author} iso={answer.createdAt} now={now} />
        </div>
        <button
          type="button"
          className="rl-btn"
          onClick={() => {
            setChoices(answer.answer?.choices ?? []);
            setText(answer.answer?.text ?? "");
            setChanging(true);
          }}
        >
          Change answer
        </button>
      </div>
    );
  }

  return (
    <form
      className="rl-qform"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {hasChoices && (
        <fieldset className="rl-choices">
          <legend className="rl-sr">{question.multiple ? "Choose any that apply" : "Choose one"}</legend>
          {question.choices!.map((choice, i) => {
            const checked = choices.includes(choice);
            return (
              <label key={choice} className="rl-choice" data-checked={checked || undefined}>
                <input
                  className="rl-choice-input"
                  type={question.multiple ? "checkbox" : "radio"}
                  name={`${id}-choice`}
                  value={choice}
                  checked={checked}
                  autoFocus={autoFocus && i === 0}
                  onChange={() => toggle(choice)}
                />
                <span className={question.multiple ? "rl-mark rl-mark-box" : "rl-mark"} aria-hidden="true" />
                <span>{choice}</span>
              </label>
            );
          })}
          {question.multiple && <p className="rl-note-line">Choose any that apply.</p>}
        </fieldset>
      )}
      {question.allowText && (
        <>
          <label className="rl-sr" htmlFor={`${id}-text`}>
            {question.placeholder ?? "Your answer"}
          </label>
          <textarea
            ref={area}
            id={`${id}-text`}
            className="rl-textarea"
            rows={2}
            maxLength={4000}
            placeholder={question.placeholder}
            value={text}
            autoFocus={autoFocus && !hasChoices}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void save();
              }
            }}
          />
        </>
      )}
      {failed && (
        <p className="rl-error" role="alert">
          That didn’t save. Try again.
        </p>
      )}
      <div className="rl-qform-foot">
        {changing && (
          <button type="button" className="rl-btn rl-btn-ghost" onClick={() => setChanging(false)}>
            Keep answer
          </button>
        )}
        <button type="submit" className="rl-btn rl-btn-primary" disabled={!valid || busy}>
          {busy ? "Saving…" : "Save answer"}
        </button>
      </div>
    </form>
  );
}

/** The question beside its "?" pin (or docked, or as a sheet on phones). */
export function QuestionPopover({
  question,
  answer,
  pinKey,
  now,
  onSave,
  onClose,
  onOpenAll,
}: {
  question: Question;
  answer: Note | null;
  pinKey: string | null;
  now: number;
  onSave: (choices: string[], text: string) => Promise<void>;
  onClose: () => void;
  onOpenAll: () => void;
}) {
  // On phones the keyboard would cover the question; let the reader choose where to start.
  const phone = usePhone();
  return (
    <Float pinKey={pinKey} label={`Riley asks: ${question.title}`} className="rl-question">
      <div className="rl-card-head">
        <p className="rl-eyebrow">
          Riley asks
          {!answer && <Dot label="Not answered yet" />}
        </p>
        <button type="button" className="rl-icon-btn" aria-label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="rl-card-body">
        <div className="rl-q-head">
          <h2 className="rl-q-title">{question.title}</h2>
          <p className="rl-q-prompt">{question.prompt}</p>
        </div>
        <QuestionForm key={answer?.id ?? "none"} question={question} answer={answer} now={now} onSave={onSave} autoFocus={!phone} />
      </div>
      <div className="rl-card-foot rl-card-foot-quiet">
        <button type="button" className="rl-textbtn" onClick={onOpenAll}>
          All of Riley’s questions <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </Float>
  );
}
