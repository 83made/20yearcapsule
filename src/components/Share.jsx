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

  // On the dark confirmation panel vs on paper.
  const btn = dark
    ? 'border border-paper/30 text-paper hover:bg-paper hover:text-ink'
    : 'border border-rule text-ink hover:border-ink'

  return (
    <div>
      {/* mobile: one tap into the OS share sheet */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button type="button" onClick={nativeShare} className="btn btn-primary w-full sm:w-auto">
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
            className={`rounded-sm px-4 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.09em] transition-colors ${
              t.tone === 'primary' ? 'bg-seal text-paper hover:bg-seal-2' : btn
            }`}
          >
            {t.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          className={`rounded-sm px-4 py-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.09em] transition-colors ${btn}`}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <p className={`mt-4 text-[0.88rem] leading-relaxed ${dark ? 'text-paper/50' : 'text-muted'}`}>
        Sends this, with your entry number:{' '}
        <span className={dark ? 'text-paper/75' : 'text-ink-3'}>&ldquo;{text}&rdquo;</span>
      </p>
    </div>
  )
}
