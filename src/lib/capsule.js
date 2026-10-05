// Every date and number in the app comes from here. Both moments genuinely fall in PST (UTC-8) —
// US daylight saving ends in early November, so neither date is PDT. Stored as fixed UTC instants
// so the countdown cannot drift with the viewer's timezone or with future DST rule changes.

/** Submissions close 2026-12-31 23:59:59 PST */
export const SEALS_AT = new Date('2027-01-01T07:59:59Z')

/** The capsule opens 2047-01-01 00:01:00 PST */
export const OPENS_AT = new Date('2047-01-01T08:01:00Z')

export const PRICE_USD = 5

/**
 * Gifts: a prepaid entry the recipient writes themselves.
 *
 * The buyer pays and writes nothing. The recipient gets a link (/g/:token), writes their own
 * sentence, and it seals under THEIR name with no checkout — so you can put your mum in the capsule
 * without making her pay or face Stripe.
 *
 * An earlier version had the buyer write a note *to* someone, which is a different product and was
 * removed rather than adapted. If this flag ever goes back to false, /gift and /g/:token keep
 * working for links already in the wild; it only hides the entry points.
 */
export const GIFTS_ENABLED = true
export const MAX_CHARS = 100

export const SEAL_LABEL = 'December 31, 2026 · 11:59 PM PST'
export const OPEN_LABEL = 'January 1, 2047 · 12:01 AM PST'

/**
 * What keeping this promise actually costs, kept here because the number still matters even though
 * it is no longer a condition of the capsule going ahead.
 *
 *   domain, 20 years of .com renewals rising ~5%/yr from $15   ~$496
 *   static hosting at $5/mo for 20 years (worst case)          ~$1,200
 *   one email send to every participant in 2047                  ~$25
 *                                                             ---------
 *                                                              ~$1,721
 *
 * At $5 an entry Stripe takes 2.9% + 30c, leaving $4.555, so roughly 378 entries would cover it.
 *
 * There used to be a MINIMUM_ENTRIES floor at exactly that number, and below it everyone was
 * refunded and nothing was sealed. It was removed on 2026-10-04 when the capsule became an annual
 * series: a present that might evaporate is a bad present, and the conditionality cost more in
 * conversion than the funding guarantee was worth. The obligation did not go away with it — it now
 * rests on the operator continuing to run the thing, which is a choice made knowingly rather than
 * a paragraph that was deleted.
 *
 * Note the database is NOT in that list: once the capsule seals it becomes a static archive with
 * nothing to query, so Supabase only has to exist from launch to January 2027.
 */

/**
 * How many notes the capsule will hold. Ten thousand is deliberately reachable: a cap nobody could
 * ever hit is decoration, and this one is meant to be a real limit that closes.
 *
 * Do not render this as a progress meter. At 144 sealed a bar against 10,000 reads 1% full, which
 * says "nobody is here" far louder than the cap says "space is limited". The scarcity that is
 * actually true and actually persuasive is that entry numbers are issued in order and never
 * reused — #000145 exists once.
 */
export const CAPACITY = 10000

/**
 * Human "2 hours ago" style, for the last-sealed line.
 *
 * Recency is the participation signal that works at low counts: "12 sealed" says little, but
 * "last one 40 minutes ago" says people are doing this right now, which is the thing a hesitant
 * visitor is actually looking for.
 */
export function timeAgo(iso, now = new Date()) {
  if (!iso) return null
  const secs = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))
  if (secs < 90) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

/** What one entry is actually worth after Stripe takes its cut. */
export const NET_PER_ENTRY = PRICE_USD - (0.029 * PRICE_USD + 0.3)

export const isSealed = (now = new Date()) => now >= SEALS_AT
export const isOpen = (now = new Date()) => now >= OPENS_AT
export const atCapacity = (count) => (count ?? 0) >= CAPACITY

/** Whole days/hours/minutes/seconds between now and a target. Never negative. */
export function countdown(target, now = new Date()) {
  let ms = target.getTime() - now.getTime()
  if (ms < 0) ms = 0
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return { days, hours, minutes, seconds, done: ms === 0 }
}

/**
 * There is deliberately no hashMessage() here any more.
 *
 * The published proof code is sha256('capsule-v2|' + nonce + '|' + message), where the nonce is 32
 * bytes of randomness generated server-side at seal time and kept in capsule_entries until 2047.
 * The browser cannot compute it, and it should not try: the old client-side sha256(message) was
 * guessable from a wordlist, which is exactly the hole this closed. The real code comes back from
 * the wall on /sealed and /m/:seq.
 */
