import { useState } from 'react'

/**
 * Sharing, for the phase where the site lives or dies on people sending it to each other.
 *
 * Uses the native share sheet on mobile — which is where this actually gets shared, and which gives
 * access to iMessage, WhatsApp and everything else without us having to enumerate networks. Falls
 * back to copy-to-clipboard on desktop, and to a text selection if even that is blocked.
 *
 * The share text is written to be forwarded, not announced: "I put a message in a time capsule that
 * opens in 2047" is a sentence someone says to a friend. "Check out this website" is not.
 */
export default function Share({ seq, variant = 'full' }) {
  const [state, setState] = useState('idle')

  const url = 'https://20yearcapsule.com'
  const text = seq
    ? `I just sealed a message in a time capsule that opens on January 1, 2047. It's entry #${String(
        seq,
      ).padStart(6, '0')} and I'm not allowed to see it again until then.`
    : `You write one sentence, it gets sealed until January 1, 2047, and nobody reads it — not even you.`

  async function share() {
    const payload = { title: 'The 20 Year Capsule', text, url }
    if (navigator.share) {
      try {
        await navigator.share(payload)
        setState('shared')
        return
      } catch {
        // user dismissed the sheet — not an error worth showing
        return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`)
      setState('copied')
      setTimeout(() => setState('idle'), 2600)
    } catch {
      setState('manual')
    }
  }

  const label =
    state === 'copied' ? 'Copied' : state === 'shared' ? 'Thank you' : seq ? 'Share this' : 'Share'

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={share}
        className="text-[0.92rem] font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      <button type="button" onClick={share} className="btn btn-gold">
        {label}
      </button>
      {state === 'manual' && (
        <p className="mt-3 select-all rounded-xl bg-bg-2 p-3 text-[0.88rem] text-ink-2">
          {text} {url}
        </p>
      )}
    </div>
  )
}
