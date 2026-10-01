import { Link, Navigate } from "react-router-dom";
import PublicFrame from "../../partners/public/PublicFrame";
import { useResource } from "../store";
import { live } from "./runtime";

/** Applicant accounts have a profile and application, but no partner row yet. */
export function PartnerPending({ onRefresh }: { onRefresh: () => void }) {
  const application = useResource(() => live().partnerApplications.mine(), []);
  if (!application.loading && !application.error && application.data === null) return <Navigate to="/partners/sign-in" replace />;
  const row = application.data;
  const declined = row?.status === "declined";
  const checking = application.loading && !row;
  return <PublicFrame>
    <div className="tm-page">
      <section className="tm pp-signin" aria-labelledby="pp-application-title">
        <div className="pp-application-state" aria-live="polite" aria-busy={application.loading}>
          <p className="tm-eyebrow">Partner program</p>
          <h1 id="pp-application-title" className="tm-heading">
            {checking ? "Checking your application…" : application.error ? "Your application could not be loaded." : declined ? "Your application has been reviewed" : row?.status === "approved" ? "Your application is approved" : "Your application is with the team"}
          </h1>
          {!checking && <>
            <p className="tm-section-note pp-application-note" role={application.error ? "alert" : undefined}>
              {application.error?.message ?? (declined ? row?.reviewNote ?? "We couldn't approve this application." : row?.status === "approved" ? "Your portal is ready. Refresh to open it." : "We review every application; you'll hear from us by email.")}
            </p>
            <div className="tm-actions">
              <button type="button" className="tm-button tm-button-primary" disabled={application.loading} onClick={() => { application.reload(); onRefresh(); }}>{application.loading ? "Checking…" : "Check status"}</button>
              <Link className="tm-textlink" to="/partners/sign-out">Sign out</Link>
            </div>
          </>}
        </div>
      </section>
    </div>
  </PublicFrame>;
}
