import { Link } from 'react-router-dom'
import { tileColor } from '../lib/palette.js'

/**
 * The wall — a grid of coloured tiles, one per sealed message.
 *
 * This is the change that makes the site feel like a capsule instead of a product page. A list of
 * rows reads as data; a wall of bright tiles with black bars across them reads as a collection of
 * real things someone put somewhere. Same information, completely different object.
 *
 * Bar widths come from the real character count, so a long message visibly looks long. That detail
 * is what stops the wall reading as decoration.
 */

function Redaction({ chars }) {
  const chunks = []
  let left = Math.max(chars, 8)
  let seed = chars * 7919 // deterministic: a message always renders the same shape
  while (left > 0) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    const size = Math.min(left, 3 + (seed % 8))
    chunks.push(size)
    left -= size
  }
  return (
    <span className="flex flex-wrap items-center gap-x-[0.3em] gap-y-[0.34em]" aria-label="Sealed message">
      {chunks.map((c, i) => (
        <span key={i} className="redact" style={{ width: `${c * 0.44}em` }} />
      ))}
    </span>
  )
}

export function WallTile({ entry }) {
  const c = tileColor(entry.seq)
  const when = entry.created_at ? new Date(entry.created_at) : null

  return (
    <Link to={`/m/${entry.seq}`} className="tile" style={{ background: c.bg }}>
      <div className="text-[0.95rem] font-semibold leading-tight">
        {entry.display_name || 'Anonymous'}
      </div>
      {entry.location && (
        <div className="mt-0.5 text-[0.82rem] text-ink-3">{entry.location}</div>
      )}

      <div className="mt-3.5 text-[0.98rem] leading-relaxed">
        <Redaction chars={entry.char_count || 40} />
      </div>

      <div className="mt-auto flex items-baseline justify-between gap-2 pt-3.5">
        <span className="font-mono text-[0.7rem] font-bold text-ink-3">
          #{String(entry.seq).padStart(6, '0')}
        </span>
        {when && (
          <span className="text-[0.74rem] text-ink-3">
            {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </Link>
  )
}

export default function Wall({ entries, loading, emptyNote }) {
  if (loading) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="tile animate-pulse"
            style={{ background: tileColor(i).bg, opacity: 0.55 }}
          />
        ))}
      </ul>
    )
  }

  if (!entries?.length) {
    return (
      <div
        className="rounded-3xl p-10 text-center sm:p-14"
        style={{ background: 'var(--color-bg-2)' }}
      >
        <div className="mx-auto flex max-w-xs flex-wrap justify-center gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="h-12 w-12 rounded-xl"
              style={{ background: tileColor(i).bg, opacity: 0.6 }}
            />
          ))}
        </div>
        <p className="mt-7 font-display text-2xl font-bold">The capsule is empty.</p>
        <p className="mt-2 text-ink-3">{emptyNote || 'Message #1 is still available.'}</p>
        <a href="#write" className="btn btn-pop mt-7">
          Write the first one
        </a>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map((e) => (
        <li key={e.seq}>
          <WallTile entry={e} />
        </li>
      ))}
    </ul>
  )
}
