// Refunds gifts that were bought and never written.
//
//   node scripts/refund-lapsed-gifts.mjs              # dry run, the default
//   node scripts/refund-lapsed-gifts.mjs --execute    # actually refunds
//   node scripts/refund-lapsed-gifts.mjs --execute --no-email
//
// Run this ONCE, after the capsule seals on 2026-12-31. Until then a gift is not lapsed, it is
// merely unwritten, and there is still time.
//
// This is deliberately NOT part of refund-all.mjs. That one is a manual tool for returning an entry
// or calling the capsule off. Lapsed gifts refund automatically at the seal date, because the money
// was taken for an entry that can now never exist. Two different events, two scripts.
//
// Safety, matching refund-all.mjs:
//   - Dry run unless you type --execute.
//   - A deterministic Stripe idempotency key per gift, so a retry cannot double-refund at Stripe.
//   - refunded_at / stripe_refund_id are recorded, so re-runs skip what already went back.
//   - Stops after five consecutive failures rather than hammering a broken API.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}
const env = (n) => process.env[n] || fromEnvFile(n)

const SUPA = env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_KEY')
const STRIPE = env('STRIPE_SECRET_KEY')
const RESEND = env('RESEND_API_KEY')

const execute = process.argv.includes('--execute')
const noEmail = process.argv.includes('--no-email')

if (!SUPA || !KEY || !STRIPE) {
  console.error('\n  Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or STRIPE_SECRET_KEY.\n')
  process.exit(1)
}

const sb = async (path, init = {}) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : await res.json()
}

const stripeCall = async (path, body, idempotencyKey) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(STRIPE + ':').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: new URLSearchParams(body).toString(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`)
  return json
}

// Mirrors _shared/email.ts. Kept simple and local: this runs once, from a laptop.
const mailLapsed = async (to, name) => {
  if (!RESEND || !to || noEmail) return
  const who = name ? ` for ${name}` : ''
  const text = `Your gift entry was not used.

You bought an entry in The 20 Year Capsule${who}, and it was not written before the capsule sealed on December 31.

Your $5 has been refunded in full - expect it within 5-10 business days. Nothing was published and nothing was kept.

Thank you for trying to put someone in it. That was a good idea.`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('EMAIL_FROM') || 'The 20 Year Capsule <hello@20yearcapsule.com>',
      to,
      // Same address as every other email the project sends. Refunds are the moment people are
      // most likely to write back, so a reply must not land somewhere nobody is watching.
      reply_to: env('EMAIL_REPLY_TO') || 'hello@20yearcapsule.com',
      subject: 'Your gift entry was not used — refunded in full',
      text,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}`)
}

// Unredeemed, unrefunded, and actually paid for.
const rows = await sb(
  'capsule_gifts?select=id,purchaser_name,purchaser_email,recipient_name,stripe_payment_intent,stripe_session_id,amount_cents,created_at' +
    '&redeemed_at=is.null&refunded_at=is.null&order=created_at.asc',
)

console.log('')
console.log(`  lapsed gifts   ${rows.length.toLocaleString()}`)
console.log(`  to refund      $${((rows.reduce((a, r) => a + (r.amount_cents ?? 500), 0)) / 100).toFixed(2)}`)
console.log(`  mode           ${execute ? 'EXECUTE — money will move' : 'dry run'}`)
console.log('')

if (!rows.length) {
  console.log('  Nothing to do.\n')
} else if (!execute) {
  for (const r of rows.slice(0, 20)) {
    console.log(
      `  ${r.stripe_session_id.slice(0, 24)}…  ${(r.recipient_name || 'no name').padEnd(18)} ${(r.purchaser_email || 'no email')}`,
    )
  }
  if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`)
  console.log('')
  console.log('  Re-run with --execute to actually issue these refunds.')
  console.log('')
} else {
  let ok = 0
  let failed = 0
  let consecutiveFailures = 0

  for (const r of rows) {
    const label = r.stripe_session_id.slice(0, 24)
    try {
      let paymentIntent = r.stripe_payment_intent
      if (!paymentIntent) {
        // Older rows may predate the column being populated; recover it from the session.
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(r.stripe_session_id)}`,
          { headers: { Authorization: `Basic ${Buffer.from(STRIPE + ':').toString('base64')}` } },
        )
        const s = await res.json()
        paymentIntent = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id
      }
      if (!paymentIntent) throw new Error('no payment_intent')

      const refund = await stripeCall(
        'refunds',
        { payment_intent: paymentIntent, reason: 'requested_by_customer' },
        `capsule-gift-lapsed-${r.id}`,
      )

      await sb(`capsule_gifts?id=eq.${r.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          refunded_at: new Date().toISOString(),
          stripe_refund_id: refund.id,
          stripe_payment_intent: paymentIntent,
        }),
      })

      // The refund is what matters; a failed email must not make us retry it.
      try {
        await mailLapsed(r.purchaser_email, r.recipient_name)
      } catch (mailErr) {
        console.error(`  (refunded ${label}, but email failed: ${mailErr.message})`)
      }

      ok++
      consecutiveFailures = 0
      if (ok % 25 === 0) console.log(`  … ${ok} refunded`)
    } catch (err) {
      failed++
      consecutiveFailures++
      console.error(`  FAILED ${label}: ${err.message}`)
      if (consecutiveFailures >= 5) {
        console.error('')
        console.error('  Five failures in a row — stopping. Fix the cause and re-run; refunded gifts are skipped.')
        console.error('')
        break
      }
    }
  }

  console.log('')
  console.log(`  refunded  ${ok.toLocaleString()}`)
  if (failed) console.log(`  failed    ${failed.toLocaleString()}  (re-run to retry — successful ones are skipped)`)
  console.log('')
  if (failed) process.exitCode = 1
}
