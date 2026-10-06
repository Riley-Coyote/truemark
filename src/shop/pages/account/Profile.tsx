import { LIVE } from "../../../platform/mode";
import { live } from "../../../platform/live/runtime";
import { CONSENT } from "../../../platform/live/messages";
import type { MessagePreferences } from "../../../platform/live/messages";
import { useResource } from "../../../platform/store";
import { useId, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { BuyerStatus } from "../../../platform/types";
import { buyerStatusLabel, longDate } from "./lib";
import { PageHead, SectionHead, useAccount, useTitle } from "./parts";

const standing: Record<BuyerStatus, string> = {
  verified: "This account is verified to order materials for laboratory research use.",
  pending: "The application is being reviewed. We’ll email you when your account has been reviewed.",
  declined: "The application was not approved. The team can answer questions about the decision.",
  suspended: "Ordering is paused for this account. Contact the team to resolve it.",
};

export default function Profile() {
  useTitle("Account");
  const { buyer, signOut } = useAccount();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const rows: [string, string][] = [
    ["Name", buyer.name],
    ["Email", buyer.email],
    ["Institution", buyer.institution],
    ["Role", buyer.role],
    ["Member since", longDate(buyer.joinedAt)],
  ];
  return (
    <>
      <PageHead eyebrow="Account" title="Your details." sub="As verified with your application." />
      <div className="tm-acct-split tm-acct-rise">
        <section aria-labelledby="tm-acct-profile-title">
          <SectionHead id="tm-acct-profile-title" label="Profile" />
          <dl className="tm-acct-dl">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="tm-acct-intro">
            Verified details are read-only. To change them,{" "}
            <Link className="tm-acct-link" to="/contact">
              contact the team
            </Link>
            .
          </p>
        </section>
        <section className="tm-acct-card" aria-labelledby="tm-acct-verification-title" style={{ "--tm-i": 1 } as CSSProperties}>
          <h2 id="tm-acct-verification-title" className="tm-acct-label">
            Verification
          </h2>
          <p className="tm-acct-standing is-large" data-status={buyer.status}>
            <i aria-hidden="true" />
            {buyerStatusLabel[buyer.status]}
          </p>
          <p className="tm-acct-card-text">{standing[buyer.status]}</p>
          <dl className="tm-acct-dl is-compact">
            {buyer.verifiedAt && (
              <div>
                <dt>Verified</dt>
                <dd>{longDate(buyer.verifiedAt)}</dd>
              </div>
            )}
            <div>
              <dt>Use</dt>
              <dd>Laboratory research only</dd>
            </div>
          </dl>
        </section>
      </div>
      {LIVE && <TextUpdates email={buyer.email} />}
      <section className="tm-acct-block tm-acct-signout" aria-labelledby="tm-acct-signout-title">
        <SectionHead id="tm-acct-signout-title" label="Session" />
        <div className="tm-acct-actions">
          <button
            type="button"
            className="tm-acct-quiet"
            disabled={state === "busy"}
            onClick={async () => {
              setState("busy");
              try {
                await signOut();
              } catch {
                setState("failed");
              }
            }}
          >
            {state === "busy" ? "Signing out…" : "Sign out"}
          </button>
          <p className="tm-acct-intro" role={state === "failed" ? "alert" : undefined}>
            {state === "failed" ? "Signing out did not complete. Try again." : LIVE ? "Signs you out on this device." : "Ends this preview session in this browser."}
          </p>
        </div>
      </section>
    </>
  );
}

function TextUpdates({email}: {email:string}) {
  const prefs=useResource(()=>live().messages.preferences());
  return <section className="tm-acct-block" aria-labelledby="tm-text-updates"><SectionHead id="tm-text-updates" label="Text updates"/>
    {prefs.data?<TextUpdateForm email={email} initial={prefs.data}/>:<p className="tm-acct-intro" role={prefs.error?"alert":"status"}>{prefs.error?.message??"Loading…"}</p>}
  </section>;
}
function TextUpdateForm({email,initial}: {email:string;initial:MessagePreferences}) {
  const [phone,setPhone]=useState(initial.phone??""),[consent,setConsent]=useState(initial.smsConsent),[busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);const id=useId();
  return <form className="tm-acct-sms" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");setSaved(false);try{const next=await live().messages.savePreferences({shipping:{text:Boolean(phone.trim())&&consent}},phone,consent);setPhone(next.phone??"");setConsent(next.smsConsent);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}}>
    <div className="tm-field"><div className="tm-field-top"><label htmlFor={id}>Mobile number for text updates</label></div><input id={id} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(555) 555-0123" value={phone} onChange={e=>{setPhone(e.target.value);setSaved(false);}} disabled={busy}/></div>
    <label className="tm-acct-consent"><input type="checkbox" className="tm-acct-consent-input" checked={consent} onChange={e=>{setConsent(e.target.checked);setSaved(false);}} disabled={busy}/><span className="tm-acct-consent-box" aria-hidden="true"><Check size={14} strokeWidth={2.2}/></span><span>{CONSENT.buyer}</span></label>
    <div className="tm-acct-actions"><button className="tm-button tm-button-primary" type="submit" disabled={busy}>{busy?"Saving…":"Save"}</button><span className="tm-acct-saved" role="status">{saved?"Saved.":""}</span></div>{error&&<p className="tm-field-error" role="alert">{error}</p>}<p className="tm-acct-intro">Order and account emails always go to {email}.</p>
  </form>;
}
