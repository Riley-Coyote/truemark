import { useMemo, useState } from "react";
import { Copy, Download, FilePlus2, Search } from "lucide-react";
import { categoryLabel } from "../export";
import { pageLabel } from "../pages";
import type { ReviewStatus } from "../status";
import type { Identity, Note, Person } from "../types";
import { Dot, When } from "./bits";
import { Panel } from "./Panel";

export type NotesFilter = "open" | "resolved" | "all";

function matches(note: Note, replies: Note[], query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [note.body, note.author.name, note.pageTitle, note.route, ...replies.flatMap((r) => [r.body, r.author.name])].some((text) =>
    text.toLowerCase().includes(q),
  );
}

/** Every thread, grouped by page: filter, search, open one, and (for Riley) export a brief. */
export function NotesPanel({
  threads,
  replies,
  numberOf,
  unread,
  moved,
  isHere,
  status,
  notice,
  people,
  me,
  now,
  filter,
  onFilter,
  showResolved,
  onShowResolved,
  onOpen,
  onPageNote,
  onChangeName,
  onLeaveDesigner,
  onCopyBrief,
  onDownloadBrief,
  onClose,
}: {
  threads: Note[];
  replies: (id: string) => Note[];
  numberOf: (note: Note) => number | null;
  unread: (note: Note) => boolean;
  moved: Set<string>;
  isHere: (route: string) => boolean;
  status: ReviewStatus;
  /** Why notes stay on this device, when the build could share them. */
  notice: string | null;
  people: Person[];
  me: Identity;
  now: number;
  filter: NotesFilter;
  onFilter: (filter: NotesFilter) => void;
  showResolved: boolean;
  onShowResolved: (show: boolean) => void;
  onOpen: (note: Note) => void;
  onPageNote: () => void;
  onChangeName: () => void;
  onLeaveDesigner: () => void;
  onCopyBrief: () => Promise<boolean>;
  onDownloadBrief: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => {
    const shown = threads.filter(
      (t) => (filter === "all" || t.status === filter) && matches(t, replies(t.id), query.trim()),
    );
    const byRoute = new Map<string, Note[]>();
    for (const t of shown) byRoute.set(t.route, [...(byRoute.get(t.route) ?? []), t]);
    const latest = (list: Note[]) =>
      list.reduce((max, t) => {
        const last = replies(t.id).at(-1)?.createdAt ?? t.createdAt;
        return last > max ? last : max;
      }, "");
    return Array.from(byRoute.entries())
      .map(([route, list]) => ({ route, title: list[0].pageTitle, list, here: isHere(route), latest: latest(list) }))
      .sort((a, b) => Number(b.here) - Number(a.here) || b.latest.localeCompare(a.latest));
  }, [threads, replies, filter, query, isHere]);

  const counts = {
    open: threads.filter((t) => t.status === "open").length,
    resolved: threads.filter((t) => t.status === "resolved").length,
    all: threads.length,
  };

  const live = (
    <>
      {status === "live" ? (
        <span className="rl-live">
          <span className="rl-live-dot" aria-hidden="true" />
          Live
          {people.length > 0 && (
            <span className="rl-live-people">
              {" · "}
              {people.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  {p.name} <span className="rl-live-where">on {pageLabel(p.route)}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      ) : (
        <span className="rl-live rl-live-local">
          <span className="rl-live-dot" aria-hidden="true" />
          {status === "connecting" ? "Connecting…" : "On this device only"}
        </span>
      )}
      {notice && <span className="rl-notice">{notice}</span>}
    </>
  );

  return (
    <Panel
      id="rl-notes"
      title="Notes"
      sub={live}
      onClose={onClose}
      foot={
        <>
          {me.kind === "designer" && (
            <div className="rl-export">
              <button
                type="button"
                className="rl-btn"
                onClick={async () => {
                  if (await onCopyBrief()) {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                <span aria-live="polite">{copied ? "Brief copied" : "Copy as a brief"}</span>
              </button>
              <button type="button" className="rl-btn" onClick={onDownloadBrief}>
                <Download size={14} strokeWidth={1.75} aria-hidden="true" />
                Download .md
              </button>
            </div>
          )}
          <div className="rl-whoami">
            <span className="rl-whoami-text">
              Reviewing as <span className="rl-whoami-name">{me.name}</span>
              {me.kind === "designer" ? " · Designer mode" : me.role ? ` · ${me.role}` : ""}
            </span>
            {me.kind === "designer" ? (
              <button type="button" className="rl-textbtn" onClick={onLeaveDesigner}>
                Leave designer mode
              </button>
            ) : (
              <button type="button" className="rl-textbtn" onClick={onChangeName}>
                Change
              </button>
            )}
          </div>
        </>
      }
    >
      <div className="rl-tools">
        <div className="rl-seg" role="group" aria-label="Show">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button key={f} type="button" className="rl-seg-btn" aria-pressed={filter === f} onClick={() => onFilter(f)}>
              {f === "open" ? "Open" : f === "resolved" ? "Resolved" : "All"}
              <span className="rl-seg-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="rl-search">
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="rl-sr">Search notes</span>
          <input type="search" className="rl-search-input" placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="rl-tools-row">
          <button type="button" className="rl-btn" onClick={onPageNote}>
            <FilePlus2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Note about this page
          </button>
          <button
            type="button"
            className="rl-switch"
            role="switch"
            aria-checked={showResolved}
            onClick={() => onShowResolved(!showResolved)}
          >
            <span className="rl-switch-track" aria-hidden="true">
              <span className="rl-switch-thumb" />
            </span>
            Show resolved
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rl-empty">
          {query.trim() ? (
            <p>No notes match “{query.trim()}”.</p>
          ) : filter === "resolved" ? (
            <p>Nothing resolved yet.</p>
          ) : filter === "open" && counts.resolved > 0 ? (
            <>
              <p className="rl-empty-title">Nothing open</p>
              <p>
                Every note so far is resolved. Choose <span className="rl-empty-em">Resolved</span> or{" "}
                <span className="rl-empty-em">All</span> to read them again.
              </p>
            </>
          ) : (
            <>
              <p className="rl-empty-title">No open notes yet</p>
              <p>Press Comment, then click anything on the page to leave the first one.</p>
            </>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.route} className="rl-group" aria-label={group.title}>
            <h3 className="rl-group-head">
              <span className="rl-group-title">{group.title}</span>
              <span className="rl-group-route">{group.route}</span>
              {group.here && <span className="rl-tag">This page</span>}
            </h3>
            <ul className="rl-rows">
              {group.list.map((t) => {
                const number = numberOf(t);
                const count = replies(t.id).length;
                const isNew = unread(t);
                const isMoved = moved.has(t.id);
                return (
                  <li key={t.id}>
                    <button type="button" className="rl-row" data-resolved={t.status === "resolved" || undefined} onClick={() => onOpen(t)}>
                      <span className="rl-row-mark" aria-hidden="true">
                        {number ? <span className="rl-mini-pin">{number}</span> : <span className="rl-mini-page">Page</span>}
                      </span>
                      <span className="rl-row-main">
                        <span className="rl-row-meta">
                          <span className="rl-row-author">{t.author.name}</span>
                          {t.author.kind === "designer" && <span className="rl-tag">Designer</span>}
                          <When iso={t.createdAt} now={now} />
                        </span>
                        <span className="rl-row-excerpt">{t.body}</span>
                        <span className="rl-row-foot">
                          {t.status === "resolved" ? "Resolved" : "Open"}
                          {count > 0 && ` · ${count} ${count === 1 ? "reply" : "replies"}`}
                          {t.category && ` · ${categoryLabel[t.category]}`}
                          {isMoved && " · Its spot has moved"}
                          {t.kind === "page" && " · About the page"}
                        </span>
                      </span>
                      {isNew && <Dot label="New" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Panel>
  );
}
