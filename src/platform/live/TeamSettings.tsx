import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Check, Minus } from "lucide-react";
import { Button, DataTable, Drawer, EmptyState, Facts, Section, formatDateTime } from "../../app-kit";
import type { Column } from "../../app-kit";
import { SelectField } from "../../admin/fields";
import { TEAM_PERMISSIONS } from "../../admin/team";
import { useResource } from "../store";
import { teamInviteLink, teamRoleLabel } from "../team";
import type { TeamInvite, TeamMember, TeamRole } from "../team";
import { live } from "./runtime";
import "./team.css";

const columns: Column<TeamMember>[] = [
  { key: "email", header: "Email", mobile: "primary", sortValue: (member) => member.email, cell: (member) => member.email },
  { key: "role", header: "Role", mobile: "aside", sortValue: (member) => member.role, cell: (member) => teamRoleLabel(member.role) },
  { key: "joined", header: "Joined", sortValue: (member) => member.joinedAt, cell: (member) => formatDateTime(member.joinedAt) },
  { key: "lastSignIn", header: "Last sign-in", sortValue: (member) => member.lastSignInAt, cell: (member) => member.lastSignInAt ? formatDateTime(member.lastSignInAt) : "Never" },
];
const failureMessage = (failure: unknown) => failure instanceof Error ? failure.message : "The change could not be saved. Try again.";

export function LiveTeam({ canManage, openId, onOpen }: { canManage: boolean; openId: string | null; onOpen: (id: string | null) => void }) {
  const members = useResource(() => live().team.members());
  const invites = useResource(() => live().team.invites());
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function revoke(id: string) {
    if (revoking) return;
    setRevoking(id); setError(""); setMessage("");
    try {
      const revoked = await live().team.revokeInvite(id);
      setMessage(revoked ? "Invitation revoked." : "This invitation is no longer pending. Check the team list if it was accepted.");
    }
    catch (failure) { setError(failureMessage(failure)); }
    finally { setRevoking(undefined); }
  }
  const inviteColumns: Column<TeamInvite>[] = [
    { key: "email", header: "Email", mobile: "primary", cell: (invite) => invite.email },
    { key: "role", header: "Role", mobile: "aside", cell: (invite) => teamRoleLabel(invite.role) },
    { key: "expiry", header: "Expires", mobile: "secondary", cell: (invite) => <time className="cc-team-expiry" dateTime={invite.expiresAt}>{formatDateTime(invite.expiresAt)}</time> },
    ...(canManage ? [{ key: "revoke", header: "Action", align: "end" as const, cell: (invite: TeamInvite) => <Button variant="text" disabled={Boolean(revoking)} aria-label={`Revoke invitation for ${invite.email}`} onClick={() => revoke(invite.id)}>{revoking === invite.id ? "Revoking…" : "Revoke"}</Button> }] : []),
  ];
  return <div className="cc-form">
    <div className="kit-card">
      <DataTable caption="Team" columns={columns} rows={members.data} loading={members.loading} error={members.error} onRetry={members.reload}
        rowKey={(member) => member.id} activeKey={openId} onRowClick={(member) => onOpen(member.id)} stickyHeader={false} empty={{ title: "No team members yet." }} />
      <div className="cc-card-foot">
        <p className="cc-footnote">{canManage ? "Owners manage invitations and team roles." : "Only owners can invite team members or change roles."}</p>
        {canManage && <Button onClick={() => setInviting(true)}>Invite a team member</Button>}
      </div>
    </div>
    <Section title="Pending invitations">
      <div className="kit-card">
        <DataTable caption="Pending invitations" columns={inviteColumns} rows={invites.data} loading={invites.loading} error={invites.error} onRetry={invites.reload}
          rowKey={(invite) => invite.id} stickyHeader={false} empty={{ title: "No pending invitations.", note: "Invitations work once, for the invited email, for 7 days." }} />
      </div>
    </Section>
    {message && <p className="kit-note" role="status">{message}</p>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
    {inviting && canManage && <InviteDrawer onClose={() => setInviting(false)} />}
    {openId && <TeamMemberDrawer key={openId} member={members.data?.find((member) => member.id === openId)} loading={!members.data && members.loading}
      error={members.error} onRetry={members.reload} canManage={canManage} onClose={() => onOpen(null)}
      onSaved={(role) => { onOpen(null); setMessage(role === "buyer" ? "Removed from the team. Their account is unchanged." : "Team role saved."); }} />}
  </div>;
}

function InviteDrawer({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("staff");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const linkId = useId();
  const emailId = useId();
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const token = await live().team.createInvite(email, role);
      setLink(teamInviteLink(location.origin + location.pathname, token));
    } catch (failure) { setError(failureMessage(failure)); }
    finally { setBusy(false); }
  }
  async function copy() {
    setBusy(true); setError("");
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { setError("Copy is unavailable in this browser. Select and copy the link above."); }
    finally { setBusy(false); }
  }
  return <Drawer title="Invite a team member" eyebrow="Team" onClose={() => { if (!busy) onClose(); }}>
    {link ? <Section title="Invitation link">
      <Facts items={[{ label: "Email", value: email.trim().toLowerCase() }, { label: "Role", value: teamRoleLabel(role) }]} />
      <div className="kit-field">
        <label className="kit-field-label" htmlFor={linkId}>Link</label>
        <div className="cc-control"><input id={linkId} className="cc-input" readOnly value={link} onFocus={(event) => event.target.select()} /></div>
      </div>
      <p className="kit-note">Send this link to them. It works once, for this email, for 7 days.</p>
      <div className="cc-confirm-actions"><Button variant="primary" disabled={busy} onClick={copy}>{busy ? "Copying…" : "Copy link"}</Button><Button disabled={busy} onClick={onClose}>Done</Button></div>
      {copied && <p className="kit-note" role="status">Link copied.</p>}
    </Section> : <form className="cc-form" onSubmit={create}>
      <div className="kit-field">
        <label className="kit-field-label" htmlFor={emailId}>Email</label>
        <div className="cc-control" data-disabled={busy ? "true" : undefined}><input id={emailId} className="cc-input" type="email" name="team-email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} required /></div>
      </div>
      <SelectField label="Role" value={role} onChange={setRole} options={[{ value: "staff", label: "Staff" }, { value: "owner", label: "Owner" }]} disabled={busy} />
      <p className="kit-note">{role === "owner" ? "Owners can invite people, change roles, approve commissions and change shop settings." : "Staff can manage orders, applications, catalog, lots, articles and promo codes. Payouts, settings and team changes stay with owners."}</p>
      <Button variant="primary" type="submit" disabled={busy || !email.trim()}>{busy ? "Creating…" : "Create invitation"}</Button>
    </form>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
  </Drawer>;
}

function TeamMemberDrawer({ member, loading, error: loadError, onRetry, canManage, onClose, onSaved }: {
  member?: TeamMember; loading: boolean; error: Error | null; onRetry: () => void; canManage: boolean; onClose: () => void; onSaved: (role: TeamRole | "buyer") => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(role: TeamRole | "buyer") {
    if (!member || busy) return;
    setBusy(true); setError("");
    try { await live().team.setRole(member.id, role); onSaved(role); }
    catch (failure) { setError(failureMessage(failure)); }
    finally { setBusy(false); }
  }
  const permissions = member && TEAM_PERMISSIONS[member.role];
  return <Drawer title={member?.email ?? "Team member"} eyebrow="Team" subtitle={member && teamRoleLabel(member.role)} onClose={() => { if (!busy) onClose(); }}
    footer={member && <div className="cc-actions">
      {canManage ? removing ? <>
        <p className="kit-note">Remove {member.email} from the team? They keep their account, but lose command-center access.</p>
        <div className="cc-confirm-actions"><Button variant="danger" disabled={busy} onClick={() => save("buyer")}>{busy ? "Removing…" : "Confirm removal"}</Button><Button disabled={busy} onClick={() => setRemoving(false)}>Keep on team</Button></div>
      </> : <div className="cc-confirm-actions">
        <Button disabled={busy} onClick={() => save(member.role === "owner" ? "staff" : "owner")}>{busy ? "Saving…" : member.role === "owner" ? "Make staff" : "Make owner"}</Button>
        <Button variant="danger" disabled={busy} onClick={() => setRemoving(true)}>Remove from team</Button>
      </div> : <p className="kit-note">Only owners can change team roles.</p>}
      {error && <p className="kit-field-error" role="alert">{error}</p>}
    </div>}>
    {loadError ? <EmptyState compact title="The team could not be loaded." note={loadError.message} action={<Button onClick={onRetry}>Try again</Button>} />
      : loading ? <p className="kit-note" role="status">Loading team member…</p>
      : !member ? <EmptyState compact title="This account is no longer on the team." />
      : <>
        <Section title="Account"><Facts items={[{ label: "Email", value: member.email }, { label: "Role", value: teamRoleLabel(member.role) }, { label: "Joined", value: formatDateTime(member.joinedAt) }, { label: "Last sign-in", value: member.lastSignInAt ? formatDateTime(member.lastSignInAt) : "Never" }]} /></Section>
        <Section title="Can use"><ul className="cc-checks">{permissions!.can.map((item) => <li key={item}><Check aria-hidden="true" strokeWidth={1.8} />{item}</li>)}</ul></Section>
        <Section title="Cannot change"><ul className="cc-checks is-muted">{permissions!.cannot.map((item) => <li key={item}><Minus aria-hidden="true" strokeWidth={1.8} />{item}</li>)}</ul></Section>
      </>}
  </Drawer>;
}
