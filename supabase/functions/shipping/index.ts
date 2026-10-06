import { createDb } from '../_shared/db.ts';
import { createHandler } from './server.ts';

// Deploy shipping with --no-verify-jwt; each route authenticates itself.
const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
Deno.serve(createHandler({ db: createDb(url, serviceKey), url, serviceKey,
  functionsKey: Deno.env.get('FUNCTIONS_KEY') ?? '', webhookKey: Deno.env.get('SHIPPING_WEBHOOK_KEY') ?? '',
  simSecret: Deno.env.get('SHIPPING_SIM_SECRET') ?? '', shipstationKey: Deno.env.get('SHIPSTATION_API_KEY') ?? '',
  shipstationSecret: Deno.env.get('SHIPSTATION_API_SECRET') ?? '', fetch,
  now: () => new Date(), random: (size) => crypto.getRandomValues(new Uint8Array(size)),
}));
