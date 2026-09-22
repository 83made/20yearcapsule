import { useEffect, useState } from 'react'
import { MAX_CHARS, PRICE_USD, OPEN_LABEL, hashMessage } from '../lib/capsule.js'
import { ALL_EXAMPLES } from '../data/examples.js'
import { TILE_COLORS } from '../lib/palette.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-capsule-checkout`

export default function Compose({ sealed, prefill }) {
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ph, setPh] = useState(0)

  // A tapped example lands here.
  useEffect(() => {
    if (prefill) {
      setMessage(prefill)
      setPreview(null)
      setError('')
    }
  }, [prefill])

  // Rotating placeholder, so an untouched box still shows what a real message looks like.
  useEffect(() => {
    if (message) return
    const id = setInterval(() => setPh((n) => (n + 1) % ALL_EXAMPLES.length), 3200)
    return () => clearInterval(id)
  }, [message])

  const left = MAX_CHARS - message.length
  const over = left < 0
  const ready = message.trim().length > 0 && !over

  async function showPreview() {
    setPreview(await hashMessage(message.trim()))
  }

  async function submit(e) {
    e.preventDefault()
    if (!ready || busy) return
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
          message: message.trim(),
          display_name: name.trim(),
          location: location.trim(),
          email: email.trim(),
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

  if (sealed) {
    return (
      <div className="rounded-[32px] p-8 text-white sm:p-12" style={{ background: 'var(--color-ink)' }}>
        <div className="font-display text-[0.95rem] font-semibold text-white/55">Closed</div>
        <h2 className="mt-4 text-4xl sm:text-5xl">The capsule is sealed.</h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70">
          Entries closed on December 31, 2026. Everything inside opens {OPEN_LABEL}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
      <div>
        <label htmlFor="msg" className="label">
          Your message
        </label>
        <div className="relative mt-2">
          <textarea
            id="msg"
            rows={3}
            className="field resize-none text-lg leading-relaxed"
            style={{ borderColor: over ? 'var(--color-tomato)' : undefined }}
            maxLength={MAX_CHARS + 30}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setPreview(null)
            }}
            placeholder={ALL_EXAMPLES[ph]}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className={`text-[0.92rem] font-semibold ${over ? 'text-tomato' : 'text-muted'}`}>
            {over ? `${-left} characters too many` : `${left} characters left`}
          </span>
          {message.trim() && !over && (
            <button
              type="button"
              onClick={showPreview}
              className="text-[0.9rem] font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
            >
              See the proof code
            </button>
          )}
        </div>

        {preview && (
          <div className="mt-3 rounded-2xl p-4" style={{ background: TILE_COLORS[1].bg }}>
            <div className="label">Your proof code</div>
            <p className="mt-1.5 break-all font-mono text-[0.72rem] leading-relaxed text-ink-2">
              {preview}
            </p>
            <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-3">
              We publish this next to your entry. It is made from your exact words but cannot be
              turned back into them — so in 2047 you can prove nothing was changed.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nm" className="label">
              Your name <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="nm"
              className="field field-sm mt-2"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shows on the wall. Leave blank for Anonymous."
            />
          </div>
          <div>
            <label htmlFor="loc" className="label">
              Where you are <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="loc"
              className="field field-sm mt-2"
              maxLength={40}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Reno, NV"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="em" className="label">
            Email <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="em"
            type="email"
            className="field field-sm mt-2"
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="So we can tell you when it opens"
          />
          <p className="mt-2 text-[0.88rem] text-muted">
            Never shown publicly. Only used once, in 2047.
          </p>
        </div>
      </div>

      {/* what you're buying */}
      <div className="self-start rounded-[28px] p-6 sm:p-7" style={{ background: TILE_COLORS[3].bg }}>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-6xl font-bold leading-none">${PRICE_USD}</span>
          <span className="text-[0.95rem] font-semibold text-muted">one message</span>
        </div>

        <ul className="mt-6 grid gap-3.5 text-[0.98rem] leading-snug text-ink-2">
          {[
            [`Up to ${MAX_CHARS} characters`, 'About one sentence.'],
            ['Sealed immediately', 'Nobody sees it — not even you.'],
            ['Your name on the wall', 'The message stays hidden.'],
            ['Opens January 1, 2047', 'Published in full, all at once.'],
          ].map(([t, sub]) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-ink)' }} />
              <span>
                <span className="font-semibold text-ink">{t}</span>
                <br />
                <span className="text-[0.9rem] text-ink-3">{sub}</span>
              </span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mt-5 rounded-xl bg-bg-2 p-3 text-[0.92rem] font-medium text-ink-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={!ready || busy} className="btn btn-primary mt-6 w-full">
          {busy ? 'Opening checkout…' : `Seal it — $${PRICE_USD}`}
        </button>

        <p className="mt-3 text-center text-[0.85rem] text-muted">
          Card payment by Stripe. Nothing is mailed to you.
        </p>
      </div>
    </form>
  )
}
