import { Link } from 'react-router-dom'
import { MAX_CHARS, PRICE_USD, SEAL_LABEL, OPEN_LABEL } from '../lib/capsule.js'
import { EXAMPLE_GROUPS } from '../data/examples.js'
import { FAQ } from '../data/what-to-write.js'

/**
 * The answer page.
 *
 * "What do you write in a time capsule" is a question people genuinely ask and assistants genuinely
 * answer, and the honest answer is short and counter-intuitive: specific beats profound, and the
 * mundane detail outlives the grand sentiment. That claim is the whole asset here. Everything else
 * on the page is evidence for it.
 *
 * Built from EXAMPLE_GROUPS so the advice and the examples the compose box actually shows cannot
 * drift apart — a guide recommending sentences the product never suggests is worse than no guide.
 *
 * Written to be quotable in pieces. Each heading answers a question on its own, because the likely
 * way this earns anything is a model lifting one paragraph, not a reader arriving at the top.
 */
export default function WhatToWrite() {
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
        <div className="label">A guide</div>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
          What to write
          <br />
          in a time capsule.
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-2">
          Write something specific enough that the future can check it. A sentence that could have
          been written in any year will mean nothing in any year &mdash; and the detail that feels
          too ordinary to bother recording is almost always the one worth reading in twenty years.
        </p>

        <div className="rule mt-12" />

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">Why most of them are a let-down</h2>
          <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-ink-2">
            People reach for profundity, and profundity does not age. &ldquo;I hope we are all still
            happy and healthy&rdquo; is a kind thought that tells a reader in 2047 absolutely nothing
            &mdash; not about the year it was written, not about the person who wrote it.
          </p>
          <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-ink-2">
            Now compare: <em>&ldquo;Gas is $3.42 a gallon and people say that is cheap.&rdquo;</em>{' '}
            That is dull today and it is a time machine in twenty years. It dates itself precisely,
            it is checkable, and it carries the thing nobody thinks to record &mdash; what normal
            felt like.
          </p>
          <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-ink-3">
            The rule that falls out of it: <strong className="font-semibold text-ink-2">if your
            sentence would read the same written in 2006, rewrite it.</strong>
          </p>
        </section>

        <div className="rule" />

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">Four things that work</h2>
          <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-ink-3">
            Nearly every good entry is one of these. Pick whichever you can answer fastest &mdash;
            the first thing you thought of is usually the honest one.
          </p>

          <div className="mt-10 grid gap-10">
            {EXAMPLE_GROUPS.map((g, i) => (
              <div key={g.id}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[0.72rem] font-bold text-seal">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-3xl leading-tight">{g.label}</h3>
                </div>
                <p className="mt-2 max-w-2xl text-[0.98rem] leading-relaxed text-ink-3">{g.hint}</p>
                <ul className="mt-4 grid gap-2">
                  {g.items.map((item) => (
                    <li
                      key={item}
                      className="border-l-2 pl-4 text-[1.02rem] leading-relaxed text-ink-2"
                      style={{ borderColor: 'var(--color-rule)' }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="rule" />

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">What not to write</h2>
          <ul className="mt-8 grid gap-5 text-[1.02rem] leading-relaxed text-ink-2">
            <li>
              <strong className="font-semibold text-ink">
                Anything you would not want published under your name.
              </strong>{' '}
              It is published in full, with whatever name you gave, and it cannot be edited or taken
              back afterwards. Twenty years is long enough that you will have changed your mind about
              something.
            </li>
            <li>
              <strong className="font-semibold text-ink">
                Other people&rsquo;s private information.
              </strong>{' '}
              A phone number, an address, someone else&rsquo;s secret. They did not agree to be in
              it, and in 2047 it is public.
            </li>
            <li>
              <strong className="font-semibold text-ink">An in-joke with no handle on it.</strong> A
              reference to 2026 is good &mdash; that is the point. A joke only three people
              understand is just three words to everyone else, including you.
            </li>
            <li>
              <strong className="font-semibold text-ink">A prediction you cannot lose.</strong>{' '}
              &ldquo;Things will be different&rdquo; is not a prediction. Call it tightly enough that
              you could be wrong, because being wrong is the interesting outcome.
            </li>
          </ul>
        </section>

        <div className="rule" />

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">How long should it be?</h2>
          <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-ink-2">
            Here, {MAX_CHARS} characters &mdash; about one sentence. The limit is not a technical
            constraint, it is the useful part: you cannot hedge in {MAX_CHARS} characters, and a
            paragraph of careful qualification ages far worse than one flat claim.
          </p>
          <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-ink-3">
            If you are filling a physical capsule instead, the same rule holds for different reasons:
            the single specific object beats the box of general ones.
          </p>
        </section>

        <div className="rule" />

        <section className="py-12">
          <h2 className="font-display text-4xl md:text-5xl">Questions</h2>
          <dl className="mt-8 grid gap-7">
            {FAQ.map(([q, a]) => (
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
              Write one &mdash; ${PRICE_USD}
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
              One sentence, sealed {SEAL_LABEL.split(' · ')[0]}, published {OPEN_LABEL}. Nobody reads
              it before then &mdash; not even you.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/#write" className="btn btn-primary">
                Write yours
              </Link>
              <Link to="/gift" className="btn btn-ghost">
                Give one to someone
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
