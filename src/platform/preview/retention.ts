import type { RetentionData, RetentionDraft, RetentionRecord } from '../retention';
import { validateRetention } from '../retention';
import { buyers } from '../seed';
import { read, write, worldNow } from './storage';

export function createPreviewRetention(scope = '') {
  const key = 'tm-preview-retention-' + (scope || 'workspace') + '-v1';
  const initial = (): RetentionData => ({access:{allowed:true,owner:true,members:[]},records:[],events:[],contacts:[]});
  function load(): RetentionData {
    const raw = localStorage.getItem(key);
    let data = initial();
    if (raw) {
      try { data = JSON.parse(raw); } catch { throw Error('Saved activity could not be read. The original data has been preserved.'); }
      if (!Array.isArray(data.records) || !Array.isArray(data.events)) throw Error('Saved activity could not be read. The original data has been preserved.');
    }
    const subscribers = read<{email:string;status:'subscribed'|'suppressed';consentAt:string;source:string}[]>(
      'tm-business-' + (scope ? scope + '-' : '') + 'audience-plan-v1',
      buyers.slice(0,8).map((b,i)=>({email:b.email,status:i===7?'suppressed':'subscribed',consentAt:'2026-09-25T08:00:00Z',source:'Fictional newsletter opt-in'})),
    );
    return {...data, contacts:subscribers.map(c=>({email:c.email,status:c.status,consent_at:c.consentAt,source:c.source}))};
  }
  return {
    async load() { return load(); },
    async save(draft: RetentionDraft): Promise<RetentionRecord> {
      const now = worldNow(); validateRetention(draft, now);
      const data = load(), old = data.records.find(r=>r.id===draft.id);
      if (old && draft.version === undefined) {
        const unchanged = (['buyer_id','product_id','kind','channel','subject','body','due_at','status'] as const).every(k=>old[k]===draft[k]) && Date.parse(old.occurred_at)===Date.parse(draft.occurred_at);
        if (unchanged) return old;
      }
      if (old && (old.buyer_id !== draft.buyer_id || old.kind !== draft.kind)) throw Error('The customer and activity type cannot be changed.');
      if ((old && old.version !== draft.version) || (!old && draft.version !== undefined)) throw Error('This activity changed. Reload it before saving.');
      const saved: RetentionRecord = {...draft,subject:draft.subject.trim(),body:draft.body.trim(),version:(old?.version ?? 0)+1,created_at:old?.created_at ?? now,updated_at:now};
      data.records = [...data.records.filter(r=>r.id!==saved.id), saved];
      data.events.push({id:crypto.randomUUID(),buyer_id:saved.buyer_id,source:'retention_records',source_id:saved.id,
        kind:old?'activity.updated':'activity.created',occurred_at:old?now:saved.occurred_at,recorded_at:now,
        summary:(old?'Updated ':'Added ')+saved.kind,detail:{...saved}});
      write(key,data,true); return saved;
    },
    async grant(_userId: string, _allowed: boolean) { throw Error('Team access is managed in the connected workspace.'); },
  };
}
