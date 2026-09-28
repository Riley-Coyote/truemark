import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { initials } from "../identity";
import { ago, stamp } from "../time";
import type { Author } from "../types";

const PHONE = "(max-width: 640px)";

/** Phones get bottom sheets and a full-width dock. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const list = window.matchMedia(PHONE);
    const onChange = () => setPhone(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);
  return phone;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const list = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Focus goes back where it came from when a surface closes — unless the person has already
 * moved it somewhere else (clicked the page, another pin).
 */
export function useFocusReturn(surface: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    const node = surface.current;
    return () => {
      const now = document.activeElement;
      const lost = !now || now === document.body || (node?.contains(now) ?? false) || !now.isConnected;
      if (lost && from?.isConnected && from !== document.body) from.focus({ preventScroll: true });
    };
  }, [surface]);
}

/** Grow a textarea with its text, up to its CSS max-height. */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [ref, value]);
}

export function Avatar({ person, size = "md" }: { person: Pick<Author, "name">; size?: "sm" | "md" }) {
  return (
    <span className={`rl-avatar rl-avatar-${size}`} aria-hidden="true">
      {initials(person.name)}
    </span>
  );
}

export function Dot({ label }: { label?: string }) {
  return label ? (
    <span className="rl-dot" role="img" aria-label={label} />
  ) : (
    <span className="rl-dot" aria-hidden="true" />
  );
}

export function When({ iso, now }: { iso: string; now: number }) {
  return (
    <time className="rl-when" dateTime={iso} title={stamp(iso)}>
      {ago(iso, now)}
    </time>
  );
}

export function AuthorLine({ author, iso, now, children }: { author: Author; iso: string; now: number; children?: ReactNode }) {
  return (
    <div className="rl-byline">
      <Avatar person={author} size="sm" />
      <span className="rl-byline-who">
        <span className="rl-byline-name">{author.name}</span>
        {author.kind === "designer" && <span className="rl-tag">Designer</span>}
        {author.role && author.kind !== "designer" && <span className="rl-byline-role">{author.role}</span>}
      </span>
      {children}
      <When iso={iso} now={now} />
    </div>
  );
}

/** Text that may run long: kept whole, wrapped, and never allowed to push the layout. */
export function Body({ text }: { text: string }) {
  return <p className="rl-body">{text}</p>;
}

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Put text on the clipboard, with the older route for browsers that refuse the new one. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "rl-offscreen";
    (document.querySelector(".rl-root") ?? document.body).appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
