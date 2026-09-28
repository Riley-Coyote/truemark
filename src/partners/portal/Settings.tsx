import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Button, Card, Facts, PageHeader, SampleTag, StatusChip, formatDate } from "../../app-kit";
import type { Partner } from "../../platform/types";
import { roundMoney } from "../momentum";
import { DEFAULT_GOAL, alertChannels, alertEvents, normalizePhone, parseGoal, usePartnerPrefs } from "../prefs";
import type { AlertChannel, AlertEvent, PartnerPrefs } from "../prefs";
import { SAMPLE_TERMS, ordinal, percent } from "../program";
import { usePartner } from "./context";
import { TextField } from "./parts";
import { WhatYouReceive } from "./Receive";

type Focus = { focus?: "goal" | "alerts" } | null;

/** A saved state that confirms in words for a moment. */
function useSaved(): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2400);
    return () => window.clearTimeout(timer);
  }, [saved]);
  return [saved, () => setSaved(true)];
}

function GoalSetting({ prefs, update, autoFocus }: { prefs: PartnerPrefs; update: (patch: Partial<PartnerPrefs>) => void; autoFocus: boolean }) {
  const [draft, setDraft] = useState(String(prefs.goal));
  const [error, setError] = useState<string>();
  const [saved, confirm] = useSaved();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(String(prefs.goal)), [prefs.goal]);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const goal = parseGoal(draft);
    if (goal === null) {
      setError("Enter an amount between $1 and $100,000.");
      input.current?.focus();
      return;
    }
    setError(undefined);
    update({ goal });
    setDraft(String(goal));
    confirm();
  }

  return (
    <Card title="Monthly goal" meta={<span className="pp-card-aside">Kept on this device</span>}>
      <p className="pp-setting-lead">Your overview measures each month’s commission against it.</p>
      <form onSubmit={submit} noValidate>
        <TextField
          label="Goal for each month"
          prefix="$"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            if (error) setError(undefined);
          }}
          error={error}
          hint={prefs.goal === DEFAULT_GOAL ? `The default is ${roundMoney(DEFAULT_GOAL)}.` : `The default is ${roundMoney(DEFAULT_GOAL)}; yours is ${roundMoney(prefs.goal)}.`}
          inputRef={input}
          actions={
            <>
              <Button type="submit" variant="primary">
                Save goal
              </Button>
              {prefs.goal !== DEFAULT_GOAL && (
                <Button
                  variant="text"
                  onClick={() => {
                    update({ goal: DEFAULT_GOAL });
                    setError(undefined);
                    confirm();
                  }}
                >
                  Use {roundMoney(DEFAULT_GOAL)}
                </Button>
              )}
              <span className="pp-saved" role="status">
                {saved ? "Saved." : ""}
              </span>
            </>
          }
        />
      </form>
    </Card>
  );
}

function AlertPreferences({
  partner,
  prefs,
  update,
  autoFocus,
}: {
  partner: Partner;
  prefs: PartnerPrefs;
  update: (patch: Partial<PartnerPrefs>) => void;
  autoFocus: boolean;
}) {
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState(prefs.phone ?? "");
  const [phoneError, setPhoneError] = useState<string>();
  const [saved, confirm] = useSaved();

  useEffect(() => setPhone(prefs.phone ?? ""), [prefs.phone]);
  useEffect(() => {
    if (autoFocus) section.current?.focus();
  }, [autoFocus]);

  const set = (event: AlertEvent, channel: AlertChannel) => (checked: boolean) =>
    update({ alerts: { ...prefs.alerts, [event]: { ...prefs.alerts[event], [channel]: checked } } });

  function savePhone(event: FormEvent) {
    event.preventDefault();
    const normal = normalizePhone(phone);
    if (!normal) {
      setPhoneError("Enter a 10-digit US number, like (415) 555-0132.");
      phoneInput.current?.focus();
      return;
    }
    setPhoneError(undefined);
    setPhone(normal);
    update({ phone: normal });
    confirm();
  }

  function removePhone() {
    const alerts = { ...prefs.alerts };
    for (const e of alertEvents) alerts[e.id] = { ...alerts[e.id], text: false };
    update({ phone: null, alerts });
    setPhone("");
    setPhoneError(undefined);
  }

  const textReady = Boolean(prefs.phone);

  return (
    <section
      ref={section}
      className="kit-card pp-alerts"
      aria-labelledby={titleId}
      data-review="partner-alerts"
      tabIndex={-1}
    >
      <header className="kit-card-head">
        <h2 id={titleId} className="kit-card-title">
          Alert preferences
        </h2>
        <div className="kit-card-meta">
          <span className="pp-card-aside">Preview: preferences are kept on this device</span>
        </div>
      </header>
      <div className="kit-card-body">
        <table className="pp-prefs">
          <caption className="kit-sr">Which alerts reach you, by channel</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="kit-sr">Alert</span>
              </th>
              {alertChannels.map((channel) => (
                <th key={channel.id} scope="col">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alertEvents.map((event) => (
              <tr key={event.id}>
                <th scope="row">
                  <span className="pp-prefs-event">{event.label}</span>
                  <span className="pp-prefs-hint">{event.hint}</span>
                </th>
                {alertChannels.map((channel) => {
                  const disabled = channel.id === "text" && !textReady;
                  return (
                    <td key={channel.id}>
                      <label className="pp-prefs-cell" data-disabled={disabled ? "true" : undefined}>
                        <input
                          type="checkbox"
                          className="pp-box"
                          checked={!disabled && prefs.alerts[event.id][channel.id]}
                          disabled={disabled}
                          aria-label={`${event.label} by ${channel.label.toLowerCase()}`}
                          onChange={(e) => set(event.id, channel.id)(e.target.checked)}
                        />
                        <span className="pp-prefs-channel" aria-hidden="true">
                          {channel.label}
                        </span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <form className="pp-phone" onSubmit={savePhone} noValidate>
          <TextField
            label="Mobile number for text messages"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(415) 555-0132"
            value={phone}
            onChange={(value) => {
              setPhone(value);
              if (phoneError) setPhoneError(undefined);
            }}
            error={phoneError}
            hint={textReady ? "Text messages go to this number." : "A US number. Add one to choose text messages above."}
            inputRef={phoneInput}
            actions={
              <>
                <Button type="submit">{textReady ? "Update number" : "Add number"}</Button>
                {textReady && (
                  <Button variant="text" onClick={removePhone}>
                    Remove
                  </Button>
                )}
                <span className="pp-saved" role="status">
                  {saved ? "Saved." : ""}
                </span>
              </>
            }
          />
        </form>

        <ul className="pp-alert-notes">
          <li>Dashboard alerts rise in your portal as they happen. The bell keeps every alert.</li>
          <li>Guideline updates are always on: every partner hears when the guidelines change.</li>
          <li>Sample: nothing is sent in the preview. Email goes to {partner.email}.</li>
        </ul>
      </div>
    </section>
  );
}

export default function Settings() {
  const partner = usePartner();
  const location = useLocation();
  const focus = (location.state as Focus)?.focus;
  const [prefs, update] = usePartnerPrefs(partner.id);

  return (
    <div className="kit-grid pp-page pp-settings">
      <PageHeader description="Your partner record, your terms, your goal and how you hear from us. Profile and payout details are read only in this preview." />

      <div className="kit-span-6 pp-stack">
        <Card title="Profile" meta={<span className="pp-card-aside">Read only</span>}>
          <Facts
            items={[
              { label: "Name", value: partner.name },
              { label: "Handle", value: partner.handle },
              { label: "Email", value: partner.email },
              { label: "Channel", value: partner.audience },
              { label: "Partner code", value: <span className="kit-mono">{partner.code}</span> },
              {
                label: "Status",
                value: <StatusChip status={partner.status} tone={partner.status === "active" ? "signal" : undefined} />,
              },
              { label: "Partner since", value: formatDate(partner.joinedAt) },
            ]}
          />
          <p className="pp-footnote">Editing your profile arrives with the backend.</p>
        </Card>

        <GoalSetting prefs={prefs} update={update} autoFocus={focus === "goal"} />

        <Card title="Session">
          <p className="pp-session">
            Signed in as <span className="pp-session-email">{partner.email}</span>
          </p>
          <Link className="kit-button kit-button-quiet" to="/partners/sign-out">
            Sign out
          </Link>
        </Card>
      </div>

      <div className="kit-span-6 pp-stack">
        <Card title="Your terms" meta={<SampleTag>Sample terms</SampleTag>}>
          <Facts
            items={[
              { label: "Commission", value: `${percent(partner.rate)} of the order subtotal after discount` },
              { label: "Your audience", value: `${percent(partner.codeDiscount)} off, with your code or link` },
              { label: "Payouts", value: `Monthly, on the ${ordinal(SAMPLE_TERMS.payoutDay)}, for approved commissions` },
            ]}
          />
        </Card>

        <Card title="Payout method" meta={<SampleTag>Sample</SampleTag>}>
          <div className="pp-method-row">
            <span className="pp-method-icon" aria-hidden="true">
              <Landmark strokeWidth={1.5} />
            </span>
            <span className="pp-method-text">
              <span className="pp-method-name">Bank transfer</span>
              <span className="kit-quiet">Account details are added at launch.</span>
            </span>
          </div>
          <Button disabled>Change method</Button>
          <p className="pp-footnote">Changing the method arrives with the backend.</p>
        </Card>

        <AlertPreferences partner={partner} prefs={prefs} update={update} autoFocus={focus === "alerts"} />
      </div>

      <WhatYouReceive partner={partner} prefs={prefs} />
    </div>
  );
}
