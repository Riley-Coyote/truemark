/**
 * "What you'll receive": the partner's emails and text message, built from
 * their own records (their latest referral, approval, payout and week) with
 * the platform's branded previews. Partners see orders, never buyers: nothing
 * here names who placed an order or what was in it. Every email ends with the
 * disclosure reminder. Nothing is sent in the preview.
 */
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Button, EmptyState, Skeleton, formatCount, formatDate, formatMoney, plural } from "../../app-kit";
import { LIVE } from "../../platform/mode";
import {
  EmailButton,
  EmailFigure,
  EmailHeading,
  EmailNote,
  EmailPreview,
  EmailRows,
  EmailText,
  SmsPreview,
} from "../../platform/email/EmailPreview";
import { store, useResource } from "../../platform/store";
import type { Partner, Referral } from "../../platform/types";
import { monthToDate, upcoming } from "../metrics";
import { lastWeek, latestRecords, roundMoney } from "../momentum";
import type { AlertChannel, AlertEvent, PartnerPrefs } from "../prefs";
import { SAMPLE_TERMS, ordinal, percent } from "../program";

const DISCLOSE = "Disclose your partnership in every post.";

/**
 * The new-order text message. It uses plain characters only (no curly quotes, dashes
 * or middle dots, which would switch a phone to a 70-character encoding), so it stays
 * a single message of at most 160 characters.
 */
export function saleText(referral: Referral): string {
  return `TrueMark: New order ${referral.orderNumber} through your ${referral.via}. You earned ${formatMoney(referral.commission)}, pending until delivered. Details in your partner portal. Reply STOP to opt out.`;
}

type PreviewId = "earned" | "approved" | "payout" | "week" | "text";

const previews: { id: PreviewId; label: string; event: AlertEvent; channel: AlertChannel }[] = [
  { id: "earned", label: "New order", event: "newOrder", channel: "email" },
  { id: "approved", label: "Commission approved", event: "approved", channel: "email" },
  { id: "payout", label: "Payout sent", event: "payout", channel: "email" },
  { id: "week", label: "Weekly summary", event: "weekly", channel: "email" },
  { id: "text", label: "New order, by text", event: "newOrder", channel: "text" },
];

function why(event: string) {
  return `You’re a TrueMark partner. You receive this because ${event} are on in your alert preferences.`;
}

export function WhatYouReceive({ partner, prefs }: { partner: Partner; prefs: PartnerPrefs }) {
  const referrals = useResource(() => store.partners.referrals(partner.id), [partner.id]);
  const payouts = useResource(() => store.partners.payouts(partner.id), [partner.id]);
  const visits = useResource(() => store.partners.visits(partner.id), [partner.id]);
  const [selected, setSelected] = useState<PreviewId>("earned");
  const titleId = useId();

  const error = referrals.error ?? payouts.error ?? visits.error;
  const ready = referrals.data && payouts.data && visits.data;
  const to = `${partner.name} <${partner.email}>`;

  let preview: ReactNode = null;
  const subjects: Partial<Record<PreviewId, string>> = {};

  if (ready) {
    const refs = referrals.data!;
    const records = latestRecords(refs, payouts.data!);
    const next = upcoming(refs);
    const week = lastWeek(refs, visits.data!);
    const month = monthToDate(refs);
    const r = records.referral;
    const a = records.approved;
    const p = records.payout;

    subjects.earned = r ? `You earned ${formatMoney(r.commission)} on order ${r.orderNumber}` : undefined;
    subjects.approved = a ? `Commission approved: ${formatMoney(a.commission)}` : undefined;
    subjects.payout = p && records.payoutLabel ? `Payout sent: ${formatMoney(p.amount)} for ${records.payoutLabel}` : undefined;
    subjects.week = `Your week: ${plural(week.orders, "order")}, ${formatMoney(week.earned)} earned`;
    subjects.text = r ? saleText(r) : undefined;

    const none = (title: string, note: string) => <EmptyState compact title={title} note={note} />;

    switch (selected) {
      case "earned":
        preview = r ? (
          <EmailPreview
            to={to}
            subject={subjects.earned!}
            preheader={`An order came through your ${r.via}. Pending until 14 days after delivery.`}
            footer={why("new-order emails")}
          >
            <EmailHeading>An order came through your {r.via}.</EmailHeading>
            <EmailFigure
              label="You earned"
              value={formatMoney(r.commission)}
              note={`${percent(partner.rate)} of the ${formatMoney(r.orderSubtotal)} order subtotal, after your audience’s discount`}
            />
            <EmailRows
              rows={[
                ["Order", r.orderNumber],
                ["Placed", formatDate(r.createdAt)],
                ["Via", r.via === "link" ? "Your link" : `Your code, ${partner.code}`],
                ["Status", r.status === "pending" ? "Pending until 14 days after delivery" : r.status === "approved" ? "Approved" : "Paid"],
              ]}
            />
            <EmailText>
              Approved commissions are paid on the {ordinal(SAMPLE_TERMS.payoutDay)} of each month (sample terms). Your
              referrals list this order by its number and amounts; the buyer’s details stay with TrueMark.
            </EmailText>
            <EmailButton>See your referrals</EmailButton>
            <EmailNote>{DISCLOSE}</EmailNote>
          </EmailPreview>
        ) : (
          none("No referrals yet.", "Your first order through your code or link will look like this.")
        );
        break;
      case "approved":
        preview = a ? (
          <EmailPreview
            to={to}
            subject={subjects.approved!}
            preheader={`Order ${a.orderNumber} joins your ${formatDate(next.date)} payout.`}
            footer={why("approval emails")}
          >
            <EmailHeading>Your commission is approved.</EmailHeading>
            <EmailFigure label="Approved" value={formatMoney(a.commission)} note={`On order ${a.orderNumber}, placed ${formatDate(a.createdAt)}`} />
            <EmailRows
              rows={[
                ["Paid on", `${formatDate(next.date)}, sample schedule`],
                ["Approved for that payout", formatMoney(next.approved)],
                ["Still pending", `${formatMoney(next.pending)} · ${plural(next.pendingCount, "order")}`],
              ]}
            />
            <EmailText>It is paid by bank transfer with every commission approved by then.</EmailText>
            <EmailButton>See your payouts</EmailButton>
            <EmailNote>{DISCLOSE}</EmailNote>
          </EmailPreview>
        ) : (
          none("No approved commission yet.", "Commissions are approved 14 days after delivery.")
        );
        break;
      case "payout":
        preview =
          p && records.payoutLabel ? (
            <EmailPreview
              to={to}
              subject={subjects.payout!}
              preheader={`${plural(p.referrals, "order")} · ${p.method} · ${formatDate(`${p.paidAt}T12:00:00Z`)}`}
              footer={why("payout emails")}
            >
              <EmailHeading>Your {records.payoutLabel.replace(/ \d{4}$/, "")} payout has been sent.</EmailHeading>
              <EmailFigure label="Paid" value={formatMoney(p.amount)} note={`${p.method}, ${formatDate(`${p.paidAt}T12:00:00Z`)}`} />
              <EmailRows
                rows={[
                  ...records.payoutLines.map((line): [string, ReactNode] => [`Order ${line.orderNumber}`, formatMoney(line.commission)]),
                  [`Total, ${plural(p.referrals, "order")}`, formatMoney(p.amount)],
                ]}
              />
              <EmailButton>See the statement</EmailButton>
              <EmailNote>{DISCLOSE}</EmailNote>
            </EmailPreview>
          ) : (
            none("No payouts yet.", "Your first payout follows your first approved commissions.")
          );
        break;
      case "week":
        preview = (
          <EmailPreview
            to={to}
            subject={subjects.week!}
            preheader={`${week.range} · ${plural(week.clicks, "click")} on your links`}
            footer={why("weekly summaries")}
          >
            <EmailHeading>Your week, {week.range}.</EmailHeading>
            <EmailFigure
              label="Earned this week"
              value={formatMoney(week.earned)}
              note={`${plural(week.orders, "order")} from ${plural(week.clicks, "click")} on your links`}
            />
            <EmailRows
              rows={[
                ["Clicks on your links", formatCount(week.clicks)],
                ["Referred orders", formatCount(week.orders)],
                ["Earned", formatMoney(week.earned)],
                ["Through your links", `${formatCount(week.viaLink)} of ${formatCount(week.orders)}`],
                ["With your code", `${formatCount(week.viaCode)} of ${formatCount(week.orders)}`],
              ]}
            />
            <EmailText>
              {month.month} so far: {formatMoney(month.current)} of your {roundMoney(prefs.goal)} monthly goal.
            </EmailText>
            <EmailButton>Open your dashboard</EmailButton>
            <EmailNote>{DISCLOSE}</EmailNote>
          </EmailPreview>
        );
        break;
      case "text":
        preview = r ? (
          <SmsPreview to={prefs.phone ?? "your mobile number"} message={saleText(r)} />
        ) : (
          none("No referrals yet.", "Your first order will arrive like this, by text, once you turn it on.")
        );
        break;
    }
  }

  return (
    <section className="kit-card kit-span-12 pp-receive" aria-labelledby={titleId}>
      <header className="kit-card-head">
        <h2 id={titleId} className="kit-card-title">
          What you’ll receive
        </h2>
        <div className="kit-card-meta">
          <span className="pp-card-aside">{LIVE ? "Built from your own records" : "Built from your own records · nothing is sent in the preview"}</span>
        </div>
      </header>
      <div className="kit-card-body pp-receive-body">
        {error ? (
          <EmptyState
            compact
            title="Your records could not be loaded."
            note={error.message}
            action={
              <Button
                onClick={() => {
                  referrals.reload();
                  payouts.reload();
                  visits.reload();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : (
          <>
            <div className="pp-inbox" role="group" aria-label="Messages">
              {previews.map((item) => {
                const off = !prefs.alerts[item.event][item.channel];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="pp-inbox-item"
                    aria-pressed={selected === item.id}
                    onClick={() => setSelected(item.id)}
                  >
                    <span className="pp-inbox-top">
                      <span className="pp-inbox-label">{item.label}</span>
                      <span className="pp-inbox-channel">{off ? `${item.channel === "text" ? "Text" : "Email"} off` : item.channel === "text" ? "Text" : "Email"}</span>
                    </span>
                    <span className="pp-inbox-subject">
                      {ready ? (subjects[item.id] ?? "Not yet in your records") : <Skeleton width="80%" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pp-receive-view">
              {ready ? (
                preview
              ) : (
                <div className="pp-list-loading" aria-label="Loading">
                  <Skeleton width="60%" height="1.5rem" />
                  <Skeleton width="100%" height="12rem" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
