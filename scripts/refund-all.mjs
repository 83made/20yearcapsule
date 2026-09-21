// The refund path, for the case where the capsule does not reach its threshold by December 31.
//
//   node scripts/refund-all.mjs                 # DRY RUN — shows what it would do, changes nothing
//   node scripts/refund-all.mjs --execute       # actually refunds
//   node scripts/refund-all.mjs --execute --seq 42   # refund one entry (e.g. a removed message)
//
// Safety properties, because this spends real money and cannot be undone:
//   - Dry run is the default. You have to type --execute.
//   - Refunds are recorded in capsule_entries.refunded_at / stripe_refund_id, so a re-run skips
//     anything already refunded. Never double-refunds, even if interrupted halfway.
//   - Uses a Stripe idempotency key per entry, so a retry of the same refund is a no-op at Stripe
//     too, not just in our records.
//   - Stops on repeated failures rather than grinding through hundreds of errors.
//
// Worth knowing before you run it: Stripe does NOT return the original processing fee on a refund.
// At $2 an entry that is about 36 cents per refund out of your pocket, with nothing to show for it.
//
// Needs in .env.local or the environment:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, STRIPE_SECRET_KEY

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..')

function fromEnvFile(name) {
  const file = join(ROOT, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : null
}
const env = (n) => process.env[n] || fromEnvFile(n)

const SUPA = env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_KEY')
const STRIPE = env('STRIPE_SECRET_KEY')

const execute = process.argv.includes('--execute')
const seqArg = (() => {
  const i = process.argv.indexOf('--seq')
  return i > -1 ? Number(process.argv[i + 1]) : null
})()

if (!SUPA || !KEY || !STRIPE) {
  console.error('Need SUPABASE_URL, SUPABASE_SERVICE_KEY and STRIPE_SECRET_KEY.')
  process.exit(1)
}

const sb = async (path, init = {}) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

const stripeCall = async (path, body, idempotencyKey) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: new URLSearchParams(body).toString(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`)
  return json
}

// ------------------------------------------------------------------------------------------------

let filter = 'refunded_at=is.null'
if (seqArg) filter += `&seq=eq.${seqArg}`

const rows = await sb(
  `capsule_entries?select=seq,stripe_session_id,stripe_payment_intent,amount_cents,contact_email,created_at&${filter}&order=seq.asc`,
)

if (!rows.length) {
  console.log('')
  console.log('  Nothing to refund — every entry is already refunded, or none matched.')
  console.log('')
} else {
  const total = rows.reduce((a, r) => a + (r.amount_cents ?? 0), 0) / 100
  const feeLoss = rows.length * (0.029 * 2 + 0.3)

  console.log('')
  console.log(`  entries to refund     ${rows.length.toLocaleString()}`)
  console.log(`  amount returned       $${total.toFixed(2)}`)
  console.log(`  processing fees lost  $${feeLoss.toFixed(2)}  (Stripe does not return these)`)
  console.log('')

  if (!execute) {
    console.log('  DRY RUN — nothing has been changed.')
    console.log('  Re-run with --execute to actually issue these refunds.')
    console.log('')
    for (const r of rows.slice(0, 10)) {
      console.log(`    #${String(r.seq).padStart(6, '0')}  ${r.stripe_payment_intent ?? r.stripe_session_id}`)
    }
    if (rows.length > 10) console.log(`    … and ${rows.length - 10} more`)
    console.log('')
  } else {
    let ok = 0
    let failed = 0
    let consecutiveFailures = 0

    for (const r of rows) {
      const label = `#${String(r.seq).padStart(6, '0')}`
      try {
        let paymentIntent = r.stripe_payment_intent
        if (!paymentIntent) {
          // Older rows predate the payment_intent column; look it up from the session.
          const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${r.stripe_session_id}`, {
            headers: { Authorization: `Bearer ${STRIPE}` },
          })
          const session = await res.json()
          paymentIntent =
            typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
          if (!paymentIntent) throw new Error('no payment_intent on session')
        }

        const refund = await stripeCall(
          'refunds',
          { payment_intent: paymentIntent, reason: 'requested_by_customer' },
          // Deterministic per entry: re-running cannot create a second refund at Stripe.
          `capsule-refund-${r.seq}`,
        )

        await sb(`capsule_entries?seq=eq.${r.seq}`, {
          method: 'PATCH',
          body: JSON.stringify({
            refunded_at: new Date().toISOString(),
            stripe_refund_id: refund.id,
            stripe_payment_intent: paymentIntent,
          }),
        })

        ok++
        consecutiveFailures = 0
        if (ok % 25 === 0) console.log(`  … ${ok} refunded`)
      } catch (err) {
        failed++
        consecutiveFailures++
        console.error(`  FAILED ${label}: ${err.message}`)
        if (consecutiveFailures >= 5) {
          console.error('')
          console.error('  Five failures in a row — stopping. Fix the cause and re-run; refunded entries are skipped.')
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
}
