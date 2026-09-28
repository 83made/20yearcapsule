// Seals a message once Stripe confirms payment.
//
// This is the only writer to capsule_entries, and it is the only place the message text is ever
// persisted. It runs with the service-role key, which bypasses RLS — that is deliberate and is why
// no anon policy exists on that table.
//
// Idempotent: stripe_session_id is unique, so a replayed webhook cannot double-seal.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSealed, sendGiftInvite, sendGiftPurchased } from '../_shared/email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-08-27.basil' })
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://20yearcapsule.com'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return hex(new Uint8Array(digest))
}

// The published proof code is a commitment, not a digest of the message.
//
// sha256(message) on its own was guessable: the wall publishes the exact character count next to
// the code, the message space is short English sentences, and plain SHA-256 runs at billions of
// guesses per second on a GPU. Anyone could have hashed a wordlist and read part of the capsule
// two decades early, silently.
//
// With 32 bytes of secret randomness mixed in, every candidate message is equally consistent with
// the published code, so there is nothing to guess. The nonce is stored in capsule_entries (which
// anon cannot read) and released in 2047 with the message, so the code still verifies publicly —
// which is the property the site actually promises.
const COMMIT_VERSION = 'capsule-v2'
const newNonce = () => hex(crypto.getRandomValues(new Uint8Array(32)))
const commit = (nonce: string, message: string) => sha256Hex(`${COMMIT_VERSION}|${nonce}|${message}`)

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
  // ---------------------------------------------------------------------------------------------
  // A purchased gift. No entry is created here: the recipient creates it when they redeem.
  // ---------------------------------------------------------------------------------------------
  if (session.metadata?.kind === 'capsule_gift') {
    const token = session.metadata?.gift_token ?? ''
    if (!token) {
      console.error('paid gift session with no token', session.id)
      return new Response(JSON.stringify({ error: 'no token' }), { status: 200 })
    }

    const purchaserEmail = session.customer_details?.email ?? null
    const recipientEmail = session.metadata?.recipient_email || null
    const recipientName = session.metadata?.recipient_name || null
    const purchaserName = session.metadata?.purchaser_name || null
    const giftNote = session.metadata?.gift_note || null

    // Only the hash is stored. The raw token lives in the buyer's email and in this Stripe
    // session, so losing the email is recoverable and losing the database is not exploitable.
    const { error: giftErr } = await supabase.from('capsule_gifts').insert({
      token_hash: await sha256Hex(token),
      purchaser_name: purchaserName,
      purchaser_email: purchaserEmail,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      gift_note: giftNote,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      amount_cents: session.amount_total ?? 500,
    })

    if (giftErr) {
      // Replayed webhook: stripe_session_id is unique, so the gift already exists.
      if (giftErr.code === '23505') {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 })
      }
      console.error('failed to record gift', giftErr)
      return new Response(JSON.stringify({ error: 'insert failed' }), { status: 500 })
    }

    const link = `${SITE_URL}/g/${token}`

    // The recipient's invite goes first, so the buyer's receipt can say truthfully whether it was
    // sent - the same ordering fix the sealed receipt needed.
    let invited = false
    const wantsInvite = Boolean(recipientEmail)
    if (wantsInvite) {
      try {
        const sent = await sendGiftInvite(recipientEmail!, {
          link,
          recipientName,
          purchaserName,
          giftNote,
        })
        invited = sent.ok
        if (!sent.ok) console.error('gift invite failed', session.id, sent.error)
      } catch (err) {
        console.error('gift invite threw', session.id, err)
      }
    }

    // The buyer always gets the link, whether or not we emailed the recipient. If they meant to
    // hand it over on Christmas morning, this email IS the present.
    if (purchaserEmail) {
      try {
        const sent = await sendGiftPurchased(purchaserEmail, {
          link,
          recipientName,
          invited,
          wantsInvite,
        })
        if (!sent.ok) console.error('gift receipt failed', session.id, sent.error)
      } catch (err) {
        console.error('gift receipt threw', session.id, err)
      }
    }

    return new Response(JSON.stringify({ ok: true, gift: true }), { status: 200 })
  }

  if (session.metadata?.kind !== 'capsule_entry') {
    return new Response(JSON.stringify({ ignored: 'not a capsule entry' }), { status: 200 })
  }

  const message = (session.metadata?.message ?? '').slice(0, 100)
  if (!message) {
    console.error('paid session with no message', session.id)
    return new Response(JSON.stringify({ error: 'no message' }), { status: 200 })
  }

  const nonce = newNonce()
  const hash = await commit(nonce, message)
  const displayName = session.metadata?.display_name || null
  const location = session.metadata?.location || null

  // 1. Seal the message.
  const { data: entry, error: entryErr } = await supabase
    .from('capsule_entries')
    .insert({
      message,
      message_hash: hash,
      // Never leaves capsule_entries until 2047. Without it the published code is guessable.
      nonce,
      display_name: displayName,
      location,
      contact_email: session.customer_details?.email ?? null,
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      amount_cents: session.amount_total ?? 500,
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

  // 3. Tell the recipient something exists for them — BEFORE the buyer's receipt, so the receipt
  //    can state truthfully whether it arrived. The flag used to be Boolean(recipient_email), which
  //    meant a typo'd address or a Resend outage still told the buyer "we have emailed them" while
  //    the recipient heard nothing: the whole gift failing silently at both ends.
  //
  //    Non-fatal, like the receipt. The note is already sealed and a bounced announcement must not
  //    make Stripe retry the webhook and re-run everything above it.
  //
  //    It deliberately does NOT contain the note, and says so. Someone finding out that a person
  //    wrote them something they cannot read for twenty years IS the gift; a preview would spend it
  //    on the day it arrived. This is the one email the capsule sends to someone who did not pay.
  // 3. Confirmation to whoever wrote it. Non-fatal: the note is already sealed, and returning
  //    non-200 here would make Stripe retry the whole webhook because an email bounced.
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
