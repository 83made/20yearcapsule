import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PRICE_USD, MAX_CHARS, SEAL_LABEL, OPEN_LABEL } from '../lib/capsule.js'
import { OCCASION_LIST } from '../data/occasions.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-capsule-checkout`

/**
 * Buying an entry for someone else.
 *
 * Every field here is optional, which is unusual for a checkout and deliberate. The buyer is not
 * writing the note, and we are not building a profile of the person receiving it — the only thing
 * this purchase strictly needs is the payment. Someone who intends to hand a printed card over on
 * Christmas morning can tell us nothing at all and it still works.
 *
 * What the page does have to be loud about is that the recipient writes it, not them. That is the
 * whole difference from the ordinary flow, and the first version of this feature got it backwards,
 * which is why it is said three times here.
 */
export default function GiftBuy() {
  const [fromName, setFromName] = useState('')
  const [toName, setToName] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [note, setNote] = useState('')
  const [deliver, setDeliver] = useState('email') // 'email' | 'hand'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const emailing = deliver === 'email'
  const ready = !emailing || toEmail.trim().length > 0

  async function submit(e) {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: JSON.stringify({
          kind: 'gift',
          purchaser_name: fromName.trim(),
          recipient_name: toName.trim(),
          // Only sent when they actually chose to have us email them. Choosing "I'll give it to
          // them" and leaving a stale address in the box must not quietly mail a stranger.
          recipient_email: emailing ? toEmail.trim() : '',
          gift_note: note.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.')
      window.location.href = data.url
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setBusy(false)
    }
  }

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
        <div className="label">Give an entry</div>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
          You pay for it.
          <br />
          They write it.
        </h1>

        <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
          Buy someone a place in the capsule and they write their own sentence &mdash; no checkout
          for them, nothing to pay. It seals {SEAL_LABEL.split(' · ')[0]} and opens {OPEN_LABEL},
          under <strong className="font-semibold">their</strong> name.
        </p>

        <form onSubmit={submit} className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gf" className="label">
                  Your name <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="gf"
                  className="field mt-2"
                  maxLength={40}
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Jon"
                  aria-describedby="gf-help"
                />
                <p id="gf-help" className="mt-2 text-[0.88rem] leading-relaxed text-muted">
                  Shown to them as who it came from. Never published.
                </p>
              </div>
              <div>
                <label htmlFor="gt" className="label">
                  Their name <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="gt"
                  className="field mt-2"
                  maxLength={40}
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  placeholder="Mum"
                  aria-describedby="gt-help"
                />
                <p id="gt-help" className="mt-2 text-[0.88rem] leading-relaxed text-muted">
                  So the page greets them properly. They choose the name that gets published.
                </p>
              </div>
            </div>

            <div className="mt-7">
              <div className="label">How should they get it?</div>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Delivery">
                {[
                  ['email', 'Email it to them', 'They get the link as soon as you pay'],
                  ['hand', 'I’ll give it to them', 'You get the link and a printable card'],
                ].map(([v, title, sub]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDeliver(v)}
                    aria-pressed={deliver === v}
                    className="flex-1 border px-4 py-3 text-left transition-colors"
                    style={{
                      minWidth: '12rem',
                      borderColor: deliver === v ? 'var(--color-ink)' : 'var(--color-rule)',
                      background: deliver === v ? 'var(--color-ink)' : 'transparent',
                      color: deliver === v ? 'var(--color-paper)' : 'var(--color-ink-2)',
                    }}
                  >
                    <span className="block text-[0.98rem] font-semibold">{title}</span>
                    <span className="block text-[0.85rem] opacity-70">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {emailing && (
              <div className="mt-5 border-l-2 pl-5" style={{ borderColor: 'var(--color-seal)' }}>
                <label htmlFor="ge" className="label">
                  Their email
                </label>
                <input
                  id="ge"
                  type="email"
                  className="field mt-2"
                  maxLength={120}
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="mum@example.com"
                  aria-describedby="ge-help"
                />
                <p id="ge-help" className="mt-2 text-[0.88rem] leading-relaxed text-muted">
                  Used once, for this, and never again. We tell them a note is waiting &mdash; the
                  capsule itself stays shut.
                </p>
              </div>
            )}

            <div className="mt-7">
              <label htmlFor="gn" className="label">
                A line from you <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="gn"
                rows={2}
                className="field mt-2 resize-none leading-relaxed"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Thought you should be in this one."
                aria-describedby="gn-help"
              />
              <p id="gn-help" className="mt-2 text-[0.88rem] leading-relaxed text-muted">
                They see this when they open the link. It is wrapping paper &mdash; it does not go
                into the capsule and is never published.
              </p>
            </div>
          </div>

          <div className="self-start bg-paper-2 p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-6xl leading-none">${PRICE_USD}</span>
              <span className="text-[0.95rem] font-semibold text-muted">one entry</span>
            </div>

            <ul className="mt-6 grid gap-3.5 text-[0.98rem] leading-snug text-ink-2">
              {[
                ['They write it', `Up to ${MAX_CHARS} characters, in their own words.`],
                ['Their name on the wall', 'It is their entry, not yours.'],
                ['Nothing for them to pay', 'No checkout, no account. Just the link.'],
                ['Unused by December 31', 'You are refunded in full, automatically.'],
              ].map(([t, sub]) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[1px] font-mono text-seal">
                    &mdash;
                  </span>
                  <span>
                    <span className="font-semibold text-ink">{t}</span>
                    <br />
                    <span className="text-[0.9rem] text-ink-3">{sub}</span>
                  </span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-5 bg-paper-3 p-3 text-[0.92rem] font-medium text-ink-2">{error}</p>
            )}

            <button type="submit" disabled={busy || !ready} className="btn btn-primary mt-6 w-full">
              {busy ? 'Opening checkout…' : `Buy the entry — $${PRICE_USD}`}
            </button>

            <p className="mt-3 text-center text-[0.85rem] text-muted">
              Card payment by Stripe. Nothing is mailed to you.
            </p>
          </div>
        </form>

        <nav className="mt-12" aria-label="Occasions">
          <div className="label">Buying it for an occasion?</div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
            {OCCASION_LIST.map((o) => (
              <Link key={o.slug} to={`/gift/${o.slug}`} className="underline underline-offset-4">
                {o.nav}
              </Link>
            ))}
          </div>
        </nav>

        <p className="mt-8 text-[0.9rem] text-ink-3">
          Writing one yourself instead?{' '}
          <Link to="/#write" className="underline underline-offset-4">
            That is over here.
          </Link>
        </p>
      </main>
    </div>
  )
}
