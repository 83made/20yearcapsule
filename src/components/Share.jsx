import { useState } from 'react'
import { SITE, shareText, shareTargets } from '../lib/share.js'

/**
 * Sharing, for the phase where this lives or dies on people sending it to each other.
 *
 * The native share sheet is offered first on devices that have one — it reaches iMessage, WhatsApp
 * and everything else without us enumerating networks. But `navigator.share` does not exist on most
 * desktop browsers, so the explicit targets are always rendered too rather than hidden behind a
 * failed feature check. Desktop users were previously getting nothing but a clipboard copy.
 */
export default function Share({ seq, tone = 'light' }) {
  const [copied, setCopied] = useState(false)
  const targets = shareTargets(seq)
  const text = shareText(seq)
  const full = `${text}\n\n${SITE}`
  const dark = tone === 'light' // rendered on a dark panel

  async function nativeShare() {
    if (!navigator.share) return
    try {
      await navigator.share({ title: 'The 20 Year Capsule', text, url: SITE })
    } catch {
      /* dismissed — not an error */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setTimeout(() => setCopied(false), 2600)
    } catch {
      setCopied(false)
    }
  }

  const btn = dark
    ? 'bg-white/10 text-white hover:bg-white/20'
    : 'bg-bg-2 text-ink hover:bg-bg-3'

  return (
    <div>
      {/* mobile: one tap into the OS share sheet */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button type="button" onClick={nativeShare} className="btn btn-pop w-full sm:w-auto">
          Share
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((t) => (
          <a
            key={t.id}
            href={t.href}
            target={t.href.startsWith('http') ? '_blank' : undefined}
            rel={t.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className={`rounded-full px-4 py-2 text-[0.92rem] font-semibold transition-colors ${
              t.tone === 'primary' ? 'bg-tomato text-white' : btn
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          className={`rounded-full px-4 py-2 text-[0.92rem] font-semibold transition-colors ${btn}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <p className={`mt-4 text-[0.88rem] leading-relaxed ${dark ? 'text-white/45' : 'text-muted'}`}>
        Sends this, with your entry number:{' '}
        <span className={dark ? 'text-white/70' : 'text-ink-3'}>&ldquo;{text}&rdquo;</span>
      </p>
    </div>
  )
}
