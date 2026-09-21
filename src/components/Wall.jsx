import { Link } from 'react-router-dom'

/**
 * The redaction wall. This is the only view anyone gets of the capsule's contents for twenty years,
 * so it has to do the persuading: real names, real places, real timestamps, and a black bar where
 * the sentence is. The bar width is derived from the message's character count, which is public
 * metadata — so a long message visibly looks long. That small detail is what makes the wall read as
 * real rather than decorative.
 */

function Redaction({ chars }) {
  // Break the bar into word-ish chunks so it reads as a redacted sentence, not one solid block.
  const chunks = []
  let left = Math.max(chars, 8)
  let seed = chars * 7919 // deterministic: the same message always renders the same shape
  while (left > 0) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    const size = Math.min(left, 2 + (seed % 9))
    chunks.push(size)
    left -= size
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-[0.34em] gap-y-[0.3em]" aria-label="Sealed message">
      {chunks.map((c, i) => (
        <span key={i} className="redact" style={{ width: `${c * 0.52}em` }} />
      ))}
    </span>
  )
}

export function WallRow({ entry }) {
  const when = entry.created_at ? new Date(entry.created_at) : null
  return (
    <li className="rule py-4 first:border-t-0">
      <div className="flex items-baseline gap-3 flex-wrap">
        <Link
          to={`/m/${entry.seq}`}
          className="font-mono text-[0.72rem] font-bold text-muted hover:text-ink tabular-nums shrink-0"
        >
          #{String(entry.seq).padStart(6, '0')}
        </Link>
        <span className="font-sans text-[0.9rem] font-semibold text-ink-2 shrink-0">
          {entry.display_name || 'Anonymous'}
        </span>
        {entry.location && (
          <span className="font-sans text-[0.82rem] text-muted shrink-0">{entry.location}</span>
        )}
        {when && (
          <span className="font-mono text-[0.68rem] text-muted ml-auto tabular-nums shrink-0">
            {when.toISOString().slice(0, 10)}
          </span>
        )}
      </div>
      <div className="mt-2 text-ink leading-relaxed" style={{ fontSize: '1.02rem' }}>
        <Redaction chars={entry.char_count || 40} />
      </div>
    </li>
  )
}

export default function Wall({ entries, loading, emptyNote }) {
  if (loading) {
    return (
      <ul className="mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rule py-4 first:border-t-0 opacity-30">
            <div className="h-3 w-40 bg-paper-3 rounded-sm" />
            <div className="mt-3 h-4 w-full max-w-lg bg-paper-3 rounded-sm" />
          </li>
        ))}
      </ul>
    )
  }

  if (!entries?.length) {
    return (
      <p className="mt-6 font-mono text-sm text-muted">
        {emptyNote || 'No messages sealed yet. The first one is still available.'}
      </p>
    )
  }

  return (
    <ul className="mt-2">
      {entries.map((e) => (
        <WallRow key={e.seq} entry={e} />
      ))}
    </ul>
  )
}
