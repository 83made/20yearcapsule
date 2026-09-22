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
const CAPACITY = 1_000_000 // the capsule holds a million; checked here so it cannot be exceeded

// Only the capsule's own pages need to call this. A wildcard let any site on the internet drive
// live Stripe session creation from a visitor's browser.
const ALLOWED_ORIGINS = new Set([
  SITE_URL,
  'https://20yearcapsule.com',
  'https://www.20yearcapsule.com',
  'http://localhost:5173',
])

const corsFor = (req: Request) => {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : SITE_URL,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// Throttled per IP, storing only a hash of it. A site whose whole pitch is "we do not look at your
// message" should not be quietly accumulating a table of visitor IP addresses.
async function ipHash(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const salt = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? 'capsule'
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}`))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function withinRateLimit(req: Request) {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/capsule_rate_check`, {
      method: 'POST',
      headers: {
        apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip_hash: await ipHash(req) }),
    })
    if (!res.ok) return true // fail open: a throttle outage must not stop real buyers
    return (await res.json()) !== false
  } catch {
    return true
  }
}

const json = (body: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Deliberately narrow. Stripe metadata values cap at 500 chars, and these are shown publicly.
//
// Strips, beyond the obvious control characters:
//   U+200B-200F  zero-width and directional marks. Invisible padding, and a display name made
//                only of these renders as a blank row on the wall.
//   U+202A-202E  bidirectional overrides. These reverse how following text displays, so a name
//                can be made to render as something other than what was actually sealed.
//   U+2066-2069  directional isolates, same problem.
//   U+FEFF       byte order mark.
// React escapes HTML, so this is not about injection. It is about the wall showing exactly what
// went into the capsule, which is the only thing anyone can check for the next twenty years.
const INVISIBLE = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const clean = (s: unknown, max: number) =>
  typeof s === 'string' ? s.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''
  typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : ''

Deno.serve(async (req) => {
  const CORS = corsFor(req)
  const reply = (body: unknown, status = 200) => json(body, status, CORS)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)

  try {
    if (!(await withinRateLimit(req))) {
      return reply({ error: 'Too many attempts. Give it a few minutes and try again.' }, 429)
    }

    if (Date.now() >= SEALS_AT_MS) {
      return reply({ error: 'The capsule is sealed. It opens January 1, 2047.' }, 410)
    }

    // Capacity. Realistically unreachable, but a stated limit that is not enforced is not a limit.
    const countRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/capsule_wall?select=seq&limit=1`,
      {
        headers: {
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
      },
    )
    const total = Number((countRes.headers.get('content-range') ?? '').split('/')[1] ?? 0)
    if (total >= CAPACITY) {
      return reply({ error: 'The capsule is full. It holds one million memories.' }, 409)
    }

    const body = await req.json().catch(() => ({}))

    // Check the raw length BEFORE truncating. Previously clean() sliced to 100 first, so this
    // branch could never fire: someone pasting 600 characters was charged $2 and silently had
    // 500 of them thrown away, with no way to find out until 2047.
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if ([...rawMessage].length > 100) {
      return reply(
        { error: `That is ${[...rawMessage].length} characters. The limit is 100 — trim it and it is yours.` },
        400,
      )
    }

    const message = clean(body.message, 100)
    const displayName = clean(body.display_name, 40)
    const location = clean(body.location, 40)
    const email = clean(body.email, 120)

    if (!message) return reply({ error: 'A message is required.' }, 400)
    if (message.length > 100) return reply({ error: 'Messages are limited to 100 characters.' }, 400)

    // Screen BEFORE taking money. A blocked message never becomes a payment, so it never becomes a
    // refund. Flagged messages proceed normally and are queued for review after sealing.
    const verdict = moderate(message)
    if (verdict.action === 'block') {
      return reply({ error: verdict.message ?? 'This message cannot be accepted.' }, 422)
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

    return reply({ url: session.url })
  } catch (err) {
    console.error('create-capsule-checkout failed', err)
    return reply({ error: 'Could not start checkout.' }, 500)
  }
})
