import { Component } from "react";
import type { ReactNode } from "react";
import "./root-failure.css";

/**
 * What shows if the whole site fails to start or to draw: the name, a plain note and the ways on, in the brand's own
 * ink and paper, with nothing it depends on that might itself have failed (no router's links, no stylesheet but its own).
 */
export function RootFailure({ home }: { home: string }) {
  return (
    <main className="tm-root-failure" aria-labelledby="tm-root-failure-title">
      <p className="tm-root-failure-name">TrueMark BioLabs</p>
      <h1 id="tm-root-failure-title">This page didn’t load.</h1>
      <p>The connection may have dropped. Loading it again usually brings it back.</p>
      <p className="tm-root-failure-ways">
        <button type="button" onClick={() => window.location.reload()}>Load it again</button>
        <a href={home}>Home</a>
      </p>
    </main>
  );
}

/** Anything that fails outside a page (pages.tsx's pages have their own, PageBoundary.tsx) shows RootFailure. */
export class RootBoundary extends Component<{ home: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <RootFailure home={this.props.home} /> : this.props.children;
  }
}
