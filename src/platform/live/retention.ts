import type { RetentionAccess, RetentionData, RetentionDraft, RetentionRecord, RetentionEvent, RetentionConsent } from '../retention';
type Rows = (table: string, select?: string, filters?: Record<string,string>) => Promise<Record<string,unknown>[]>;
type Rpc = <T>(name: string, args?: Record<string,unknown>) => Promise<T>;
export function createRetention(rows: Rows, rpc: Rpc, changed: () => void) {
  return {
    async load(): Promise<RetentionData> {
      const access = await rpc<RetentionAccess>('retention_access');
      if (!access.allowed) return { access, records: [], events: [], contacts: [] };
      const [records, events, contacts] = await Promise.all([
        rows('retention_records'), rows('retention_events'), rows('marketing_contacts','email,status,consent_at,source,id'),
      ]);
      return { access, records: records as unknown as RetentionRecord[], events: events as unknown as RetentionEvent[], contacts: contacts as unknown as RetentionConsent[] };
    },
    async save(draft: RetentionDraft) {
      const result = await rpc<RetentionRecord>('save_retention_record',{draft,expected_version:draft.version ?? null});
      changed(); return result;
    },
    async grant(userId: string, allowed: boolean) { await rpc('set_retention_access',{user_id:userId,allowed}); changed(); },
  };
}
