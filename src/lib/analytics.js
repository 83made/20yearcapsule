/**
 * Purchase tracking.
 *
 * The point of this is the only question the video traffic actually raises: which platform produced
 * money, not which produced visits. GA4 needs a `purchase` event to answer that, and it has to be
 * attached to the same session as the UTM tags that brought them in — so it fires in the browser on
 * the success page, not from the webhook.
 *
 * Two constraints:
 *
 * 1. transaction_id must NOT be the Stripe session id. GA4 wants a stable id per order so a refresh
 *    does not count twice, and the session id is the obvious candidate — but for a gift that id can
 *    be exchanged for the raw redemption token through the gift_link endpoint, by design. Sending it
 *    to Google would put a usable credential in an analytics report, which is the same mistake
 *    /analytics.js exists to avoid. So the id is a SHA-256 of the session, truncated: deterministic
 *    across refreshes, useless to anyone who reads it.
 *
 * 2. It must not double-count. GA4 dedupes on transaction_id, but that is a server-side behaviour
 *    worth not relying on alone, so a sessionStorage guard stops the event firing twice in one
 *    browser session as well.
 *
 * Silently does nothing when gtag is absent, which is the normal case for anyone running an ad
 * blocker. A missing metric must never break a confirmation page.
 */

const PRICE = 5

async function hash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

/**
 * @param {string} sessionId  the Stripe checkout session id — hashed, never sent
 * @param {'note'|'gift'} kind
 */
export async function trackPurchase(sessionId, kind) {
  if (!sessionId || typeof window === 'undefined' || typeof window.gtag !== 'function') return

  try {
    const id = `${kind}-${await hash(sessionId)}`
    const key = `capsule_purchase_${id}`

    // A refresh of /sealed or /gifted must not look like a second sale.
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // Private browsing can throw on sessionStorage. GA4's own transaction_id dedupe still covers
      // the refresh case, so carry on rather than dropping the event entirely.
    }

    window.gtag('event', 'purchase', {
      transaction_id: id,
      value: PRICE,
      currency: 'USD',
      items: [
        {
          item_id: kind === 'gift' ? 'capsule_gift' : 'capsule_entry',
          item_name: kind === 'gift' ? 'Gift entry in The 20 Year Capsule' : 'Entry in The 20 Year Capsule',
          price: PRICE,
          quantity: 1,
        },
      ],
    })
  } catch {
    // Never let a metric break the page someone lands on after paying.
  }
}
