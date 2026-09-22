import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import { OPEN_LABEL, OPENS_AT } from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'
import Share from '../components/Share.jsx'

// A permanent, linkable page per entry — the thing people actually send to each other. It proves
// participation without revealing anything, which is the shape of the whole project.
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
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
          <Link
            to="/#write"
            className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] underline underline-offset-4 hover:opacity-70"
          >
            Write yours
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-14">
        {state === 'loading' && <p className="text-muted">Loading…</p>}
        {state === 'unconfigured' && <p className="text-muted">Database not configured.</p>}

        {state === 'missing' && (
          <>
            <h1 className="font-display text-5xl">No entry #{seq}</h1>
            <p className="mt-4 text-ink-3">Nothing has been sealed under that number.</p>
            <Link to="/" className="btn btn-primary mt-8">
              Go to the capsule
            </Link>
          </>
        )}

        {state === 'ok' && entry && (
          <>
            <div className="border-2 border-ink bg-paper p-8 md:p-11">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="label">Certificate of sealing</div>
                  <div className="mt-2 font-display text-2xl leading-tight">The 20 Year Capsule</div>
                </div>
                <span className="stamp shrink-0">Sealed</span>
              </div>
              <div className="mt-9 font-mono text-6xl font-bold tabular-nums leading-none">
                #{String(entry.seq).padStart(6, '0')}
              </div>

              <div className="mt-7 rule pt-6 text-lg">
                <span className="font-semibold">{entry.display_name || 'Anonymous'}</span>
                {entry.location && <span className="text-muted"> · {entry.location}</span>}
              </div>

              <div className="mt-7 rule pt-6">
                <div className="label">
                  What they wrote
                </div>
                <p className="mt-3 text-lg">
                  {Array.from({ length: Math.max(3, Math.round(entry.char_count / 14)) }).map((_, i) => (
                    <span
                      key={i}
                      className="mr-[0.3em] inline-block rounded"
                      style={{
                        width: `${1.4 + ((i * 7) % 4) * 0.8}em`,
                        height: '0.95em',
                        verticalAlign: '-0.12em',
                        background: 'var(--color-ink)',
                      }}
                    />
                  ))}
                </p>
                <p className="mt-3 text-[0.9rem] text-muted">
                  {entry.char_count} characters, hidden until {OPEN_LABEL}.
                </p>
              </div>

              <div className="mt-7 rule pt-6">
                <div className="label">
                  Proof code
                </div>
                <p className="mt-2 break-all font-mono text-[0.7rem] leading-relaxed text-seal">
                  {entry.message_hash}
                </p>
                <p className="mt-3 text-[0.85rem] leading-relaxed text-muted">
                  Made from the exact words inside. When the capsule opens, anyone can check this
                  still matches — proof not one character changed in twenty years.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <div className="eyebrow">Opens in</div>
              <Countdown target={OPENS_AT} variant="open" className="mt-3" />
              <p className="mt-2 text-[0.9rem] text-muted">{OPEN_LABEL}</p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/#write" className="btn btn-primary">
                Seal your own
              </Link>
              <Share seq={entry.seq} variant="inline" />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
