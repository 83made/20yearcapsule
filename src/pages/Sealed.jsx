import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import { OPEN_LABEL, SEAL_LABEL, OPENS_AT } from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'

/**
 * Where Stripe drops people after payment. The webhook may not have landed yet, so this polls the
 * public wall for a few seconds rather than promising a row that does not exist. If it never shows,
 * the message is still sealed — the wall row is cosmetic — so the copy says that plainly instead of
 * implying something went wrong.
 */
export default function Sealed() {
  const [params] = useSearchParams()
  const [entry, setEntry] = useState(null)
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    if (!configured) return
    let alive = true
    let tries = 0
    const poll = async () => {
      tries += 1
      const { data } = await supabase
        .from('capsule_wall')
        .select('seq,display_name,location,char_count,message_hash,created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (!alive) return
      if (data?.[0]) setEntry(data[0])
      if (tries >= 6) {
        setWaited(true)
        clearInterval(id)
      }
    }
    const id = setInterval(poll, 1500)
    poll()
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-16">
        <span className="stamp">Sealed</span>
        <h1 className="mt-6 font-display leading-[0.95]" style={{ fontSize: 'clamp(2.6rem,8vw,4.6rem)' }}>
          Your sentence is
          <br />
          in the capsule.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
          It will not be shown to anyone — including you — until{' '}
          <strong className="font-semibold">{OPEN_LABEL}</strong>.
        </p>

        {entry && (
          <div className="mt-10 bg-paper-2 p-7 rounded-sm">
            <div className="label">Your entry</div>
            <div className="mt-3 font-mono text-3xl font-bold tabular-nums">
              #{String(entry.seq).padStart(6, '0')}
            </div>
            <div className="mt-4 grid gap-1.5 font-mono text-[0.8rem] text-ink-2">
              <div>{entry.display_name || 'Anonymous'}{entry.location ? ` · ${entry.location}` : ''}</div>
              <div className="text-muted">{entry.char_count} characters</div>
            </div>
            <div className="mt-5">
              <div className="label">Fingerprint</div>
              <p className="mt-1.5 font-mono text-[0.68rem] break-all text-seal leading-relaxed">
                {entry.message_hash}
              </p>
            </div>
            <Link to={`/m/${entry.seq}`} className="btn btn-ghost mt-6">
              View your certificate
            </Link>
          </div>
        )}

        {!entry && waited && (
          <p className="mt-10 bg-paper-2 p-6 rounded-sm text-[0.95rem] leading-relaxed text-ink-2">
            Your payment went through and your message is sealed. The public wall can take a moment
            to catch up — refresh in a minute and your entry will be there.
          </p>
        )}

        <div className="mt-14 rule pt-10">
          <div className="label">The capsule opens in</div>
          <Countdown target={OPENS_AT} variant="open" className="mt-3" />
          <p className="mt-4 font-mono text-[0.75rem] text-muted">
            Sealed {SEAL_LABEL} · Opens {OPEN_LABEL}
          </p>
        </div>

        <div className="mt-12">
          <Link to="/" className="btn btn-primary">
            Back to the capsule
          </Link>
        </div>
      </main>
    </div>
  )
}
