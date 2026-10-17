export type RetentionKind = 'note' | 'contact' | 'reply' | 'reminder' | 'draft';
export type RetentionRecord = {
  id: string; buyer_id: string; product_id: string | null; kind: RetentionKind;
  channel: 'email' | 'phone' | 'other'; subject: string; body: string;
  occurred_at: string; due_at: string | null; status: 'open' | 'done' | 'cancelled';
  version: number; created_at: string; updated_at: string;
};
export type RetentionDraft = Omit<RetentionRecord, 'version' | 'created_at' | 'updated_at'> & { version?: number };
export type RetentionEvent = {
  id: string; buyer_id: string; source: string; source_id: string; kind: string;
  occurred_at: string | null; recorded_at: string; summary: string;
  detail: Record<string, unknown>;
};
export type RetentionConsent = { email: string; status: 'subscribed' | 'suppressed'; consent_at: string; source: string };
export type RetentionAccess = { allowed: boolean; owner: boolean; members: { id: string; email: string; allowed: boolean }[] };
export type RetentionData = {
  access: RetentionAccess; records: RetentionRecord[]; events: RetentionEvent[]; contacts: RetentionConsent[];
};
export function validateRetention(draft: RetentionDraft, now: string) {
  if (!draft.id || !draft.buyer_id) throw Error('Choose a customer.');
  if (!['note','contact','reply','reminder','draft'].includes(draft.kind)) throw Error('Choose an activity type.');
  if (!['email','phone','other'].includes(draft.channel)) throw Error('Choose a contact method.');
  if (!['open','done','cancelled'].includes(draft.status)) throw Error('Choose a valid status.');
  if (!draft.body.trim() || draft.body.length > 10000 || draft.subject.length > 200) throw Error('Add details (up to 10,000 characters) and a subject of at most 200 characters.');
  if (!Number.isFinite(Date.parse(draft.occurred_at)) || Date.parse(draft.occurred_at) > Date.parse(now)) throw Error('Activity must have a valid date that is not in the future.');
  if (draft.kind === 'reminder' && (!draft.due_at || !Number.isFinite(Date.parse(draft.due_at)))) throw Error('Choose a reminder date.');
  if (draft.kind !== 'reminder' && draft.due_at) throw Error('Only reminders have a due date.');
  if (draft.kind === 'draft' && draft.status === 'done') throw Error('A draft cannot be marked sent. Log an actual contact separately.');
}
