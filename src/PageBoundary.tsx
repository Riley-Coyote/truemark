import { Component } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandDot } from "./brand/BrandDot";
import "./brand/notfound.css";

type Props = { at: string; children: ReactNode };
type State = { failed: boolean; at: string };

/**
 * A page that can't be drawn (its code didn't arrive, or it failed) gives way to a plain note and the ways on, with the
 * shop's header and footer still around it: never a blank screen. Going to another address tries again.
 */
export class PageBoundary extends Component<Props, State> {
  state: State = { failed: false, at: this.props.at };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.at === state.at ? null : { failed: false, at: props.at };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="tm-page">
        <section className="tm tm-lost" aria-labelledby="tm-failed-title">
          <div className="tm-lost-copy">
            <h1 id="tm-failed-title" className="tm-lost-title">
              This page didn’t load
              <BrandDot />
            </h1>
            <p className="tm-lost-lead">The connection may have dropped. Loading it again usually brings it back.</p>
            <div className="tm-actions">
              <button type="button" className="tm-button tm-button-primary" onClick={() => window.location.reload()}>
                Load it again
              </button>
              <Link className="tm-button tm-button-outline" to="/">
                Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }
}
