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
const CAPACITY = 10_000 // a real ceiling, enforced here so it cannot be exceeded by a race

// Deliberately permissive: the job is to catch a typo and an obviously-bogus string, not to
// adjudicate RFC 5322. Anything stricter rejects real addresses, and the only cost of a loose
// match is one bounced send.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Gift tokens are generated HERE, before payment, and travel in the Stripe session metadata.
//
// Only sha256(token) is ever written to capsule_gifts, so a leak of our database hands nobody a
// usable redemption link. The raw token reaches the buyer by email and, if that fails, by reading
// it back off their own paid Stripe session on the success page — which is why it rides in
// metadata rather than being minted in the webhook where nothing could recover it.
const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const newGiftToken = () => b64url(crypto.getRandomValues(new Uint8Array(24)))

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

    // Capacity. Unlike the old million this one is genuinely reachable, so the check matters:
    // a stated limit that is not enforced is not a limit, and refunding someone who paid for
    // a slot that did not exist is worse than turning them away.
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
      return reply({ error: 'The capsule is full. It holds 10,000 notes and they are all taken.' }, 409)
    }

    const body = await req.json().catch(() => ({}))

    // ---------------------------------------------------------------------------------------
    // Recovering a gift link from the buyer's own paid session.
    // ---------------------------------------------------------------------------------------
    // The success page needs the raw token, and we deliberately never stored one. Stripe did, in
    // the session metadata, so it is read back from there. The session id is the credential: it
    // appears in the buyer's own success URL and their Stripe receipt, and nowhere else.
    //
    // Gated on the session actually being paid, so an abandoned checkout cannot be used to mint a
    // working entry link for free.
    if (body.kind === 'gift_link') {
      const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''
      if (!sessionId || sessionId.length > 200) return reply({ error: 'Not found.' }, 404)

      const paid = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null)
      if (!paid || paid.payment_status !== 'paid' || paid.metadata?.kind !== 'capsule_gift') {
        return reply({ error: 'Not found.' }, 404)
      }

      return reply({
        token: paid.metadata?.gift_token ?? '',
        recipient_name: paid.metadata?.recipient_name || null,
        invited: Boolean(paid.metadata?.recipient_email),
      })
    }

    // ---------------------------------------------------------------------------------------
    // Which entry did this session become?
    // ---------------------------------------------------------------------------------------
    // /sealed used to show whichever wall row was newest, on the assumption that it was yours.
    // With two people buying within a few seconds of each other it was not: the second to load the
    // page saw a stranger's entry number and proof code presented as their own, contradicting the
    // confirmation email they had just been sent.
    //
    // capsule_wall deliberately carries no payment columns, so the browser cannot ask this itself.
    // It is answered here, gated the same way as gift_link: the session id is the credential, and
    // it only appears in the buyer's own success URL and Stripe receipt.
    //
    // Returns the sequence number and nothing else. The wall row it points at is world-readable
    // anyway, so there is no reason for this to go anywhere near the message or the nonce.
    if (body.kind === 'entry_link') {
      const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''
      if (!sessionId || sessionId.length > 200) return reply({ error: 'Not found.' }, 404)

      const paid = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null)
      if (!paid || paid.payment_status !== 'paid' || paid.metadata?.kind !== 'capsule_entry') {
        return reply({ error: 'Not found.' }, 404)
      }

      const res = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/rest/v1/capsule_entries?select=seq&stripe_session_id=eq.${encodeURIComponent(sessionId)}`,
        {
          headers: {
            apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
          },
        },
      )
      const rows = res.ok ? await res.json() : []
      // null rather than 404 while the webhook is still in flight, so the page keeps polling
      // instead of deciding something went wrong.
      return reply({ seq: Array.isArray(rows) && rows.length ? rows[0].seq : null })
    }

    // ---------------------------------------------------------------------------------------
    // Gift purchase. Buys the right to create an entry; writes nothing.
    // ---------------------------------------------------------------------------------------
    // Nothing here is sealed, so there is no message to validate or screen. What IS screened is
    // every field a stranger will later read on the redemption page: the buyer's name and their
    // note are shown to the recipient, and an unscreened field shown to a third party is how the
    // last version of gifts became an abuse primitive.
    if (body.kind === 'gift') {
      const purchaserName = clean(body.purchaser_name, 40)
      const giftRecipientName = clean(body.recipient_name, 40)
      const giftRecipientEmail = clean(body.recipient_email, 120)
      const giftNote = clean(body.gift_note, 200)

      if (giftRecipientEmail && !EMAIL_RE.test(giftRecipientEmail)) {
        return reply({ error: 'Their email address does not look right.' }, 400)
      }
      for (const [label, value] of [
        ['name', purchaserName],
        ['name', giftRecipientName],
        ['message', giftNote],
      ] as [string, string][]) {
        if (value && moderate(value).action === 'block') {
          return reply({ error: `That ${label} cannot be accepted.` }, 422)
        }
      }

      const giftToken = newGiftToken()
      const giftSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: `${SITE_URL}/gifted?session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/?canceled=1`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: 500,
              product_data: {
                name: giftRecipientName
                  ? `An entry in The 20 Year Capsule — a gift for ${giftRecipientName}`.slice(0, 250)
                  : 'An entry in The 20 Year Capsule — a gift',
                description: 'They write it. Sealed December 31, 2026. Opens January 1, 2047.',
                tax_code: 'txcd_10000000',
              },
            },
          },
        ],
        metadata: {
          kind: 'capsule_gift',
          gift_token: giftToken,
          purchaser_name: purchaserName,
          recipient_name: giftRecipientName,
          recipient_email: giftRecipientEmail,
          gift_note: giftNote,
        },
      })

      return reply({ url: giftSession.url })
    }


    // Check the raw length BEFORE truncating. Previously clean() sliced to 100 first, so this
    // branch could never fire: someone pasting 600 characters was charged $5 and silently had
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


    if (!message) return reply({ error: 'A note is required.' }, 400)
    if (message.length > 100) return reply({ error: 'Notes are limited to 100 characters.' }, 400)

    // Checked here rather than trusting type="email" in the browser, which is one fetch away from
    // being bypassed. A malformed buyer address makes Stripe reject the session, which reached the
    // buyer as a bare "Could not start checkout." with nothing to act on; a malformed recipient
    // address means the gift is never announced and nobody finds out.
    if (email && !EMAIL_RE.test(email)) {
      return reply({ error: 'That email address does not look right.' }, 400)
    }

    // Screen BEFORE taking money. A blocked message never becomes a payment, so it never becomes a
    // refund. Flagged messages proceed normally and are queued for review after sealing.
    const verdict = moderate(message)
    if (verdict.action === 'block') {
      return reply({ error: verdict.message ?? 'This note cannot be accepted.' }, 422)
    }

    // EVERY field that renders on the public wall is screened, not just the note. display_name and
    // location were published unscreened until 2026-09-27, which meant $5 bought a slur on a public
    // page and a permanent line in the 2047 archive. It also made the gift announcement an abuse
    // primitive: the sender name in an email this site delivers to a stranger is this field.
    //
    // Blocks only, no flags. The flag list is tuned for sentences and fires constantly on real
    // names and places — "possible_address" matches most street names by design.
    const publicFields: [string, string][] = [
      ['name', displayName],
      ['location', location],
    ]
    for (const [label, value] of publicFields) {
      if (value && moderate(value).action === 'block') {
        return reply({ error: `That ${label} cannot be accepted.` }, 422)
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${SITE_URL}/sealed?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/?canceled=1`,
      // customer_email is deliberately NOT set.
      //
      // Stripe pre-fills it and makes it read-only, so passing the writer's address meant whoever
      // actually paid could not correct it. That misrouted the Stripe receipt, our own confirmation
      // and the Link SMS verification to the wrong person the first time someone bought a note on
      // somebody else's behalf — and the payer had no way to fix it at checkout.
      //
      // The payer now enters their own address for the receipt; the writer's address rides in
      // metadata below and is what the webhook stores as the 2047 contact.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: 500,
            product_data: {
              // Named for what it is on the buyer's card statement and Stripe receipt. Someone
              // buying a present in December should not have to decode their own line item.
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
        // Who to tell in 2047 — the person who wrote it, which is not necessarily whoever paid.
        contact_email: email,
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
