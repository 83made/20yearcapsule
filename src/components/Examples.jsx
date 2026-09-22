import { useState } from 'react'
import { EXAMPLE_GROUPS } from '../data/examples.js'

/**
 * Four kinds of sentence, with real examples, tappable straight into the form.
 *
 * This replaces most of what used to be explanatory copy. Showing someone "I will marry Steven R."
 * and "Gas is $3.42 a gallon and people say that is cheap" teaches the format, the tone, and the
 * permitted range of seriousness faster than any paragraph, and clicking one removes the blank-page
 * problem entirely — you start from a real sentence and edit it into your own.
 */
export default function Examples({ onPick }) {
  const [active, setActive] = useState(EXAMPLE_GROUPS[0].id)
  const group = EXAMPLE_GROUPS.find((g) => g.id === active) ?? EXAMPLE_GROUPS[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_GROUPS.map((g) => {
          const on = g.id === active
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActive(g.id)}
              aria-pressed={on}
              className={`rounded-full px-4 py-2 text-[0.95rem] font-semibold transition-colors ${
                on
                  ? 'bg-ink text-white'
                  : 'bg-bg-2 text-ink-2 hover:bg-bg-3'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {g.label}
            </button>
          )
        })}
      </div>

      <p className="mt-5 text-ink-3 leading-relaxed max-w-2xl">{group.hint}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.items.map((text) => (
          <button key={text} type="button" className="chip" onClick={() => onPick?.(text)}>
            <span aria-hidden="true" className="mr-1.5 text-gold">
              &ldquo;
            </span>
            {text}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[0.92rem] text-muted">
        Tap any of these to start from it — then change it into yours.
      </p>
    </div>
  )
}
