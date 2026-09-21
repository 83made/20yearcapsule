import { useState } from 'react'
import { MAX_CHARS, PRICE_USD, OPEN_LABEL, hashMessage } from '../lib/capsule.js'

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-capsule-checkout`

export default function Compose({ sealed }) {
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const left = MAX_CHARS - message.length
  const ready = message.trim().length > 0 && left >= 0

  // Show people their own fingerprint before they pay. It is the clearest possible demonstration
  // that the proof is real and that it gives nothing away.
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
      <div className="bg-paper-2 p-8 rounded-sm">
        <span className="stamp">Sealed</span>
        <h2 className="mt-5 font-display text-4xl">The capsule is closed.</h2>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-2">
          Entries closed on December 31, 2026. Every sentence inside stays sealed until{' '}
          {OPEN_LABEL}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-8 md:grid-cols-[1.25fr_1fr]">
      <div>
        <h2 className="font-display text-4xl md:text-5xl">Write your sentence</h2>
        <p className="mt-3 text-ink-3 leading-relaxed">
          Nobody will read this — not even you — until it opens in 2047. Write accordingly.
        </p>

        <div className="mt-6">
          <label htmlFor="msg" className="label">
            Your message
          </label>
          <textarea
            id="msg"
            className="field mt-2 resize-none leading-relaxed"
            rows={3}
            maxLength={MAX_CHARS + 20}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setPreview(null)
            }}
            placeholder="Hi future Emma. You're 31 now."
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={`font-mono text-[0.72rem] ${left < 0 ? 'text-seal font-bold' : 'text-muted'}`}>
              {left} characters left
            </span>
            {message.trim() && (
              <button type="button" onClick={showPreview} className="font-mono text-[0.72rem] underline underline-offset-4 text-muted hover:text-ink">
                Show my fingerprint
              </button>
            )}
          </div>
          {preview && (
            <div className="mt-3 bg-paper-2 p-3 rounded-sm">
              <div className="label">Your SHA-256 fingerprint</div>
              <p className="mt-1 font-mono text-[0.68rem] break-all text-seal leading-relaxed">{preview}</p>
              <p className="mt-2 text-[0.78rem] text-muted leading-relaxed">
                This gets published next to your entry. It cannot be reversed into your sentence.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nm" className="label">
              Name on the wall <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input id="nm" className="field mt-2" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" />
          </div>
          <div>
            <label htmlFor="loc" className="label">
              Where you are <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input id="loc" className="field mt-2" maxLength={40} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Reno, NV" />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="em" className="label">
            Email <span className="normal-case tracking-normal">(optional — so we can tell you in 2047)</span>
          </label>
          <input id="em" type="email" className="field mt-2" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <p className="mt-2 text-[0.78rem] text-muted leading-relaxed">
            Never shown publicly. Only used to tell you when the capsule opens.
          </p>
        </div>
      </div>

      <div className="bg-paper-2 p-6 rounded-sm self-start">
        <div className="label">What you're buying</div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-6xl leading-none">${PRICE_USD}</span>
          <span className="font-mono text-[0.75rem] text-muted">one sentence</span>
        </div>

        <ul className="mt-6 grid gap-3 text-[0.9rem] leading-relaxed text-ink-2">
          {[
            `Up to ${MAX_CHARS} characters, sealed`,
            'Your name and city on the public wall',
            'A published fingerprint proving it was never altered',
            'Published in full on January 1, 2047',
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="text-seal font-mono mt-[1px]">—</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-[0.8rem] leading-relaxed text-muted">
          Nothing is mailed to you. There is no physical product and no refund once your message is
          sealed, because sealing it is the entire service.
        </p>

        {error && <p className="mt-4 font-mono text-[0.78rem] text-seal">{error}</p>}

        <button type="submit" disabled={!ready || busy} className="btn btn-primary w-full mt-6">
          {busy ? 'Opening checkout…' : `Seal it — $${PRICE_USD}`}
        </button>
        <p className="mt-3 text-center font-mono text-[0.68rem] text-muted">Card payment via Stripe</p>
      </div>
    </form>
  )
}
