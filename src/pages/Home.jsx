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
} from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'
import Wall from '../components/Wall.jsx'
import Compose from '../components/Compose.jsx'
import Examples from '../components/Examples.jsx'

export default function Home() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prefill, setPrefill] = useState(null)
  const sealed = isSealed()

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
      {/* ---------------- HERO ---------------- */}
      <header className="bg-night text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center justify-between gap-4 py-4">
            <span className="font-display text-[1.02rem] font-bold">The 20 Year Capsule</span>
            <a
              href="#write"
              className="rounded-full bg-white/10 px-4 py-2 text-[0.9rem] font-semibold hover:bg-white/20"
            >
              {sealed ? 'Sealed' : 'Write yours'}
            </a>
          </div>

          <div className="pb-16 pt-10 sm:pb-24 sm:pt-16">
            <h1 className="max-w-4xl text-5xl sm:text-7xl lg:text-8xl">
              Write one sentence.
              <br />
              <span className="text-gold">Read it in 2047.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
              Up to {MAX_CHARS} characters, ${PRICE_USD}. It gets sealed on December 31 and{' '}
              <strong className="font-semibold text-white">nobody reads it</strong> — not even you —
              until the capsule opens twenty years later.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#write" className="btn btn-gold">
                Write my message
              </a>
              <a
                href="#wall"
                className="btn border-2 border-white/25 text-white hover:border-white/60"
              >
                See what&rsquo;s inside
              </a>
            </div>

            {/* the two clocks */}
            <div className="mt-14 grid max-w-3xl gap-8 sm:grid-cols-2">
              <div>
                <div className="eyebrow" style={{ color: 'var(--color-gold-2)' }}>
                  Closes in
                </div>
                <Countdown target={SEALS_AT} variant="seal" className="mt-3" tone="light" />
                <div className="mt-2 text-[0.85rem] text-white/45">{SEAL_LABEL}</div>
              </div>
              <div>
                <div className="eyebrow" style={{ color: 'var(--color-gold-2)' }}>
                  Then opens in
                </div>
                <Countdown target={OPENS_AT} variant="open" className="mt-3" tone="light" />
                <div className="mt-2 text-[0.85rem] text-white/45">{OPEN_LABEL}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        {/* ---------------- EXAMPLES ---------------- */}
        <section className="py-16 sm:py-20">
          <div className="eyebrow">Not sure what to write?</div>
          <h2 className="mt-3 max-w-3xl text-4xl sm:text-5xl">The good ones are specific.</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-3">
            There is no wrong answer. People write predictions, tiny details about today, notes to
            someone they love, and questions they will never get answered.
          </p>

          <div className="mt-10">
            <Examples onPick={pickExample} />
          </div>
        </section>

        {/* ---------------- WRITE ---------------- */}
        <section id="write" className="scroll-mt-4 rounded-3xl bg-bg-2 p-6 sm:p-10">
          <h2 className="text-4xl sm:text-5xl">Write yours.</h2>
          <p className="mt-3 max-w-2xl text-lg text-ink-3">
            One sentence, sealed for twenty years. Make it count, or make it silly — both age well.
          </p>
          <div className="mt-8">
            <Compose sealed={sealed} prefill={prefill} />
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section className="py-16 sm:py-20">
          <h2 className="text-4xl sm:text-5xl">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ['1', 'You write it', `Up to ${MAX_CHARS} characters and $${PRICE_USD}. Takes about a minute.`],
              [
                '2',
                'It gets sealed',
                'Your words are hidden the moment you pay. The wall shows only that your message exists.',
              ],
              [
                '3',
                'It opens in 2047',
                'On January 1, 2047, every message is published at once — including yours.',
              ],
            ].map(([num, title, body]) => (
              <li key={num}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold font-display text-lg font-bold text-night">
                  {num}
                </div>
                <h3 className="mt-4 text-2xl">{title}</h3>
                <p className="mt-2 leading-relaxed text-ink-3">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- GOAL ---------------- */}
        <section className="rounded-3xl border-2 border-line p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="eyebrow">Messages so far</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-display text-6xl font-bold leading-none">
                  {n.toLocaleString()}
                </span>
                <span className="text-xl font-semibold text-muted">
                  of {GOAL_ENTRIES.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="max-w-md text-[0.98rem] leading-relaxed text-ink-3">
              It takes {GOAL_ENTRIES.toLocaleString()} messages to pay for keeping this online until
              2047. If we do not get there by December 31,{' '}
              <strong className="font-semibold text-ink">everyone is refunded</strong> and nothing is
              sealed.
            </p>
          </div>
          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-bg-3">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{ width: `${Math.max(goalPct(n), n > 0 ? 2 : 0)}%` }}
            />
          </div>
        </section>

        {/* ---------------- WALL ---------------- */}
        <section id="wall" className="py-16 sm:py-20">
          <div className="eyebrow">Inside the capsule</div>
          <h2 className="mt-3 text-4xl sm:text-5xl">You can see who. You can&rsquo;t see what.</h2>
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

        {/* ---------------- TRUST ---------------- */}
        <section className="pb-20">
          <div className="grid gap-10 rounded-3xl bg-night p-7 text-white sm:p-12 md:grid-cols-2">
            <div>
              <div className="eyebrow" style={{ color: 'var(--color-gold-2)' }}>
                How you know it&rsquo;s real
              </div>
              <h2 className="mt-3 text-3xl sm:text-4xl">Your words can&rsquo;t be changed.</h2>
              <p className="mt-5 leading-relaxed text-white/70">
                When you seal a message we publish a{' '}
                <strong className="text-white">proof code</strong> made from your exact words. It
                gives nothing away — you cannot work backwards from it to the sentence.
              </p>
              <p className="mt-4 leading-relaxed text-white/70">
                In 2047, anyone can run the same calculation on the published message and check it
                matches. If one character had changed in twenty years, it wouldn&rsquo;t.
              </p>
            </div>
            <div className="self-center">
              <div className="rounded-2xl bg-white/5 p-6">
                <div className="text-[0.85rem] font-semibold text-white/50">You write</div>
                <p className="mt-2 text-lg">&ldquo;I will marry Steven R.&rdquo;</p>
                <div className="mt-5 text-[0.85rem] font-semibold text-white/50">Everyone sees</div>
                <p className="mt-2">
                  <span className="redact redact-light" style={{ width: '3.5em' }} />{' '}
                  <span className="redact redact-light" style={{ width: '2.2em' }} />{' '}
                  <span className="redact redact-light" style={{ width: '4em' }} />
                </p>
                <p className="mt-4 break-all font-mono text-[0.66rem] leading-relaxed text-gold-2">
                  4f2c9a01b7e5d3f8a6c40be91d27358fa0c6e8b1d4079a2f35c8e16b0da47f92
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-night text-white/60">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="font-display text-2xl font-bold text-white">The 20 Year Capsule</div>
          <p className="mt-3 max-w-lg leading-relaxed">
            Sealed {SEAL_LABEL}. Opens {OPEN_LABEL}.
          </p>
          <div className="mt-6 flex flex-wrap gap-5 text-[0.92rem]">
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
