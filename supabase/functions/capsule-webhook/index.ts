// Seals a message once Stripe confirms payment.
//
// This is the only writer to capsule_entries, and it is the only place the message text is ever
// persisted. It runs with the service-role key, which bypasses RLS — that is deliberate and is why
// no anon policy exists on that table.
//
// Idempotent: stripe_session_id is unique, so a replayed webhook cannot double-seal.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSealed } from '../_shared/email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-08-27.basil' })
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('No signature', { status: 400 })

  const raw = await req.text()

  let event: Stripe.Event
  try {
    // async variant is required on Deno — the sync one uses node crypto
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET)
  } catch (err) {
    console.error('signature verification failed', err)
    return new Response('Bad signature', { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ ignored: event.type }), { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  if (session.payment_status !== 'paid') {
    return new Response(JSON.stringify({ ignored: 'unpaid' }), { status: 200 })
  }
  if (session.metadata?.kind !== 'capsule_entry') {
    return new Response(JSON.stringify({ ignored: 'not a capsule entry' }), { status: 200 })
  }

  const message = (session.metadata?.message ?? '').slice(0, 100)
  if (!message) {
    console.error('paid session with no message', session.id)
    return new Response(JSON.stringify({ error: 'no message' }), { status: 200 })
  }

  const hash = await sha256Hex(message)
  const displayName = session.metadata?.display_name || null
  const location = session.metadata?.location || null

  // 1. Seal the message.
  const { data: entry, error: entryErr } = await supabase
    .from('capsule_entries')
    .insert({
      message,
      message_hash: hash,
      display_name: displayName,
      location,
      contact_email: session.customer_details?.email ?? null,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      amount_cents: session.amount_total ?? 200,
      flagged: session.metadata?.flagged === '1',
      flag_reasons: (session.metadata?.flag_reasons ?? '').split(',').filter(Boolean),
    })
    .select('seq, created_at')
    .single()

  if (entryErr) {
    // 23505 = unique violation on stripe_session_id: the webhook was replayed. Already sealed.
    if (entryErr.code === '23505') {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 })
    }
    console.error('failed to seal entry', entryErr)
    return new Response(JSON.stringify({ error: 'insert failed' }), { status: 500 })
  }

  // 2. Publish the redacted row. If this fails the message is still safely sealed; the wall row can
  //    be backfilled from capsule_entries, so a 500 here would be worse than a log line.
  const { error: wallErr } = await supabase.from('capsule_wall').insert({
    seq: entry.seq,
    display_name: displayName,
    location,
    char_count: message.length,
    message_hash: hash,
    created_at: entry.created_at,
  })
  if (wallErr) console.error('wall insert failed (entry is sealed, backfill later)', wallErr)

  // 3. Confirmation. Deliberately last and deliberately non-fatal: the message is already sealed,
  //    and returning non-200 here would make Stripe retry the whole webhook and re-run everything
  //    above just because an email bounced. A failed send is logged and moved on from.
  const to = session.customer_details?.email
  if (to) {
    try {
      const sent = await sendSealed(to, { seq: entry.seq, hash, name: displayName })
      if (!sent.ok) console.error('confirmation email failed', entry.seq, sent.error)
    } catch (err) {
      console.error('confirmation email threw', entry.seq, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, seq: entry.seq }), { status: 200 })
})
