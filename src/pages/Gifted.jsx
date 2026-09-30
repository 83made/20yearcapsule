import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SEAL_LABEL } from '../lib/capsule.js'
import { trackPurchase } from '../lib/analytics.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-capsule-checkout`
const SITE = typeof window === 'undefined' ? '' : window.location.origin

/**
 * Where a gift buyer lands after paying.
 *
 * This page exists because of one failure mode: the receipt email not arriving. The link is the
 * entire product — we never store it in a readable form, so if the email is lost and this page did
 * not show it, the buyer would have paid $5 for nothing recoverable. It is read back out of their
 * own paid Stripe session, which is the one place the raw token still exists.
 *
 * So the link is the biggest thing on the page and the copy button is the primary action, above
 * anything else, including the printable card.
 */
export default function Gifted() {
  const [params] = useSearchParams()
  const session = params.get('session')
  const [state, setState] = useState('loading')
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!session) {
      setState('error')
      return
    }
    let alive = true
    ;(async () => {
      // The webhook may not have recorded the gift yet. The token comes from Stripe rather than our
      // database, so this works regardless — but a short retry keeps the page from looking broken
      // if it is opened the instant checkout redirects.
      for (let i = 0; i < 4; i++) {
        try {
          const res = await fetch(FN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
            },
            body: JSON.stringify({ kind: 'gift_link', session_id: session }),
          })
          const d = await res.json().catch(() => ({}))
          if (!alive) return
          if (res.ok && d.token) {
            setData(d)
            setState('ready')
            // Only now: gift_link returns a token solely for a session Stripe has confirmed paid,
            // so reaching here is proof of payment rather than proof of a redirect.
            trackPurchase(session, 'gift')
            return
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 1200))
      }
      if (alive) setState('error')
    })()
    return () => {
      alive = false
    }
  }, [session])

  const link = data?.token ? `${SITE}/g/${data.token}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14">
        {state === 'loading' && <p className="font-mono text-sm text-muted">Preparing the link…</p>}

        {state === 'error' && (
          <>
            <h1 className="font-display text-4xl leading-tight">
              We could not load the link on this page.
            </h1>
            <p className="mt-5 max-w-lg leading-relaxed text-ink-2">
              If the payment went through, the link is in the receipt we emailed you. If it is not
              there either, reply to that email and we will sort it out &mdash; nothing is lost.
            </p>
            <Link to="/" className="btn btn-ghost mt-8">
              Back to the capsule
            </Link>
          </>
        )}

        {state === 'ready' && (
          <>
            <span className="stamp">Paid</span>
            <h1 className="mt-6 font-display text-5xl leading-[0.95] md:text-6xl">
              {data.recipient_name ? `${data.recipient_name}’s` : 'Their'} entry
              <br />
              is paid for.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
              {data.invited
                ? 'We have emailed them the link. They can write their sentence whenever they like.'
                : 'Here is the link. Give it to them however you want — text it, print it, hand it over.'}
            </p>

            <div className="mt-10 border border-rule bg-paper-2 p-6 sm:p-8">
              <div className="label">Their link</div>
              <p className="mt-3 break-all font-mono text-[0.9rem] leading-relaxed text-ink">
                {link}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={copy} className="btn btn-primary">
                  {copied ? 'Copied' : 'Copy the link'}
                </button>
                <Link to={`/g/${data.token}/card`} className="btn btn-ghost">
                  Print a card
                </Link>
              </div>
            </div>

            <div className="mt-10 border-t border-rule pt-8">
              <h2 className="font-display text-2xl">Worth knowing</h2>
              <ul className="mt-4 grid gap-3 text-[0.95rem] leading-relaxed text-ink-3">
                <li>
                  <strong className="font-semibold text-ink-2">The link works once.</strong> When
                  they seal their sentence it stops working, which is how you know it was used.
                </li>
                <li>
                  <strong className="font-semibold text-ink-2">They write it, not you.</strong> It
                  is published under their name in 2047, and you will not see it before then either.
                </li>
                <li>
                  <strong className="font-semibold text-ink-2">
                    Unused by {SEAL_LABEL.split(' · ')[0]}?
                  </strong>{' '}
                  You are refunded in full, automatically. There is nothing to chase.
                </li>
                <li>
                  <strong className="font-semibold text-ink-2">Keep the receipt email.</strong> We
                  do not store this link in a form we can read back, so that email is the only copy
                  besides this page.
                </li>
              </ul>
            </div>

            <p className="mt-10 text-[0.9rem] text-ink-3">
              <Link to="/gift" className="underline underline-offset-4">
                Give another one
              </Link>{' '}
              ·{' '}
              <Link to="/#write" className="underline underline-offset-4">
                Write your own
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  )
}
