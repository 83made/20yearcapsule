import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase.js'
import {
  SEALS_AT,
  OPENS_AT,
  SEAL_LABEL,
  OPEN_LABEL,
  MAX_CHARS,
  PRICE_USD,
  GOAL_ENTRIES,
  isSealed,
  goalPct,
  countdown,
} from '../lib/capsule.js'
import { BOLD_COLORS, TILE_COLORS } from '../lib/palette.js'
import Wall from '../components/Wall.jsx'
import Compose from '../components/Compose.jsx'
import Examples from '../components/Examples.jsx'

export default function Home() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prefill, setPrefill] = useState(null)
  const [t, setT] = useState(() => countdown(SEALS_AT))
  const sealed = isSealed()

  useEffect(() => {
    const id = setInterval(() => setT(countdown(SEALS_AT)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      if (!configured) {
        setLoading(false)
        return
      }
      const [{ data: rows }, { data: stats }] = await Promise.all([
        supabase
          .from('capsule_wall')
          .select('seq,display_name,location,char_count,created_at')
          .order('created_at', { ascending: false })
          .limit(48),
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

  function pickExample(text) {
    setPrefill(text)
    document.getElementById('write')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => document.getElementById('msg')?.focus(), 500)
  }

  const n = total ?? 0

  return (
    <div className="min-h-screen">
      {/* ---------------- NAV ---------------- */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <span className="font-display text-[1.1rem] font-bold">The 20 Year Capsule</span>
        <a href="#write" className="btn btn-primary !px-5 !py-2.5 !text-[0.95rem]">
          {sealed ? 'Sealed' : `Write one — $${PRICE_USD}`}
        </a>
      </div>

      <main className="mx-auto max-w-6xl px-5">
        {/* ---------------- HERO ---------------- */}
        <section className="pb-14 pt-6 sm:pt-10">
          <h1 style={{ fontSize: 'clamp(3rem,9vw,6.4rem)' }}>
            Say something
            <br />
            to 2047.
          </h1>

          <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink-2">
            Write one sentence. It gets sealed on December 31 and{' '}
            <strong className="font-semibold text-ink">nobody reads it</strong> — not even you —
            for twenty years.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#write" className="btn btn-pop">
              Write mine — ${PRICE_USD}
            </a>
            <a href="#wall" className="btn btn-soft">
              See the capsule
            </a>
          </div>

          {/* the two clocks, as objects rather than a stat bar */}
          <div className="mt-10 flex flex-wrap gap-3">
            <div
              className="rounded-3xl px-6 py-5"
              style={{ background: TILE_COLORS[0].bg, minWidth: '220px' }}
            >
              <div className="eyebrow">Closes in</div>
              <div className="mt-1 font-display text-4xl font-bold tabular-nums sm:text-5xl">
                {t.days}
                <span className="ml-1.5 text-xl font-semibold text-ink-3">days</span>
              </div>
              <div className="mt-1 font-mono text-[0.72rem] text-ink-3">
                {String(t.hours).padStart(2, '0')}:{String(t.minutes).padStart(2, '0')}:
                {String(t.seconds).padStart(2, '0')}
              </div>
            </div>

            <div
              className="rounded-3xl px-6 py-5"
              style={{ background: TILE_COLORS[2].bg, minWidth: '220px' }}
            >
              <div className="eyebrow">Then opens</div>
              <div className="mt-1 font-display text-4xl font-bold sm:text-5xl">2047</div>
              <div className="mt-1 font-mono text-[0.72rem] text-ink-3">Jan 1 · 12:01 AM PST</div>
            </div>
          </div>
        </section>

        {/* ---------------- EXAMPLES ---------------- */}
        <section className="py-14">
          <div className="eyebrow">Not sure what to write?</div>
          <h2 className="mt-2 text-4xl sm:text-5xl">The good ones are specific.</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-3">
            There&rsquo;s no wrong answer. People write predictions, tiny details about today, notes
            to someone they love, and questions they&rsquo;ll never get answered.
          </p>
          <div className="mt-8">
            <Examples onPick={pickExample} />
          </div>
        </section>

        {/* ---------------- WRITE ---------------- */}
        <section
          id="write"
          className="scroll-mt-4 rounded-[32px] p-6 sm:p-10"
          style={{ background: 'var(--color-bg-2)' }}
        >
          <h2 className="text-4xl sm:text-5xl">Write yours.</h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-3">
            One sentence, sealed for twenty years. Make it count or make it silly — both age well.
          </p>
          <div className="mt-8">
            <Compose sealed={sealed} prefill={prefill} />
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section className="py-16">
          <h2 className="text-4xl sm:text-5xl">How it works</h2>
          <ol className="mt-9 grid gap-4 sm:grid-cols-3">
            {[
              ['You write it', `Up to ${MAX_CHARS} characters and $${PRICE_USD}. Takes a minute.`],
              ['It gets sealed', 'Hidden the moment you pay. The wall shows only that it exists.'],
              ['It opens in 2047', 'Every message published at once — including yours.'],
            ].map(([title, body], i) => (
              <li
                key={title}
                className="rounded-3xl p-6"
                style={{ background: TILE_COLORS[(i + 3) % TILE_COLORS.length].bg }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full font-display text-lg font-bold text-white"
                  style={{ background: BOLD_COLORS[(i + 3) % BOLD_COLORS.length] }}
                >
                  {i + 1}
                </div>
                <h3 className="mt-4 text-2xl">{title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- GOAL ---------------- */}
        <section
          className="rounded-[32px] p-6 sm:p-10"
          style={{ background: 'var(--color-ink)', color: '#fff' }}
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-display text-[0.95rem] font-semibold text-white/55">
                Messages so far
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-6xl font-bold tabular-nums sm:text-7xl">
                  {n.toLocaleString()}
                </span>
                <span className="text-xl font-semibold text-white/45">
                  of {GOAL_ENTRIES.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="max-w-md leading-relaxed text-white/65">
              It takes {GOAL_ENTRIES.toLocaleString()} messages to pay for keeping this online until
              2047. If we don&rsquo;t get there by December 31,{' '}
              <strong className="font-semibold text-white">everyone is refunded</strong> and nothing
              is sealed.
            </p>
          </div>
          <div className="mt-7 h-4 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(goalPct(n), n > 0 ? 2 : 0)}%`,
                background: 'var(--color-sun)',
              }}
            />
          </div>
        </section>

        {/* ---------------- WALL ---------------- */}
        <section id="wall" className="py-16">
          <div className="eyebrow">Inside the capsule</div>
          <h2 className="mt-2 text-4xl sm:text-5xl">You can see who. Not what.</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-3">
            Every message sealed so far. The black bars are real sentences — they just stay covered
            for another twenty years.
          </p>

          {!configured ? (
            <p className="mt-8 text-muted">Not connected to the database yet.</p>
          ) : (
            <div className="mt-8">
              <Wall entries={entries} loading={loading} />
            </div>
          )}
        </section>

        {/* ---------------- PROOF ---------------- */}
        <section className="pb-16">
          <div
            className="grid gap-8 rounded-[32px] p-7 sm:p-11 md:grid-cols-2"
            style={{ background: TILE_COLORS[4].bg }}
          >
            <div>
              <div className="eyebrow">How you know it&rsquo;s real</div>
              <h2 className="mt-2 text-3xl sm:text-4xl">Your words can&rsquo;t be changed.</h2>
              <p className="mt-5 leading-relaxed text-ink-2">
                When you seal a message we publish a <strong>proof code</strong> made from your exact
                words. It gives nothing away — you can&rsquo;t work backwards from it to the
                sentence.
              </p>
              <p className="mt-4 leading-relaxed text-ink-2">
                In 2047, anyone can run the same calculation on the published message and check it
                matches. If one character had changed in twenty years, it wouldn&rsquo;t.
              </p>
            </div>
            <div className="self-center rounded-3xl bg-white p-6">
              <div className="eyebrow">You write</div>
              <p className="mt-2 text-lg font-medium">&ldquo;I will marry Steven R.&rdquo;</p>
              <div className="eyebrow mt-6">Everyone sees</div>
              <p className="mt-2 text-lg">
                <span className="redact mr-1.5" style={{ width: '2.4em' }} />
                <span className="redact mr-1.5" style={{ width: '3.2em' }} />
                <span className="redact" style={{ width: '2em' }} />
              </p>
              <div className="eyebrow mt-6">Plus this code</div>
              <p className="mt-2 break-all font-mono text-[0.68rem] leading-relaxed text-ink-3">
                4f2c9a01b7e5d3f8a6c40be91d27358fa0c6e8b1d4079a2f35c8e16b0da47f92
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: 'var(--color-ink)' }} className="text-white/60">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="font-display text-2xl font-bold text-white">The 20 Year Capsule</div>
          <p className="mt-3 max-w-lg leading-relaxed">
            Sealed {SEAL_LABEL}. Opens {OPEN_LABEL}.
          </p>
          <div className="mt-6 flex flex-wrap gap-5 text-[0.95rem]">
            <Link to="/terms" className="underline underline-offset-4 hover:text-white">
              Terms &amp; what you&rsquo;re buying
            </Link>
            <a href="#write" className="underline underline-offset-4 hover:text-white">
              Write a message
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
