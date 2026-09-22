import { useEffect } from "react";
import type { ComponentProps, MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";

function focusSection(section: string): boolean {
  const target = document.getElementById(section);
  if (!target) return false;

  const hadTabIndex = target.hasAttribute("tabindex");
  if (!hadTabIndex) target.setAttribute("tabindex", "-1");
  target.scrollIntoView();
  target.focus({ preventScroll: true });

  if (!hadTabIndex) {
    target.addEventListener(
      "blur",
      () => target.removeAttribute("tabindex"),
      { once: true },
    );
  }

  return true;
}

function decodeSection(hash: string): string | null {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

type SectionLinkProps = Omit<ComponentProps<typeof Link>, "to"> & {
  section: string;
};

/** A same-route fragment link that also works inside React Router's hash URL. */
export function SectionLink({
  section,
  onClick,
  ...props
}: SectionLinkProps) {
  const location = useLocation();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) return;

    requestAnimationFrame(() => focusSection(section));
  }

  return (
    <Link
      {...props}
      to={{
        pathname: location.pathname,
        search: location.search,
        hash: `#${encodeURIComponent(section)}`,
      }}
      onClick={handleClick}
    />
  );
}

/** Restores section scrolling when a hash-based route is opened directly. */
export function SectionScroll() {
  const { hash, pathname, search } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const section = decodeSection(hash);
    if (!section) return;

    let observer: MutationObserver | undefined;
    const frame = requestAnimationFrame(() => {
      if (focusSection(section)) return;

      observer = new MutationObserver(() => {
        if (focusSection(section)) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    const timeout = window.setTimeout(() => observer?.disconnect(), 2_000);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
    };
  }, [hash, pathname, search]);

  return null;
}
