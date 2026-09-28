import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MAX_CHARS, OPEN_LABEL, SEAL_LABEL } from '../lib/capsule.js'
import { ALL_EXAMPLES } from '../data/examples.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/redeem-gift`

const call = async (body) => {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

function Shell({ children }) {
  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-5 py-3">
          <Link to="/" className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">
            20yearcapsule.com
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14">{children}</main>
    </div>
  )
}

/**
 * The redemption page.
 *
 * Whoever lands here has been given something, usually by a person they know, and quite possibly
 * has never heard of this site. So the page explains the whole thing before it asks for a sentence,
 * and it never implies they owe anyone a reply: the dead ends below all say plainly that the buyer
 * gets their money back, because the alternative is someone writing something they do not mean out
 * of guilt.
 *
 * The note they write is theirs. It seals under THEIR name, not the buyer's — the buyer paid for a
 * seat, not for a voice.
 */
export default function Redeem() {
  const { token } = useParams()
  const [state, setState] = useState('loading')
  const [gift, setGift] = useState(null)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sealed, setSealed] = useState(null)
  const [ph, setPh] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await call({ token, action: 'peek' })
      if (!alive) return
      setGift(data)
      setState(data?.state ?? 'not_found')
    })()
    return () => {
      alive = false
    }
  }, [token])

  useEffect(() => {
    if (message || state !== 'open') return
    const id = setInterval(() => setPh((n) => (n + 1) % ALL_EXAMPLES.length), 3200)
    return () => clearInterval(id)
  }, [message, state])

  const left = MAX_CHARS - message.length
  const over = left < 0
  const ready = message.trim().length > 0 && !over

  async function submit(e) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    const { ok, data } = await call({
      token,
      action: 'redeem',
      message: message.trim(),
      display_name: name.trim(),
      location: location.trim(),
      email: email.trim(),
    })
    if (ok && data.state === 'sealed_ok') {
      setSealed(data)
      setState('done')
      return
    }
    // A link used elsewhere between loading this page and submitting it is not an error the person
    // can fix, so it takes over the page rather than appearing as a message above the button.
    if (data?.state && data.state !== 'sealed_ok') {
      setState(data.state)
      return
    }
    setError(data?.error || 'Something went wrong.')
    setBusy(false)
  }

  if (state === 'loading') {
    return (
      <Shell>
        <p className="font-mono text-sm text-muted">Checking the link…</p>
      </Shell>
    )
  }

  if (state === 'done' && sealed) {
    return (
      <Shell>
        <span className="stamp">Sealed</span>
        <h1 className="mt-6 font-display text-5xl leading-[0.95] md:text-6xl">
          That&rsquo;s it.
          <br />
          See you in 2047.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
          Your sentence is in the capsule. Nobody reads it &mdash; including you &mdash; until{' '}
          <strong className="font-semibold">{OPEN_LABEL}</strong>.
        </p>

        <div className="mt-10 border border-rule bg-paper-2 p-6 sm:p-8">
          <div className="label">Your entry</div>
          <div className="mt-2 font-mono text-5xl font-bold tabular-nums">
            #{String(sealed.seq).padStart(6, '0')}
          </div>
          <div className="label mt-6">Proof code</div>
          <p className="mt-2 break-all font-mono text-[0.68rem] leading-relaxed text-ink-2">
            {sealed.message_hash}
          </p>
          <Link
            to={`/m/${sealed.seq}`}
            className="mt-6 inline-block font-semibold underline underline-offset-4"
          >
            See your entry page
          </Link>
        </div>

        <p className="mt-10 text-[0.95rem] leading-relaxed text-ink-3">
          {gift?.purchaser_name ? `${gift.purchaser_name} paid for this one.` : 'Someone paid for this one.'}{' '}
          If you want to put someone else in the capsule,{' '}
          <Link to="/gift" className="underline underline-offset-4">
            you can do the same for them
          </Link>
          .
        </p>
      </Shell>
    )
  }

  if (state !== 'open') {
    const copy = {
      not_found: [
        'This link is not valid.',
        'It may have been mistyped, or it was never a real link. Nothing has been charged to anyone.',
      ],
      redeemed: [
        'This one has already been written.',
        'The sentence is sealed and nobody can read it until 2047 — including whoever wrote it. A link works exactly once.',
      ],
      refunded: [
        'This gift was refunded.',
        'It was not written before the capsule sealed, so the money went back to whoever bought it. Nothing was kept.',
      ],
      sealed: [
        'The capsule is closed.',
        `Entries closed ${SEAL_LABEL.split(' · ')[0]}. This one was not written in time, so whoever bought it is being refunded in full.`,
      ],
    }[state] ?? ['Something is wrong with this link.', 'Nothing has been charged to anyone.']

    return (
      <Shell>
        <h1 className="font-display text-5xl leading-tight">{copy[0]}</h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-2">{copy[1]}</p>
        {state === 'redeemed' && gift?.seq && (
          <Link
            to={`/m/${gift.seq}`}
            className="mt-6 inline-block font-semibold underline underline-offset-4"
          >
            See the entry
          </Link>
        )}
        <div className="mt-10">
          <Link to="/" className="btn btn-ghost">
            See the capsule
          </Link>
        </div>
      </Shell>
    )
  }

  const greeting = gift?.recipient_name ? `${gift.recipient_name},` : 'Someone'
  const from = gift?.purchaser_name || 'Someone'

  return (
    <Shell>
      <div className="label">A gift</div>
      <h1 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">
        {gift?.recipient_name ? greeting : 'Someone'}
        <br />
        {from} bought you a place in 2047.
      </h1>

      <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
        It is already paid for. You write one sentence, up to {MAX_CHARS} characters. It is sealed on{' '}
        {SEAL_LABEL.split(' · ')[0]}, nobody reads it &mdash; not you, not {from}, not us &mdash; and
        it is published on {OPEN_LABEL}, twenty years later, alongside everyone else&rsquo;s.
      </p>

      {gift?.gift_note && (
        <blockquote
          className="mt-7 border-l-2 pl-5 font-display text-2xl leading-snug text-ink-2"
          style={{ borderColor: 'var(--color-seal)' }}
        >
          {gift.gift_note}
        </blockquote>
      )}

      <form onSubmit={submit} className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <label htmlFor="msg" className="label">
            Your sentence
          </label>
          <textarea
            id="msg"
            rows={3}
            className="field mt-2 resize-none leading-relaxed"
            style={{ borderColor: over ? 'var(--color-seal)' : undefined }}
            maxLength={MAX_CHARS + 30}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={ALL_EXAMPLES[ph]}
          />
          <div className="mt-2">
            <span
              className={`text-[0.92rem] font-semibold ${over ? 'font-bold text-seal' : 'text-muted'}`}
            >
              {over ? `${-left} characters too many` : `${left} characters left`}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nm" className="label">
                Your name <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="nm"
                className="field mt-2"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name, full name, or a nickname"
                aria-describedby="nm-help"
              />
              <p id="nm-help" className="mt-2 text-[0.88rem] leading-relaxed text-muted">
                Shown on the wall now and published as-is in 2047. Leave blank for Anonymous.
              </p>
            </div>
            <div>
              <label htmlFor="loc" className="label">
                Where you are <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="loc"
                className="field mt-2"
                maxLength={40}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Reno, NV"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="em" className="label">
              Your email <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="em"
              type="email"
              className="field mt-2"
              maxLength={120}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="So we can tell you when it opens"
            />
            <p className="mt-2 text-[0.88rem] text-muted">
              Never shown publicly, and never given to {from}. Used once, in 2047.
            </p>
          </div>
        </div>

        <div className="self-start bg-paper-2 p-6">
          <div className="font-display text-4xl leading-none">Paid for</div>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
            {from} covered this. There is nothing for you to pay and no account to make.
          </p>

          <ul className="mt-6 grid gap-3.5 text-[0.98rem] leading-snug text-ink-2">
            {[
              ['It seals immediately', 'You will not be shown it again.'],
              ['Your name on the wall', 'The sentence stays hidden.'],
              [`Opens ${OPEN_LABEL}`, 'Published in full, all at once.'],
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

          <button type="submit" disabled={!ready || busy} className="btn btn-primary mt-6 w-full">
            {busy ? 'Sealing…' : 'Seal it'}
          </button>

          <p className="mt-3 text-center text-[0.85rem] text-muted">
            Once sealed it cannot be changed or withdrawn.
          </p>
        </div>
      </form>

      <p className="mt-12 max-w-xl text-[0.9rem] leading-relaxed text-ink-3">
        Not for you? Leave it. If nobody writes it by {SEAL_LABEL.split(' · ')[0]}, {from} is
        refunded in full and nothing is published. You are not expected to reply to anyone.
      </p>
    </Shell>
  )
}
