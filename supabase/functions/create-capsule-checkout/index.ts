// Takes the message, validates it, and hands Stripe a Checkout Session.
//
// The message is NOT stored here. It rides in the session metadata and is only written to the
// database by the webhook, after payment actually succeeds. That way an abandoned checkout never
// leaves an unpaid message in the capsule.

import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { moderate } from '../_shared/moderate.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-08-27.basil' })
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://20yearcapsule.com'
const SEALS_AT_MS = Date.parse('2027-01-01T07:59:59Z') // 2026-12-31 23:59:59 PST

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Deliberately narrow. Stripe metadata values cap at 500 chars, and these are shown publicly.
const clean = (s: unknown, max: number) =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (Date.now() >= SEALS_AT_MS) {
      return json({ error: 'The capsule is sealed. It opens January 1, 2047.' }, 410)
    }

    const body = await req.json().catch(() => ({}))
    const message = clean(body.message, 100)
    const displayName = clean(body.display_name, 40)
    const location = clean(body.location, 40)
    const email = clean(body.email, 120)

    if (!message) return json({ error: 'A message is required.' }, 400)
    if (message.length > 100) return json({ error: 'Messages are limited to 100 characters.' }, 400)

    // Screen BEFORE taking money. A blocked message never becomes a payment, so it never becomes a
    // refund. Flagged messages proceed normally and are queued for review after sealing.
    const verdict = moderate(message)
    if (verdict.action === 'block') {
      return json({ error: verdict.message ?? 'This message cannot be accepted.' }, 422)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${SITE_URL}/sealed?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/?canceled=1`,
      customer_email: email || undefined,
      // Collecting an email gives us a way to actually tell people in 2047. Optional on purpose —
      // requiring it would cost conversions on a $1 impulse purchase.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: 200,
            product_data: {
              name: 'One sentence in The 20 Year Capsule',
              description: 'Sealed December 31, 2026. Opens January 1, 2047.',
              // Required because this account has Managed Payments enabled — without a tax code
              // Stripe rejects the line item outright. "General - Electronically Supplied Services"
              // is the honest classification: a digital service, nothing downloaded or shipped.
              tax_code: 'txcd_10000000',
            },
          },
        },
      ],
      metadata: {
        message,
        display_name: displayName,
        location,
        kind: 'capsule_entry',
        // Carried through so the webhook does not have to re-run moderation on a different
        // code path and risk the two disagreeing.
        flagged: verdict.action === 'flag' ? '1' : '0',
        flag_reasons: verdict.reasons.join(','),
      },
    })

    return json({ url: session.url })
  } catch (err) {
    console.error('create-capsule-checkout failed', err)
    return json({ error: 'Could not start checkout.' }, 500)
  }
})
