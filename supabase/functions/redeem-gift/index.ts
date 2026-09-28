// Redeeming a gift: someone else already paid, this person writes the sentence.
//
// Two actions, both POST, both taking the raw token from the /g/:token URL:
//
//   peek    — is this link real, unused and still in time? Returns only what the page needs to
//             greet them, never the token hash and never an email address.
//   redeem  — validate, screen, and seal. No Stripe involved: the entry was paid for when the gift
//             was bought, which is the entire point of the feature.
//
// The token is a bearer credential. It is never logged, never echoed back, and only its sha256 is
// compared against the database — a leak of capsule_gifts hands nobody a usable link.
//
// This function writes into the capsule, so it is the second most dangerous thing in the project
// after the webhook. Everything it does is gated on holding a token that exists and has not been
// used, and the claim/insert is a single transaction in capsule_redeem_gift so a shared link that
// two people open at once cannot seal twice.

import { moderate } from '../_shared/moderate.ts'
import { sendSealed } from '../_shared/email.ts'

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://20yearcapsule.com'
const SEALS_AT_MS = Date.parse('2027-01-01T07:59:59Z') // 2026-12-31 23:59:59 PST
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

const json = (body: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

const INVISIBLE = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g
const clean = (s: unknown, max: number) =>
  typeof s === 'string' ? s.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return hex(new Uint8Array(d))
}

// Identical to the webhook's scheme. If these two ever disagree, entries sealed by one path stop
// verifying against the codes published for the other, so this string is load-bearing.
const COMMIT_VERSION = 'capsule-v2'
const newNonce = () => hex(crypto.getRandomValues(new Uint8Array(32)))
const commit = (nonce: string, message: string) => sha256Hex(`${COMMIT_VERSION}|${nonce}|${message}`)

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

Deno.serve(async (req) => {
  const CORS = corsFor(req)
  const reply = (body: unknown, status = 200) => json(body, status, CORS)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    // Bounded before hashing so an enormous body cannot be used to burn CPU on this endpoint.
    if (!token || token.length > 128) return reply({ state: 'not_found' }, 404)

    const tokenHash = await sha256Hex(token)

    // Only the columns the redemption page is allowed to see. recipient_email, purchaser_email and
    // token_hash are deliberately absent: the person holding the link is not necessarily the person
    // it was bought for, and this endpoint must not become an address lookup.
    const res = await db(
      `capsule_gifts?select=recipient_name,purchaser_name,gift_note,redeemed_at,refunded_at,entry_seq&token_hash=eq.${tokenHash}`,
    )
    const rows = res.ok ? await res.json() : []
    const gift = Array.isArray(rows) && rows.length ? rows[0] : null

    if (!gift) return reply({ state: 'not_found' }, 404)
    if (gift.refunded_at) return reply({ state: 'refunded' }, 410)
    if (gift.redeemed_at) return reply({ state: 'redeemed', seq: gift.entry_seq }, 410)
    if (Date.now() >= SEALS_AT_MS) return reply({ state: 'sealed' }, 410)

    // ---------------------------------------------------------------------------------------
    if (body.action === 'peek') {
      return reply({
        state: 'open',
        recipient_name: gift.recipient_name ?? null,
        purchaser_name: gift.purchaser_name ?? null,
        gift_note: gift.gift_note ?? null,
      })
    }

    if (body.action !== 'redeem') return reply({ error: 'Unknown action.' }, 400)

    // ---------------------------------------------------------------------------------------
    // Redeem.
    // ---------------------------------------------------------------------------------------
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
    if (email && !EMAIL_RE.test(email)) {
      return reply({ error: 'That email address does not look right.' }, 400)
    }

    // Screened exactly like a paid entry. A gift is not a trusted path: the person holding the link
    // is a stranger to us, and what they write is published in 2047 beside everyone else's.
    const verdict = moderate(message)
    if (verdict.action === 'block') {
      return reply({ error: verdict.message ?? 'This note cannot be accepted.' }, 422)
    }
    for (const [label, value] of [
      ['name', displayName],
      ['location', location],
    ] as [string, string][]) {
      if (value && moderate(value).action === 'block') {
        return reply({ error: `That ${label} cannot be accepted.` }, 422)
      }
    }

    const nonce = newNonce()
    const messageHash = await commit(nonce, message)

    // One transaction: claims the gift, writes the entry, publishes the wall row. See the migration
    // for why this cannot safely be three calls from here.
    const rpc = await db('rpc/capsule_redeem_gift', {
      method: 'POST',
      body: JSON.stringify({
        p_token_hash: tokenHash,
        p_message: message,
        p_message_hash: messageHash,
        p_nonce: nonce,
        p_display_name: displayName,
        p_location: location,
        p_email: email,
        p_flagged: verdict.action === 'flag',
        p_flag_reasons: verdict.reasons,
      }),
    })

    if (!rpc.ok) {
      const err = await rpc.text()
      // Lost the race, or the link was used between the peek above and this call.
      if (err.includes('gift_already_redeemed')) return reply({ state: 'redeemed' }, 410)
      if (err.includes('gift_refunded')) return reply({ state: 'refunded' }, 410)
      if (err.includes('gift_not_found')) return reply({ state: 'not_found' }, 404)
      console.error('redeem failed', err)
      return reply({ error: 'Could not seal that. Nothing was charged and the link still works.' }, 500)
    }

    const out = await rpc.json()
    const row = Array.isArray(out) ? out[0] : out
    const seq = row?.seq

    // Confirmation to whoever wrote it, not to whoever paid. Non-fatal for the usual reason: the
    // note is sealed and a bounced email must not undo that.
    if (email && seq) {
      try {
        const sent = await sendSealed(email, { seq, hash: messageHash, name: displayName || null })
        if (!sent.ok) console.error('gift sealed email failed', seq, sent.error)
      } catch (err) {
        console.error('gift sealed email threw', seq, err)
      }
    }

    return reply({ state: 'sealed_ok', seq, message_hash: messageHash })
  } catch (err) {
    console.error('redeem-gift failed', err)
    return reply({ error: 'Something went wrong.' }, 500)
  }
})
