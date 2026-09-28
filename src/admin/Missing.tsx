import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "../app-kit";
import { HOME } from "./nav";

/** An address inside the command center that leads nowhere. */
export function Missing() {
  return (
    <div className="kit-grid">
      <div className="kit-span-8 cc-missing">
        <EmptyState
          eyebrow="Command"
          title="Nothing lives at this address."
          note="The link may be mistyped or from an older preview."
          action={
            <Link className="kit-link" to={HOME}>
              Back to the overview
              <ArrowRight aria-hidden="true" strokeWidth={1.6} />
            </Link>
          }
        />
      </div>
    </div>
  );
}
