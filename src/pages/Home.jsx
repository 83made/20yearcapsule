import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import { SEALS_AT, OPENS_AT, SEAL_LABEL, OPEN_LABEL, MAX_CHARS, isSealed } from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'
import Wall from '../components/Wall.jsx'
import Compose from '../components/Compose.jsx'
import Goal from '../components/Goal.jsx'

export default function Home() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const sealed = isSealed()

  useEffect(() => {
    let alive = true
    async function load() {
      if (!configured) {
        setLoading(false)
        return
      }
      const [{ data: rows }, { data: stats }] = await Promise.all([
        supabase.from('capsule_wall').select('seq,display_name,location,char_count,created_at').order('created_at', { ascending: false }).limit(60),
        supabase.rpc('capsule_stats'),
      ])
      if (!alive) return
      setEntries(rows ?? [])
      setTotal(stats?.[0]?.total ?? 0)
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="min-h-screen">
      {/* masthead */}
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-3 flex items-center justify-between gap-4">
          <span className="font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase">
            20yearcapsule.com
          </span>
          <div className="flex items-center gap-5">
            <span className="font-mono text-[0.68rem] tracking-[0.14em] uppercase opacity-70">
              {sealed ? 'Sealed' : 'Accepting entries'}
            </span>
            {!sealed && (
              <a
                href="#write"
                className="font-mono text-[0.68rem] font-bold tracking-[0.14em] uppercase underline underline-offset-4 hover:opacity-70"
              >
                Write yours
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* hero */}
        <section className="pt-14 pb-12 md:pt-20">
          <h1
            className="font-display leading-[0.92] tracking-tight"
            style={{ fontSize: 'clamp(3rem,10vw,7rem)' }}
          >
            One sentence.
            <br />
            Sealed for
            <br />
            twenty years.
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-2">
            Write up to {MAX_CHARS} characters. It goes into the capsule and is{' '}
            <strong className="font-semibold">not published, shown, or shared with anyone</strong> —
            including here — until it opens.
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <div className="label">The capsule closes in</div>
              <Countdown target={SEALS_AT} variant="seal" className="mt-3" />
              <div className="mt-3 font-mono text-[0.72rem] text-muted">{SEAL_LABEL}</div>
            </div>
            <div>
              <div className="label">Then it opens in</div>
              <Countdown target={OPENS_AT} variant="open" className="mt-3" />
              <div className="mt-3 font-mono text-[0.72rem] text-muted">{OPEN_LABEL}</div>
            </div>
          </div>
        </section>

        <div className="rule" />

        {/* funding goal — the reason every buyer has to recruit the next one */}
        <section className="py-12">
          <Goal count={total} />
        </section>

        <div className="rule" />

        {/* compose */}
        <section id="write" className="py-12">
          <Compose sealed={sealed} />
        </section>

        <div className="rule" />

        {/* how it works */}
        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">How it works</h2>
          <ol className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'You write one sentence', `Up to ${MAX_CHARS} characters. To the future, to someone specific, or to nobody at all.`],
              ['02', 'You pay $2', 'Two dollars, one sentence. There is no other product and nothing is mailed to you.'],
              ['03', 'It is sealed', 'Your sentence is stored and never displayed. The wall below shows only that it exists.'],
              ['04', 'It opens in 2047', `On ${OPEN_LABEL}, every message is published at once, in full.`],
            ].map(([n, title, body]) => (
              <li key={n}>
                <div className="font-mono text-[0.72rem] font-bold text-seal">{n}</div>
                <h3 className="mt-2 font-display text-2xl leading-tight">{title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-3">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="rule" />

        {/* proof */}
        <section className="py-12">
          <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 className="font-display text-4xl md:text-5xl">How you know it's really sealed</h2>
              <p className="mt-5 leading-relaxed text-ink-2">
                When your sentence is sealed, we publish a{' '}
                <strong className="font-semibold">SHA-256 fingerprint</strong> of it — a 64-character
                code derived from your exact text. It reveals nothing about what you wrote.
              </p>
              <p className="mt-4 leading-relaxed text-ink-2">
                In 2047, when the message is published, anyone can run the same calculation and
                confirm it produces the identical fingerprint. If a single character had been
                changed, added, or removed at any point in twenty years, the codes would not match.
              </p>
              <p className="mt-4 leading-relaxed text-ink-3 text-[0.95rem]">
                It also means the archive does not depend on trusting whoever is running this site in
                2047 — the proof is public from the day you write it.
              </p>
            </div>
            <div className="bg-paper-2 p-6 rounded-sm self-start">
              <div className="label">Example</div>
              <p className="mt-3 font-mono text-[0.85rem] text-ink-2">your sentence</p>
              <p className="mt-1 font-mono text-[0.85rem]">"I hope Mom is still here."</p>
              <p className="mt-4 label">becomes</p>
              <p className="mt-2 font-mono text-[0.72rem] break-all text-seal leading-relaxed">
                8d3f1c0a5b9e47d2f6a8c1b4e70d9352fa6c8e1b0d47a92f35c8e1b6d0a47f92
              </p>
              <p className="mt-4 text-[0.82rem] leading-relaxed text-muted">
                Published immediately. Unreadable. Verifiable in 2047.
              </p>
            </div>
          </div>
        </section>

        <div className="rule" />

        {/* the wall */}
        <section id="wall" className="py-12">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-4xl md:text-5xl">Inside the capsule</h2>
              <p className="mt-3 text-ink-3">
                Every sentence sealed so far. You can see who and when. You cannot see what.
              </p>
            </div>
            {total !== null && (
              <div className="text-right">
                <div className="font-mono text-4xl font-bold tabular-nums">{total.toLocaleString()}</div>
                <div className="label mt-1">sealed</div>
              </div>
            )}
          </div>

          {!configured ? (
            <p className="mt-8 font-mono text-sm text-muted">
              (Not connected to the database yet — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.)
            </p>
          ) : (
            <Wall entries={entries} loading={loading} />
          )}

          {entries.length >= 60 && (
            <p className="mt-6 font-mono text-[0.75rem] text-muted">Showing the 60 most recent.</p>
          )}
        </section>
      </main>

      <footer className="bg-ink text-paper mt-8">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <div className="font-display text-3xl">The 20 Year Capsule</div>
          <p className="mt-3 max-w-lg text-[0.92rem] leading-relaxed opacity-70">
            Sealed {SEAL_LABEL}. Opens {OPEN_LABEL}. One sentence, two dollars, twenty years.
          </p>
          <div className="mt-6 flex gap-5 font-mono text-[0.72rem] uppercase tracking-[0.12em] opacity-70">
            <Link to="/terms" className="hover:opacity-100 underline underline-offset-4">
              Terms &amp; what you're buying
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
