import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/svix@1.21.0';
import { corsHeaders } from '../_shared/cors.ts';

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserEventData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserEventData;
}

const WEBHOOK_SECRET = Deno.env.get('CLERK_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Read raw body BEFORE any parsing — Svix verifies the exact bytes
  const rawBody = await req.text();

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return json({ error: 'Missing Svix headers' }, 401);
  }

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return json({ error: 'Invalid webhook signature' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { type, data } = event;

  try {
    if (type === 'user.created' || type === 'user.updated') {
      const primaryEmail =
        data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
          ?.email_address ?? data.email_addresses?.[0]?.email_address ?? '';

      if (!primaryEmail) {
        console.error('[clerk-webhook] No primary email for user:', data.id);
        return json({ error: 'no_primary_email' }, 422);
      }

      const displayName =
        [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

      const { error } = await supabase.from('users').upsert(
        {
          clerk_user_id: data.id,
          email: primaryEmail,
          display_name: displayName,
          avatar_url: data.image_url ?? null,
        },
        { onConflict: 'clerk_user_id' },
      );

      if (error) throw error;
    } else if (type === 'user.deleted') {
      // Cascade in the schema handles recipes, collections, etc.
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('clerk_user_id', data.id);

      if (error) throw error;
    }
    // Unknown event types are silently accepted — forward-compat with new Clerk events

    return json({ received: true }, 200);
  } catch (err) {
    console.error('[clerk-webhook] DB error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
