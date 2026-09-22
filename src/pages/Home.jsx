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
  MINIMUM_ENTRIES,
  CAPACITY,
  NET_PER_ENTRY,
  timeAgo,
  isSealed,
} from '../lib/capsule.js'
import Countdown from '../components/Countdown.jsx'
import Wall from '../components/Wall.jsx'
import Compose from '../components/Compose.jsx'
import Examples from '../components/Examples.jsx'

export default function Home() {
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(null)
  const [lastAt, setLastAt] = useState(null)
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
          .limit(60),
        supabase.rpc('capsule_stats'),
      ])
      if (!alive) return
      setEntries(rows ?? [])
      setTotal(stats?.[0]?.total ?? 0)
      setLastAt(stats?.[0]?.last_sealed_at ?? null)
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
      {/* masthead */}
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </span>
          <div className="flex items-center gap-5">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] opacity-70">
              {sealed ? 'Sealed' : 'Accepting entries'}
            </span>
            {!sealed && (
              <a
                href="#write"
                className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] underline underline-offset-4 hover:opacity-70"
              >
                Write yours
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* hero */}
        <section className="pb-12 pt-14 md:pt-20">
          <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
            <div>
              <h1
                className="font-display leading-[0.92] tracking-tight"
                style={{ fontSize: 'clamp(3rem,10vw,7rem)' }}
              >
                Say something
                <br />
                to 2047.
              </h1>

              <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-2">
                Write one sentence, up to {MAX_CHARS} characters. It goes into the capsule and is{' '}
                <strong className="font-semibold">
                  not published, shown, or shared with anyone
                </strong>{' '}
                — including here — until it opens twenty years later.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#write" className="btn btn-primary">
                  Write mine — ${PRICE_USD}
                </a>
                <a href="#wall" className="btn btn-ghost">
                  See the capsule
                </a>
              </div>

              {/* Participation, stated as early as it can honestly be stated. */}
              {total !== null && (
                <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[0.8rem] font-bold tabular-nums">
                    {n.toLocaleString()} {n === 1 ? 'memory' : 'memories'} sealed
                  </span>
                  {lastAt && (
                    <span className="font-mono text-[0.75rem] text-muted">
                      · last one {timeAgo(lastAt)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* The capsule, planted. Decorative — the headline already says what this is, so the
                image is alt="" rather than repeating it to a screen reader. Explicit dimensions
                and fetchPriority keep it from shifting the layout as it loads: it sits above the
                fold, and a hero that jumps is worse than a hero with no picture. */}
            {/* Below lg this falls under the headline and the buttons rather than above them.
                The sentence is the pitch and mobile space above the fold is scarce, so the words
                lead and the picture follows. */}
            <div>
              <img
                src="/logo-hero.png"
                alt=""
                width="900"
                height="900"
                fetchPriority="high"
                decoding="async"
                className="mx-auto w-44 max-w-full sm:w-56 lg:w-full"
              />
            </div>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
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

        {/* examples */}
        <section className="py-12">
          <div className="label">Not sure what to write?</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">The good ones are specific.</h2>
          <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-ink-3">
            There is no wrong answer. People write predictions, tiny details about today, notes to
            someone they love, and questions they will never get answered.
          </p>
          <div className="mt-8">
            <Examples onPick={pickExample} />
          </div>
        </section>

        <div className="rule" />

        {/* compose */}
        <section id="write" className="scroll-mt-4 py-12">
          <Compose sealed={sealed} prefill={prefill} />
        </section>

        <div className="rule" />

        {/* the running count */}
        <section className="py-12">
          <div className="bg-paper-2 p-7 md:p-9">
            <div className="grid gap-8 md:grid-cols-[1fr_1.15fr] md:items-center">
              <div>
                <div className="label">Memories sealed so far</div>
                <div
                  className="mt-3 font-mono font-bold leading-none tabular-nums"
                  style={{ fontSize: 'clamp(3.4rem,11vw,6rem)' }}
                >
                  {n.toLocaleString()}
                </div>
                {lastAt && (
                  <div className="mt-3 font-mono text-[0.78rem] text-ink-3">
                    Last one {timeAgo(lastAt)}
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-display text-3xl leading-tight md:text-4xl">
                  Room for {CAPACITY.toLocaleString()} memories.
                </h2>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-2">
                  The capsule holds up to a million of them. Every one gets sealed on the same night
                  and opened on the same morning twenty years later, whether there are a thousand
                  inside or a million.
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-3">
                  It does need at least{' '}
                  <strong className="font-semibold text-ink-2">
                    {MINIMUM_ENTRIES.toLocaleString()}
                  </strong>{' '}
                  by December 31 to cover twenty years of keeping the archive online. If it does not
                  get there, every payment is refunded and nothing is sealed — a twenty-year promise
                  you cannot afford to keep is not worth making.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="rule" />

        {/* how it works */}
        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">How it works</h2>
          <ol className="mt-8 grid gap-7 sm:grid-cols-3">
            {[
              ['01', 'You write it', `Up to ${MAX_CHARS} characters and $${PRICE_USD}. Takes about a minute.`],
              [
                '02',
                'It gets sealed',
                'Your words are hidden the moment you pay. The wall below shows only that your message exists.',
              ],
              [
                '03',
                'It opens in 2047',
                `On ${OPEN_LABEL}, every message is published at once — including yours.`,
              ],
            ].map(([num, title, body]) => (
              <li key={num}>
                <div className="font-mono text-[0.72rem] font-bold text-seal">{num}</div>
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
              <h2 className="font-display text-4xl md:text-5xl">
                How you know it&rsquo;s really sealed
              </h2>
              <p className="mt-5 leading-relaxed text-ink-2">
                When your sentence is sealed, we publish a{' '}
                <strong className="font-semibold">proof code</strong> — a 64-character string
                computed from your exact words <em>and</em> a random number that is sealed away
                with them. Because that number stays secret until 2047, the code gives away
                nothing about what you wrote — not even to someone who guesses it correctly.
              </p>
              <p className="mt-4 leading-relaxed text-ink-2">
                In 2047 your sentence and its random number are published together, so anyone can
                run the same calculation and confirm it produces the identical code. If a single
                character had been changed, added, or removed at any point in twenty years, they
                would not match.
              </p>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-3">
                It also means the archive does not depend on trusting whoever is running this site
                in 2047 — the proof is public from the day you write it.
              </p>
            </div>
            <div className="self-start bg-paper-2 p-6">
              <div className="label">You write</div>
              <p className="mt-2 font-mono text-[0.9rem]">&ldquo;I will marry Steven R.&rdquo;</p>
              <div className="label mt-5">Everyone sees</div>
              <p className="mt-2">
                <span className="redact mr-1.5" style={{ width: '2.4em' }} />
                <span className="redact mr-1.5" style={{ width: '3.2em' }} />
                <span className="redact" style={{ width: '2em' }} />
              </p>
              <div className="label mt-5">Plus a sealed random number</div>
              <p className="mt-2 font-mono text-[0.7rem] text-muted">
                kept secret until 2047
              </p>
              <div className="label mt-5">Which together give this code</div>
              <p className="mt-2 break-all font-mono text-[0.7rem] leading-relaxed text-seal">
                4f2c9a01b7e5d3f8a6c40be91d27358fa0c6e8b1d4079a2f35c8e16b0da47f92
              </p>
            </div>
          </div>
        </section>

        <div className="rule" />

        {/* the wall */}
        <section id="wall" className="py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label">Inside the capsule</div>
              <h2 className="mt-3 font-display text-4xl md:text-5xl">
                You can see who. Not what.
              </h2>
              <p className="mt-3 text-ink-3">
                Every sentence sealed so far. The black bars are real messages.
              </p>
            </div>
            {total !== null && total > 0 && (
              <div className="text-right">
                <div className="font-mono text-4xl font-bold tabular-nums">
                  {total.toLocaleString()}
                </div>
                <div className="label mt-1">sealed</div>
              </div>
            )}
          </div>

          {!configured ? (
            <p className="mt-8 font-mono text-sm text-muted">Not connected to the database yet.</p>
          ) : (
            <Wall entries={entries} loading={loading} />
          )}

          {entries.length >= 60 && (
            <p className="mt-6 font-mono text-[0.75rem] text-muted">Showing the 60 most recent.</p>
          )}
        </section>
      </main>

      <footer className="mt-8 bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <div className="font-display text-3xl">The 20 Year Capsule</div>
          <p className="mt-3 max-w-lg text-[0.92rem] leading-relaxed opacity-70">
            Sealed {SEAL_LABEL}. Opens {OPEN_LABEL}. One sentence, two dollars, twenty years.
          </p>
          <div className="mt-6 flex flex-wrap gap-5 font-mono text-[0.72rem] uppercase tracking-[0.12em] opacity-70">
            <Link to="/terms" className="underline underline-offset-4 hover:opacity-100">
              Terms &amp; what you&rsquo;re buying
            </Link>
            <a href="#write" className="underline underline-offset-4 hover:opacity-100">
              Write a message
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
