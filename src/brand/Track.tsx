import type { CSSProperties } from "react";
import "./track.css";

export type TrackStop = {
  /** A small label above the title, such as "Step 01". */
  kicker?: string;
  title: string;
  text: string;
  /** The stop where a lot is released: its station takes the signal green. */
  release?: boolean;
};

/**
 * A path a lot travels, in the home page's paper-trail language: stations on a
 * hairline, run across the page on wide screens and down it on phones. Once the
 * track is in view, the logo's dot travels it and pauses at each station.
 * Built for three or five stops. It needs a `useReveal` root above it.
 */
export function Track({
  stops,
  labelledBy,
  theme = "paper",
  extend = "end",
}: {
  stops: TrackStop[];
  /** The id of the heading that names this path. */
  labelledBy: string;
  theme?: "paper" | "night";
  /** Which edge of the page the hairline runs out to: onward past the last stop, or in from before the first. */
  extend?: "start" | "end";
}) {
  const kicked = stops.some((stop) => stop.kicker);
  return (
    <div
      className={`tm-track tm-track-${theme} tm-track-${stops.length} tm-track-from-${extend}${kicked ? " has-kicker" : ""}`}
      style={{ "--tm-track-stops": stops.length } as CSSProperties}
      data-reveal
    >
      <ol className="tm-track-stops" aria-labelledby={labelledBy}>
        {stops.map((stop, i) => (
          <li
            key={stop.title}
            className={`tm-track-stop${stop.release ? " is-release" : ""}`}
            style={{ "--tm-i": i } as CSSProperties}
          >
            <span className="tm-track-node" aria-hidden="true" />
            {stop.kicker && <span className="tm-track-kicker">{stop.kicker}</span>}
            <h3 className="tm-track-title">{stop.title}</h3>
            <p className="tm-track-text">{stop.text}</p>
          </li>
        ))}
      </ol>
      <span className="tm-track-progress" aria-hidden="true" />
    </div>
  );
}
