import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import { OPEN_LABEL, OPENS_AT, GOAL_ENTRIES } from '../lib/capsule.js'
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

  useEffect(() => {
    if (!configured) return
    let alive = true
    let tries = 0
    const id = setInterval(poll, 1500)

    async function poll() {
      tries += 1
      const { data } = await supabase
        .from('capsule_wall')
        .select('seq,display_name,location,char_count,message_hash,created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (!alive) return
      if (data?.[0]) {
        setEntry(data[0])
        clearInterval(id)
        return
      }
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
  }, [])

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-2xl px-5">
        <div className="py-4">
          <Link to="/" className="font-display text-[1.02rem] font-bold">
            The 20 Year Capsule
          </Link>
        </div>

        <div className="pb-20 pt-10">
          <div className="eyebrow" style={{ color: 'var(--color-sun)' }}>
            Sealed
          </div>
          <h1 className="mt-4 text-5xl sm:text-6xl">
            That&rsquo;s it.
            <br />
            <span className="text-sun">See you in 2047.</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
            Your message is in the capsule. Nobody sees it — including you — until{' '}
            <strong className="font-semibold text-white">{OPEN_LABEL}</strong>.
          </p>

          {entry && (
            <div className="mt-10 rounded-3xl bg-white/5 p-6 sm:p-8">
              <div className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                Your entry
              </div>
              <div className="mt-2 font-display text-5xl font-bold tabular-nums">
                #{String(entry.seq).padStart(6, '0')}
              </div>
              <div className="mt-3 text-white/70">
                {entry.display_name || 'Anonymous'}
                {entry.location ? ` · ${entry.location}` : ''} · {entry.char_count} characters
              </div>

              <div className="mt-6 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-white/45">
                Proof code
              </div>
              <p className="mt-2 break-all font-mono text-[0.68rem] leading-relaxed text-sun">
                {entry.message_hash}
              </p>

              <Link
                to={`/m/${entry.seq}`}
                className="mt-6 inline-block font-semibold text-white underline underline-offset-4 hover:text-sun"
              >
                See your entry page
              </Link>
            </div>
          )}

          {!entry && waited && (
            <div className="mt-10 rounded-3xl bg-white/5 p-6 leading-relaxed text-white/70">
              Your payment went through and your message is sealed. The public wall takes a moment to
              catch up — refresh in a minute and your entry will be there.
            </div>
          )}

          {/* the ask, at the moment it is most likely to land */}
          <div className="mt-12 rounded-3xl border-2 border-white/20 p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl">Now the awkward part.</h2>
            <p className="mt-3 leading-relaxed text-white/70">
              The capsule only gets sealed if {GOAL_ENTRIES.toLocaleString()} messages go in by
              December 31. If it doesn&rsquo;t, everyone gets refunded and none of this happens —
              including yours.
            </p>
            <p className="mt-3 leading-relaxed text-white/70">
              Sending this to one person is genuinely the whole difference.
            </p>
            <div className="mt-6">
              <Share seq={entry?.seq} />
            </div>
          </div>

          <div className="mt-14 border-t border-white/10 pt-8">
            <div className="eyebrow" style={{ color: 'var(--color-sun)' }}>
              Opens in
            </div>
            <Countdown target={OPENS_AT} variant="open" className="mt-3" tone="light" />
          </div>

          <Link to="/" className="btn btn-pop mt-12">
            Back to the capsule
          </Link>
        </div>
      </div>
    </div>
  )
}
