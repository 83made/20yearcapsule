import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import { OPEN_LABEL, SEAL_LABEL, OPENS_AT } from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'

// A permanent, linkable page per entry. This is the thing people share — it proves participation
// without revealing anything, which is exactly the shape of the whole project.
export default function Certificate() {
  const { seq } = useParams()
  const [entry, setEntry] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    if (!configured) {
      setState('unconfigured')
      return
    }
    let alive = true
    const load = async () => {
      const { data, error } = await supabase
        .from('capsule_wall')
        .select('seq,display_name,location,char_count,message_hash,created_at')
        .eq('seq', Number(seq))
        .maybeSingle()
      if (!alive) return
      if (error || !data) {
        setState('missing')
        return
      }
      setEntry(data)
      setState('ok')
    }
    load()
    return () => {
      alive = false
    }
  }, [seq])

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-14">
        {state === 'loading' && <p className="font-mono text-sm text-muted">Loading…</p>}

        {state === 'unconfigured' && (
          <p className="font-mono text-sm text-muted">Database not configured.</p>
        )}

        {state === 'missing' && (
          <>
            <h1 className="font-display text-5xl">No entry #{seq}</h1>
            <p className="mt-4 text-ink-2">Nothing has been sealed under that number.</p>
            <Link to="/" className="btn btn-primary mt-8">
              Back to the capsule
            </Link>
          </>
        )}

        {state === 'ok' && entry && (
          <>
            <div className="border-2 border-ink p-8 md:p-11 rounded-sm bg-paper">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="label">Certificate of sealing</div>
                  <div className="mt-2 font-display text-2xl leading-tight">The 20 Year Capsule</div>
                </div>
                <span className="stamp shrink-0">Sealed</span>
              </div>

              <div
                className="mt-9 font-mono font-bold tabular-nums leading-none"
                style={{ fontSize: 'clamp(2.6rem,11vw,4.4rem)' }}
              >
                #{String(entry.seq).padStart(6, '0')}
              </div>

              <div className="mt-7 grid gap-3 rule pt-6">
                <Row k="Sealed by" v={entry.display_name || 'Anonymous'} />
                {entry.location && <Row k="From" v={entry.location} />}
                <Row k="Length" v={`${entry.char_count} characters`} />
                <Row k="Sealed on" v={new Date(entry.created_at).toISOString().slice(0, 10)} />
                <Row k="Opens" v={OPEN_LABEL} />
              </div>

              <div className="mt-7 rule pt-6">
                <div className="label">SHA-256 fingerprint of the sealed message</div>
                <p className="mt-2 font-mono text-[0.72rem] break-all text-seal leading-relaxed">
                  {entry.message_hash}
                </p>
                <p className="mt-3 text-[0.8rem] leading-relaxed text-muted">
                  In 2047 this message is published in full. Anyone can hash the revealed text and
                  confirm it matches this code — proof that not one character changed in twenty
                  years.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <div className="label">Opens in</div>
              <Countdown target={OPENS_AT} variant="open" className="mt-3" />
              <p className="mt-3 font-mono text-[0.72rem] text-muted">Sealed {SEAL_LABEL}</p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/" className="btn btn-primary">
                Seal your own sentence
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
              >
                Copy link
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="label w-28 shrink-0">{k}</span>
      <span className="font-mono text-[0.88rem] text-ink">{v}</span>
    </div>
  )
}
