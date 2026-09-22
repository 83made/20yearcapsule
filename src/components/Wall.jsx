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
    <li className="rounded-2xl border border-line p-4 transition-colors hover:border-ink-3">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="text-[0.95rem] font-semibold text-ink">
          {entry.display_name || 'Anonymous'}
        </span>
        {entry.location && <span className="text-[0.85rem] text-muted">{entry.location}</span>}
        {when && (
          <span className="ml-auto text-[0.78rem] tabular-nums text-muted">
            {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <div className="mt-2.5 leading-relaxed" style={{ fontSize: '1.02rem' }}>
        <Redaction chars={entry.char_count || 40} />
      </div>
      <Link
        to={`/m/${entry.seq}`}
        className="mt-3 inline-block font-mono text-[0.7rem] font-bold text-muted hover:text-ink"
      >
        #{String(entry.seq).padStart(6, '0')}
      </Link>
    </li>
  )
}

export default function Wall({ entries, loading, emptyNote }) {
  if (loading) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-line p-4 opacity-40">
            <div className="h-3 w-28 rounded bg-bg-3" />
            <div className="mt-4 h-4 w-full rounded bg-bg-3" />
          </li>
        ))}
      </ul>
    )
  }

  if (!entries?.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line p-10 text-center">
        <p className="text-lg font-semibold text-ink">Nothing sealed yet.</p>
        <p className="mt-1.5 text-ink-3">{emptyNote || 'Message #1 is still available.'}</p>
        <a href="#write" className="btn btn-primary mt-6">Write the first one</a>
      </div>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e) => (
        <WallRow key={e.seq} entry={e} />
      ))}
    </ul>
  )
}
