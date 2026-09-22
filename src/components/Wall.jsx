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
    <span
      className="inline-flex flex-wrap items-center gap-x-[0.34em] gap-y-[0.3em]"
      aria-label="Sealed message"
    >
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
      <div className="flex flex-wrap items-baseline gap-3">
        <Link
          to={`/m/${entry.seq}`}
          className="shrink-0 font-mono text-[0.72rem] font-bold tabular-nums text-muted hover:text-ink"
        >
          #{String(entry.seq).padStart(6, '0')}
        </Link>
        <span className="shrink-0 text-[0.9rem] font-semibold text-ink-2">
          {entry.display_name || 'Anonymous'}
        </span>
        {entry.location && (
          <span className="shrink-0 text-[0.82rem] text-muted">{entry.location}</span>
        )}
        {when && (
          <span className="ml-auto shrink-0 font-mono text-[0.68rem] tabular-nums text-muted">
            {when.toISOString().slice(0, 10)}
          </span>
        )}
      </div>
      <div className="mt-2 leading-relaxed text-ink" style={{ fontSize: '1.02rem' }}>
        <Redaction chars={entry.char_count || 40} />
      </div>
    </li>
  )
}

/**
 * The zero state.
 *
 * An empty gallery announces that nothing is happening. This does the opposite job with the same
 * true facts: the wall is empty, which means the lowest entry numbers have not been taken, and
 * those are the only genuinely scarce thing here. #000001 exists exactly once and will still say
 * #000001 when it is published in 2047.
 */
function EmptyWall() {
  return (
    <div className="mt-2 border border-dashed border-rule p-9 md:p-12">
      <div className="mx-auto max-w-lg text-center">
        <span className="stamp">Unopened</span>
        <p className="mt-6 font-display text-4xl leading-tight">
          Nobody has written to 2047 yet.
        </p>
        <p className="mt-4 leading-relaxed text-ink-3">
          Which means the first numbers are still on the shelf. Entry numbers are assigned in order
          and never reused — whoever writes next is{' '}
          <strong className="font-semibold text-ink-2">#000001</strong>, and still will be when the
          capsule opens in twenty years.
        </p>

        {/* what a sealed row will look like — clearly an illustration, not an entry */}
        <div className="mt-8 border border-rule bg-paper-2 p-5 text-left">
          <div className="label">What your entry will look like here</div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[0.72rem] font-bold text-muted">#000001</span>
            <span className="text-[0.9rem] font-semibold text-ink-2">Your name</span>
            <span className="text-[0.82rem] text-muted">Your town</span>
          </div>
          <div className="mt-2" style={{ fontSize: '1.02rem' }}>
            <Redaction chars={34} />
          </div>
          <p className="mt-3 font-mono text-[0.7rem] text-muted">
            Everything except the sentence.
          </p>
        </div>

        <a href="#write" className="btn btn-primary mt-8">
          Take #000001
        </a>
      </div>
    </div>
  )
}

export default function Wall({ entries, loading }) {
  if (loading) {
    return (
      <ul className="mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rule py-4 opacity-30 first:border-t-0">
            <div className="h-3 w-40 rounded-sm bg-paper-3" />
            <div className="mt-3 h-4 w-full max-w-lg rounded-sm bg-paper-3" />
          </li>
        ))}
      </ul>
    )
  }

  if (!entries?.length) return <EmptyWall />

  return (
    <ul className="mt-2">
      {entries.map((e) => (
        <WallRow key={e.seq} entry={e} />
      ))}
    </ul>
  )
}
