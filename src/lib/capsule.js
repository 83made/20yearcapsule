// Every date and number in the app comes from here. Both moments genuinely fall in PST (UTC-8) —
// US daylight saving ends in early November, so neither date is PDT. Stored as fixed UTC instants
// so the countdown cannot drift with the viewer's timezone or with future DST rule changes.

/** Submissions close 2026-12-31 23:59:59 PST */
export const SEALS_AT = new Date('2027-01-01T07:59:59Z')

/** The capsule opens 2047-01-01 00:01:00 PST */
export const OPENS_AT = new Date('2047-01-01T08:01:00Z')

export const PRICE_USD = 2
export const MAX_CHARS = 100

export const SEAL_LABEL = 'December 31, 2026 · 11:59 PM PST'
export const OPEN_LABEL = 'January 1, 2047 · 12:01 AM PST'

/**
 * The capsule only happens if it can actually be kept for twenty years, so the threshold is derived
 * from real cost rather than picked for looks.
 *
 *   domain, 20 years of .com renewals rising ~5%/yr from $15   ~$496
 *   static hosting at $5/mo for 20 years (worst case)          ~$1,200
 *   one email send to every participant in 2047                  ~$25
 *                                                             ---------
 *                                                              ~$1,721
 *
 * At $2 an entry Stripe takes 2.9% + 30¢, leaving $1.642. 1,000 entries nets $1,642.
 *
 * Note the database is NOT in that list: once the capsule seals it becomes a static archive with
 * nothing to query, so Supabase only has to exist from launch to January 2027.
 */
export const GOAL_ENTRIES = 1000

/** What one entry is actually worth after payment processing. Used for the funding readout. */
export const NET_PER_ENTRY = 2 - (0.029 * 2 + 0.3)

export const isSealed = (now = new Date()) => now >= SEALS_AT
export const isOpen = (now = new Date()) => now >= OPENS_AT
export const goalMet = (count) => (count ?? 0) >= GOAL_ENTRIES
export const goalPct = (count) => Math.min(100, ((count ?? 0) / GOAL_ENTRIES) * 100)

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

/** SHA-256 of the exact message text, lowercase hex. This is what gets published as proof. */
export async function hashMessage(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
