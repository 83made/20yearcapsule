import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SEAL_LABEL, OPEN_LABEL } from '../lib/capsule.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/redeem-gift`
const SITE = typeof window === 'undefined' ? '' : window.location.origin

/**
 * The thing you actually hand over.
 *
 * A gift that exists only as a URL in a text message is a poor present, so this is a card: one
 * panel, printable, with the link written out in full so it survives being printed on paper where
 * nothing is clickable.
 *
 * Deliberately printed WITHOUT the site chrome — @media print drops the header, the buttons and the
 * explanation, leaving only the card itself on the page.
 */
export default function GiftCard() {
  const { token } = useParams()
  const [gift, setGift] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(FN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
          },
          body: JSON.stringify({ token, action: 'peek' }),
        })
        const d = await res.json().catch(() => ({}))
        if (!alive) return
        setGift(d)
        setState(d?.state === 'open' ? 'ready' : (d?.state ?? 'not_found'))
      } catch {
        if (alive) setState('not_found')
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const link = `${SITE}/g/${token}`

  return (
    <div className="min-h-screen">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.6in; }
          body { background: #fff; }
          .card { border-color: #12100c !important; box-shadow: none !important; }
        }
      `}</style>

      <header className="no-print bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        {state === 'loading' && <p className="font-mono text-sm text-muted">Loading the card…</p>}

        {state !== 'loading' && state !== 'ready' && (
          <div className="no-print">
            <h1 className="font-display text-4xl leading-tight">
              {state === 'redeemed'
                ? 'This one has already been written.'
                : state === 'refunded'
                  ? 'This gift was refunded.'
                  : 'This link is not valid.'}
            </h1>
            <p className="mt-5 max-w-lg leading-relaxed text-ink-2">
              There is nothing to print. A card is only useful while the entry is still waiting to
              be written.
            </p>
            <Link to="/" className="btn btn-ghost mt-8">
              Back to the capsule
            </Link>
          </div>
        )}

        {state === 'ready' && (
          <>
            <div className="no-print mb-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => window.print()} className="btn btn-primary">
                Print this card
              </button>
              <span className="text-[0.9rem] text-ink-3">
                Or screenshot it. Only the card prints.
              </span>
            </div>

            <div className="card border-2 border-ink bg-paper p-10 md:p-14">
              <div className="label">The 20 Year Capsule</div>

              <h1 className="mt-6 font-display text-4xl leading-[1.05] md:text-5xl">
                {gift?.recipient_name ? `${gift.recipient_name},` : 'For you,'}
                <br />
                a place in 2047.
              </h1>

              <p className="mt-7 max-w-lg text-[1.05rem] leading-relaxed text-ink-2">
                {gift?.purchaser_name ? `${gift.purchaser_name} has` : 'Someone has'} paid for an
                entry in a time capsule and put your name on it. You write one sentence. It is
                sealed on {SEAL_LABEL.split(' · ')[0]} and nobody reads it &mdash; not you, not
                them, not us &mdash; until {OPEN_LABEL}, twenty years later.
              </p>

              {gift?.gift_note && (
                <blockquote
                  className="mt-7 border-l-2 pl-5 font-display text-2xl leading-snug text-ink-2"
                  style={{ borderColor: 'var(--color-seal)' }}
                >
                  {gift.gift_note}
                </blockquote>
              )}

              <div className="mt-10 border-t border-rule pt-7">
                <div className="label">Write yours here</div>
                <p className="mt-3 break-all font-mono text-[0.95rem] font-bold leading-relaxed text-ink">
                  {link}
                </p>
                <p className="mt-4 text-[0.85rem] leading-relaxed text-muted">
                  Already paid for &mdash; there is nothing to buy and no account to make. The link
                  works once, and only until {SEAL_LABEL.split(' · ')[0]}.
                </p>
              </div>
            </div>

            <p className="no-print mt-8 max-w-xl text-[0.9rem] leading-relaxed text-ink-3">
              Anyone holding this link can write the entry, so treat it like a gift card rather than
              a receipt &mdash; give it to one person.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
