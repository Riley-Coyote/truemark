import type { Row } from './rows';
export type MessagePreferences = { phone: string|null; smsConsent: boolean; smsOptedOut: boolean; alerts: Record<string,Record<string,boolean>> };
export type TeamAlerts = { user_id: string; email: string; role: string; new_order_email: boolean; new_order_text: boolean; applications_email: boolean };
export type OutboxMessage = { id: string; channel: 'email'|'sms'; template: string; recipient: string; order_id: string|null; created_at: string; sent_at: string|null; status: 'queued'|'sending'|'sent'|'failed'|'suppressed'; provider: string|null; subject: string|null; body_html: string|null; body_text: string|null; last_error: string|null };
export type ContactMessage = { id: string; topic: string; name: string; organization: string|null; email: string; message: string; status: 'new'|'handled'; created_at: string };
export type ContactRoute = { topic: string; label: string; email: string };
export const CONSENT = {
 partner:'Text me TrueMark partner alerts at this number. Message and data rates may apply. Reply STOP to opt out.',
 team:'Text me TrueMark team alerts at this number. Message and data rates may apply. Reply STOP to opt out.',
 buyer:'Text me when my orders ship and arrive. Message and data rates may apply. Reply STOP to opt out.',
};
export function createMessages(rows: (table: string,select?: string,filters?: Record<string,string>)=>Promise<Row[]>,rpc: <T>(name: string,args?: Record<string,unknown>)=>Promise<T>,changed: ()=>void){
 return {
  preferences:()=>rpc<MessagePreferences>('my_message_preferences'),
  async savePreferences(alerts: MessagePreferences['alerts'],phone: string|null,smsConsent: boolean){const p=await rpc<MessagePreferences>('save_message_preferences',{alerts,phone,sms_consent:smsConsent});changed();return p;},
  teamPreferences:()=>rpc<TeamAlerts[]>('team_alert_preferences'),
  async outbox(orderId?: string){return (await rows('outbox','*',orderId?{order_id:orderId}:{})).map(r=>r as unknown as OutboxMessage).sort((a,b)=>b.created_at.localeCompare(a.created_at));},
  async contacts(){return (await rows('contact_messages')).map(r=>r as unknown as ContactMessage).sort((a,b)=>b.created_at.localeCompare(a.created_at));},
  async routes(){return (await rows('contact_routes')).map(r=>r as unknown as ContactRoute);},
  async setContactStatus(id: string,status: 'new'|'handled'){await rpc('set_contact_status',{id,status});changed();},
  sendContact:(draft: {topic: string;name: string;email: string;organization: string;message: string;website: string})=>rpc<boolean>('send_contact_message',draft),
 };
}
