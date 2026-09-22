import { useState } from 'react'
import { EXAMPLE_GROUPS } from '../data/examples.js'

/**
 * Four kinds of sentence, with real examples, tappable straight into the form.
 *
 * This replaces most of what used to be explanatory copy. Showing someone "I will marry Steven R."
 * and "Gas is $3.42 a gallon and people say that is cheap" teaches the format, the tone, and the
 * permitted range of seriousness faster than any paragraph, and clicking one removes the blank-page
 * problem entirely — you start from a real sentence and edit it into your own.
 *
 * The mix of earnest, mundane and funny is deliberate: it tells people they cannot get this wrong.
 */
export default function Examples({ onPick }) {
  const [active, setActive] = useState(EXAMPLE_GROUPS[0].id)
  const group = EXAMPLE_GROUPS.find((g) => g.id === active) ?? EXAMPLE_GROUPS[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className="pill"
            aria-pressed={g.id === active}
            onClick={() => setActive(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <p className="mt-5 max-w-2xl leading-relaxed text-ink-3">{group.hint}</p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {group.items.map((text) => (
          <button key={text} type="button" className="chip" onClick={() => onPick?.(text)}>
            <span aria-hidden="true" className="mr-1 text-seal">
              &ldquo;
            </span>
            {text}
          </button>
        ))}
      </div>

      <p className="mt-5 font-mono text-[0.75rem] text-muted">
        Tap one to start from it, then change it into yours.
      </p>
    </div>
  )
}
