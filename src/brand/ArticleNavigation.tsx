import { useEffect, useState } from "react";
import { SectionLink } from "../SectionLink";

export type Section = { id: string; text: string };

/**
 * Which section the reader is in: the last heading that has risen past the
 * upper third of the window. -1 while still in the opening paragraphs.
 */
export function useCurrentSection(sections: Section[]) {
  const [current, setCurrent] = useState(-1);
  const key = sections.map((s) => s.id).join(" ");
  useEffect(() => {
    const ids = key ? key.split(" ") : [];
    if (!ids.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight / 3;
      let found = -1;
      ids.forEach((id, i) => {
        const heading = document.getElementById(id);
        if (heading && heading.getBoundingClientRect().top <= line) found = i;
      });
      setCurrent(found);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);
  return current;
}

/** The article's own headings, as a track that fills as the reader moves through them. */
export function Contents({ sections, current }: { sections: Section[]; current: number }) {
  return (
    <nav className="tm-contents" aria-label="On this page">
      <p className="tm-contents-label">On this page</p>
      <ol className="tm-contents-track">
        {sections.map((section, i) => (
          <li
            key={section.id}
            className={i < current ? "is-passed" : i === current ? "is-current" : undefined}
          >
            <SectionLink section={section.id} aria-current={i === current ? "location" : undefined}>
              {section.text}
            </SectionLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}

