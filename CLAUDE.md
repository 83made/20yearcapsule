# 20yearcapsule.com

One sentence, $1, sealed for twenty years.

- **Entries close** 2026-12-31 23:59:59 **PST** (= 2027-01-01 07:59:59 UTC)
- **Capsule opens** 2047-01-01 00:01:00 **PST** (= 2047-01-01 08:01:00 UTC)
- Both dates genuinely fall in PST, not PDT — US DST ends in early November. Verified against the
  tz database; the span is exactly 20.00 years.

**Every date in the app comes from `src/lib/capsule.js`.** Nothing else hardcodes a date except the
database trigger (which needs a literal). If a date ever changes, those are the only two places.

## Stack
React 19 + Vite 8 + Tailwind v4 + Supabase + Stripe, hosted on Netlify.

## The one thing that matters

The entire product is the promise that nobody reads these messages until 2047. **That promise is
enforced in the database, not the frontend.**

- `capsule_entries` — holds the message text. RLS enabled with **zero policies**, so anon and
  authenticated are denied everything. Only `service_role` (the webhook) can touch it.
- `capsule_wall` — redacted public metadata: seq, display name, location, char count, hash,
  timestamp. **Never contains message text.** World-readable.

Two tables rather than one table plus a view, deliberately: RLS cannot restrict columns, and a
Postgres view runs as its owner by default, quietly bypassing the underlying RLS. With two tables
there is simply no path from the anon key to a message.

**Never add a SELECT policy to `capsule_entries`.** That single change would break the only promise
the site makes.

## Honesty constraints baked into the copy

The site says messages are *"not published, shown, or shared"* — it does **not** claim nobody can
read them. The operator is the database owner and can. Claiming zero-knowledge would be false, and
true client-side encryption was rejected: it makes moderation impossible and one lost key destroys
the capsule. `/terms` states this plainly.

## The fingerprint

Every message gets a SHA-256 hash published at seal time (`hashMessage` in `capsule.js`, mirrored in
the webhook). It reveals nothing but proves in 2047 that no character changed. It also makes the
archive verifiable by anyone, so the promise does not depend on one person keeping a site alive.

## Flow

1. `Compose.jsx` POSTs the message to `create-capsule-checkout`.
2. That function validates, refuses after the seal date, and creates a Stripe Checkout Session with
   the message in `metadata`. **The message is not stored yet** — an abandoned checkout must not
   leave an unpaid entry in the capsule.
3. `capsule-webhook` verifies the Stripe signature, inserts into `capsule_entries` (service role),
   then inserts the redacted row into `capsule_wall`.
4. Idempotent via a unique constraint on `stripe_session_id` — a replayed webhook cannot double-seal.
   A failed wall insert is logged, not fatal: the message is sealed and the row can be backfilled.

## Commands

```bash
npm run dev      # local dev
npm run build    # -> dist/
npm run preview
```

## Setup still required

1. Create the Supabase project, run `supabase/migrations/20260921000100_capsule.sql`.
2. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Netlify env + `.env.local`).
3. Deploy both edge functions with `--no-verify-jwt`.
4. Secrets on the functions: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`.
5. Add the Stripe webhook endpoint for `checkout.session.completed` pointing at `capsule-webhook`.
   **Check the endpoint actually subscribes to that event** — a handler with no matching
   subscription silently never fires.

## Funding threshold

`GOAL_ENTRIES = 1000` in `capsule.js`, derived from real 20-year cost, not picked for looks:
domain renewals ~$496 + worst-case paid static hosting ~$1,200 + the 2047 email send ~$25 = ~$1,721.
At $2 an entry Stripe leaves $1.642, so 1,000 entries nets $1,642. Break-even on the *realistic*
case (free static hosting) is 318.

There is no database in that model on purpose: once the capsule seals it is a static archive with
nothing to query, so Supabase only has to exist from launch to January 2027.

**If the threshold is missed, everyone is refunded and nothing is sealed.** That is what makes the
threshold mean something and gives every buyer a reason to recruit the next one. The cost of that
promise is real: Stripe does not return processing fees on refunds, so a failed run costs ~36c per
entry out of pocket.

## Moderation

`supabase/functions/_shared/moderate.ts`, called from `create-capsule-checkout` **before** Stripe —
a blocked message never becomes a payment, so it never becomes a refund.

- **block** — CSAM terms, slurs, credible threats, messages with no letters at all. Rejected outright.
- **flag** — addresses, phone numbers, emails, URLs, crypto addresses, self-harm language. Sealed
  normally and queued for human review, because auto-rejecting these fires on far too many innocent
  messages. In 100 characters "call me at 555-1234" is usually nostalgia.

Normalisation (leetspeak, spacing, accents) matters more than wordlist length; the list is
deliberately short and in one place. Human review is the real backstop.

**The letters check must stay `\p{L}`, never `[a-z]`.** An ASCII test silently rejects every message
written in Chinese, Arabic, Cyrillic, Hebrew, Japanese, Greek or Hindi. This was a live bug caught
in testing.

Review queue: `node scripts/review-flagged.mjs`, then `--ok <seq>` or `--remove <seq> "reason"`.
Removing sets `removed_at`, and a trigger deletes the row from the public wall while keeping the
entry for the payment record and audit trail.

## The failsafe

The project must not depend on a website, a database, or anyone remembering a password in 2047.

- `node scripts/export-capsule.mjs` — run once sealed. Writes a **public manifest** (no message
  text, safe to publish immediately as a commitment to the exact contents) and an **AES-256-GCM
  encrypted archive** of every message and email. Back the encrypted file up in several places.
- `node scripts/open-capsule.mjs [--pdf]` — the 2047 script. Decrypts, re-verifies every message
  against its published fingerprint, writes the spreadsheet, the participant mail-merge list, and a
  printable book.

**scrypt `maxmem` is written into the archive file.** N=2^15, r=8 needs ~33MB, over Node's 32MB
default. The dangerous version of that bug encrypts fine today and fails to decrypt in 2047, so the
parameters travel with the ciphertext rather than being assumed. Verified round-trip: identical
output, unicode preserved, wrong passphrase rejected, single-bit tampering detected.

## Refunds

`node scripts/refund-all.mjs` is a **dry run by default**; `--execute` is required to spend money.
Refunds are recorded in `refunded_at`/`stripe_refund_id` so re-runs skip them, and each uses a
deterministic Stripe idempotency key so a retry cannot double-refund at Stripe either. Stops after
5 consecutive failures. `--seq N` refunds one entry, for a removed message.

## Known gaps

- **Cold start.** An empty wall makes the site look dead, and the wall is the persuasion. Seed a
  handful of genuine entries before telling anyone.
- **No transactional email.** Nothing notifies participants of a refund, or of anything else. If the
  threshold is missed, people get a Stripe refund with no explanation from you.
- Fees: at $2, ~36c per sale. Accepted in favour of impulse-price simplicity.
