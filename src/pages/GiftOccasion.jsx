import { Link, useParams, Navigate } from 'react-router-dom'
import { PRICE_USD, SEAL_LABEL, OPEN_LABEL, MAX_CHARS } from '../lib/capsule.js'
import { OCCASIONS, OCCASION_LIST } from '../data/occasions.js'

/**
 * One component, four routes. The content lives in data/occasions.js so the page and the
 * pre-rendered meta tags cannot drift apart.
 *
 * These pages exist for search and for answer engines, so they are built to be quotable rather than
 * to be clever: a direct lead, three specific arguments, and a short FAQ whose answers stand on
 * their own if a model lifts one out of context. Anything vague here is wasted — "the perfect gift
 * for someone special" is exactly the sentence nobody can cite.
 */
export default function GiftOccasion() {
  const { occasion } = useParams()
  const o = OCCASIONS[occasion]

  // An unknown occasion is not a 404 worth building — the gift page is a better answer.
  if (!o) return <Navigate to="/gift" replace />

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14">
        <nav className="label" aria-label="Breadcrumb">
          <Link to="/gift" className="underline underline-offset-4 hover:text-ink">
            Give an entry
          </Link>{' '}
          <span aria-hidden="true">·</span> {o.nav}
        </nav>

        <h1 className="mt-4 font-display text-5xl leading-[0.95] md:text-6xl">
          {o.h1[0]}
          <br />
          {o.h1[1]}
        </h1>

        <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">{o.lead}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/gift" className="btn btn-primary">
            Give an entry &mdash; ${PRICE_USD}
          </Link>
          <span className="text-[0.9rem] text-ink-3">
            Sealed {SEAL_LABEL.split(' · ')[0]} · opens {OPEN_LABEL}
          </span>
        </div>

        <div className="rule mt-14" />

        <section className="py-12">
          <div className="grid gap-9 sm:grid-cols-3">
            {o.beats.map(([t, body]) => (
              <div key={t}>
                <h2 className="font-display text-2xl leading-tight">{t}</h2>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-3">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rule" />

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">How it works</h2>
          <ol className="mt-8 grid gap-7 sm:grid-cols-3">
            {[
              ['01', 'You buy the entry', `$${PRICE_USD}. Nothing is mailed and nothing is shipped.`],
              [
                '02',
                'They write the sentence',
                `Up to ${MAX_CHARS} characters, in their own words, under their own name. No account, nothing to pay.`,
              ],
              [
                '03',
                'It opens in 2047',
                `Sealed ${SEAL_LABEL.split(' · ')[0]}. Published ${OPEN_LABEL}, all at once, with everyone else's.`,
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

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">Questions</h2>
          <dl className="mt-8 grid gap-7">
            {o.faq.map(([q, a]) => (
              <div key={q}>
                <dt className="font-display text-2xl leading-tight">{q}</dt>
                <dd className="mt-2 max-w-2xl text-[0.98rem] leading-relaxed text-ink-3">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="rule" />

        <section className="py-12">
          <div className="bg-paper-2 p-7 md:p-9">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">
              Give one &mdash; ${PRICE_USD}
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
              They write their own sentence. It is sealed {SEAL_LABEL.split(' · ')[0]} and nobody
              reads it &mdash; not you, not them &mdash; until {OPEN_LABEL}.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/gift" className="btn btn-primary">
                Give an entry
              </Link>
              <Link to="/#write" className="btn btn-ghost">
                Write your own
              </Link>
            </div>
          </div>
        </section>

        <nav className="pb-6" aria-label="Other occasions">
          <div className="label">For other occasions</div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
            {OCCASION_LIST.filter((x) => x.slug !== o.slug).map((x) => (
              <Link key={x.slug} to={`/gift/${x.slug}`} className="underline underline-offset-4">
                {x.nav}
              </Link>
            ))}
          </div>
        </nav>
      </main>
    </div>
  )
}
