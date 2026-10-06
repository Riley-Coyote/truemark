import { createDb } from '../_shared/db.ts';
import { createHandler } from './server.ts';
const env=(name: string)=>Deno.env.get(name)??'';
Deno.serve(createHandler({db:createDb(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY')),
 functionsKey:env('FUNCTIONS_KEY'),site:env('SITE_URL'),emailFrom:env('EMAIL_FROM')||'TrueMark BioLabs <orders@truemarkbiolabs.com>',
 resendKey:env('RESEND_API_KEY'),twilioSid:env('TWILIO_ACCOUNT_SID'),twilioToken:env('TWILIO_AUTH_TOKEN'),twilioFrom:env('TWILIO_FROM'),
 fetch,now:()=>new Date().toISOString(),uuid:()=>crypto.randomUUID()}));
