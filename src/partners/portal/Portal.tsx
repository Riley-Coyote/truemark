import { LIVE } from "../../platform/mode";
import { PartnerPending } from "../../platform/live/PartnerPending";
import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AppShell, Avatar, Button, EmptyState, SampleTag, Skeleton } from "../../app-kit";
import { store, useResource } from "../../platform/store";
import { isSignedOut } from "../session";
import { AlertsBell } from "./Alerts";
import { PartnerContext, initials } from "./context";
import Guidelines from "./Guidelines";
import Links from "./Links";
import { SaleMoments } from "./Moments";
import { HOME, footerNav, navGroups, titleFor } from "./nav";
import Overview from "./Overview";
import Payouts from "./Payouts";
import Referrals from "./Referrals";
import Settings from "./Settings";
import "../portal.css";
import "../momentum.css";

function Missing() {
  return (
    <EmptyState
      eyebrow="Not found"
      title="That page isn’t part of your portal."
      note="The address may be mistyped, or the page may have moved."
      action={
        <Link className="kit-link" to={HOME}>
          Back to the overview
          <ArrowRight aria-hidden="true" strokeWidth={1.6} />
        </Link>
      }
    />
  );
}

/** The partner's own dashboard: the app kit in its light studio theme. */
export default function Portal() {
  const location = useLocation();
  const signedOut = isSignedOut();
  const me = useResource(() => store.partners.me(), []);
  const title = titleFor(location.pathname);

  useEffect(() => {
    document.title = `${title} · Partner portal — TrueMark BioLabs`;
  }, [title]);

  if (LIVE && !me.loading && me.data === null) return <PartnerPending onRefresh={me.reload} />;

  if (signedOut || me.data === null) {
    return <Navigate to="/partners/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const partner = me.data;
  const identity = partner ? (
    <span className="pp-identity">
      <span className="pp-identity-name">{partner.name}</span>
      <span className="pp-identity-handle">{partner.handle}</span>
    </span>
  ) : (
    <span className="pp-identity" aria-hidden="true">
      <Skeleton width="7rem" />
    </span>
  );
  const avatar = partner && <Avatar initials={initials(partner.name)} label={`${partner.name}, ${partner.handle}`} />;

  return (
    <AppShell
      theme="studio"
      label="Partner portal"
      home={HOME}
      nav={navGroups}
      footerNav={footerNav}
      storageKey="tm-partner-sidebar"
      title={title}
      tools={
        <>
          {identity}
          <SampleTag />
          {partner && <AlertsBell partnerId={partner.id} />}
          {avatar}
        </>
      }
      mobileTools={
        <>
          <SampleTag />
          {partner && <AlertsBell partnerId={partner.id} />}
        </>
      }
      menuFooter={
        <>
          {identity}
          {avatar}
        </>
      }
    >
      {partner ? (
        <PartnerContext.Provider value={partner}>
          <SaleMoments partnerId={partner.id} />
          <Routes>
            <Route index element={<Overview />} />
            <Route path="links" element={<Links />} />
            <Route path="referrals" element={<Referrals />} />
            <Route path="payouts" element={<Payouts />} />
            <Route path="guidelines" element={<Guidelines />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Missing />} />
          </Routes>
        </PartnerContext.Provider>
      ) : me.error ? (
        <EmptyState
          title="Your portal could not be opened."
          note={me.error.message}
          action={<Button onClick={me.reload}>Try again</Button>}
        />
      ) : (
        <div className="pp-portal-loading" role="status" aria-label="Opening your portal">
          <Skeleton width="42%" />
          <Skeleton width="100%" height="8rem" />
          <Skeleton width="100%" height="16rem" />
        </div>
      )}
    </AppShell>
  );
}
