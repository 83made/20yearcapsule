import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import { trackPurchase } from '../lib/analytics.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-capsule-checkout`
import { OPEN_LABEL, OPENS_AT, MINIMUM_ENTRIES } from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'
import Share from '../components/Share.jsx'

/**
 * Where Stripe drops people after payment, and the single highest-intent moment on the site —
 * someone has just done the thing and feels good about it. That is where the share prompt belongs,
 * not buried in a footer.
 *
 * The webhook may not have landed yet, so this polls the public wall briefly rather than promising
 * a row that does not exist. If it never appears the message is still sealed — the wall row is
 * cosmetic — so the copy says that plainly instead of implying something went wrong.
 */
export default function Sealed() {
  const [params] = useSearchParams()
  const [entry, setEntry] = useState(null)
  const [waited, setWaited] = useState(false)

  // Fired here rather than from the webhook so it lands in the same GA session as the utm_* tags
  // that brought them in — which is the whole point of measuring it. Keyed off the session id
  // Stripe puts in the redirect, so it does not depend on the wall row having caught up yet.
  useEffect(() => {
    const session = params.get('session')
    if (session) trackPurchase(session, 'note')
  }, [params])

  // Which entry is MINE.
  //
  // This used to take the newest wall row and assume it was yours. With two people buying within a
  // few seconds it was not: the second to load saw a stranger's entry number and proof code shown
  // as their own, contradicting the confirmation email they had just been sent. capsule_wall holds
  // no payment columns by design, so the session has to be resolved to a seq server-side first.
  useEffect(() => {
    if (!configured) return
    const session = params.get('session')

    // Landed here without a session — a bookmark, or a back button. There is nothing to look up,
    // so say so rather than showing somebody else's entry.
    if (!session) {
      setWaited(true)
      return
    }

    let alive = true
    let tries = 0
    const id = setInterval(poll, 1500)

    async function poll() {
      tries += 1
      try {
        const res = await fetch(FN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
          },
          body: JSON.stringify({ kind: 'entry_link', session_id: session }),
        })
        const d = await res.json().catch(() => ({}))
        if (!alive) return

        if (d?.seq) {
          const { data } = await supabase
            .from('capsule_wall')
            .select('seq,display_name,location,char_count,message_hash,created_at,is_gift,recipient_name')
            .eq('seq', d.seq)
            .maybeSingle()
          if (!alive) return
          if (data) {
            setEntry(data)
            clearInterval(id)
            return
          }
        }
      } catch {
        // Network blip. Fall through to the retry.
      }

      // The note is sealed either way — the wall row is cosmetic — so after a dozen seconds the
      // copy says that plainly instead of implying the payment failed.
      if (tries >= 8) {
        setWaited(true)
        clearInterval(id)
      }
    }

    poll()
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [params])

  return (
    <div className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-2xl px-5">
        <div className="py-4">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
        </div>

        <div className="pb-20 pt-10">
          <span className="stamp">Sealed</span>
          <h1
            className="mt-6 font-display leading-[0.95]"
            style={{ fontSize: 'clamp(2.6rem,8vw,4.6rem)' }}
          >
            That&rsquo;s it.
            <br />
            See you in 2047.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/70">
            Your note is in the capsule. Nobody sees it — including you — until{' '}
            <strong className="font-semibold text-paper">{OPEN_LABEL}</strong>.
          </p>

          {entry && (
            <div className="mt-10 border border-paper/15 p-6 sm:p-8">
              <div className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-paper/45">
                Your entry
              </div>
              <div className="mt-2 font-mono text-5xl font-bold tabular-nums">
                #{String(entry.seq).padStart(6, '0')}
              </div>
              <div className="mt-3 text-paper/70">
                {entry.display_name || 'Anonymous'}
                {entry.location ? ` · ${entry.location}` : ''} · {entry.char_count} characters
              </div>

              <div className="mt-6 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-paper/45">
                Proof code
              </div>
              <p className="mt-2 break-all font-mono text-[0.68rem] leading-relaxed text-paper">
                {entry.message_hash}
              </p>

              <Link
                to={`/m/${entry.seq}`}
                className="mt-6 inline-block font-semibold text-paper underline underline-offset-4 hover:text-paper"
              >
                See your entry page
              </Link>
            </div>
          )}

          {!entry && waited && (
            <div className="mt-10 border border-paper/15 p-6 leading-relaxed text-paper/70">
              Your payment went through and your note is sealed. The public wall takes a moment to
              catch up — refresh in a minute and your entry will be there.
            </div>
          )}

          {/* the ask, at the moment it is most likely to land */}
          <div className="mt-12 border border-paper/25 p-6 sm:p-8">
            <h2 className="font-display text-3xl">Now the awkward part.</h2>
            <p className="mt-3 leading-relaxed text-paper/70">
              The capsule only goes ahead if at least {MINIMUM_ENTRIES.toLocaleString()} notes
              are in by December 31. If it doesn&rsquo;t get there, everyone is refunded and none of
              this happens — including yours.
            </p>
            <p className="mt-3 leading-relaxed text-paper/70">
              Sending this to one person is genuinely the whole difference.
            </p>
            <div className="mt-6">
              <Share seq={entry?.seq} />
            </div>
          </div>

          <div className="mt-14 border-t border-paper/15 pt-8">
            <div className="label">Opens in</div>
            <Countdown target={OPENS_AT} variant="open" className="mt-3" tone="light" />
          </div>

          <Link to="/" className="btn btn-ghost mt-12" style={{ color: 'var(--color-paper)', borderColor: 'var(--color-paper)' }}>
            Back to the capsule
          </Link>
        </div>
      </div>
    </div>
  )
}
