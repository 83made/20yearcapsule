import { useState } from 'react'
import { EXAMPLE_GROUPS } from '../data/examples.js'
import { TILE_COLORS } from '../lib/palette.js'

/**
 * Four kinds of sentence, with real examples, tappable straight into the form.
 *
 * These are coloured the same way the wall tiles are, so the examples and the sealed messages read
 * as the same family of object — you can see what your example is going to turn into.
 *
 * This replaces most of what used to be explanatory copy. Showing "I will marry Steven R." next to
 * "Gas is $3.42 a gallon and people say that is cheap" teaches the format, the tone and the
 * permitted range of seriousness faster than any paragraph, and tapping one removes the blank-page
 * problem entirely.
 */
export default function Examples({ onPick }) {
  const [active, setActive] = useState(EXAMPLE_GROUPS[0].id)
  const group = EXAMPLE_GROUPS.find((g) => g.id === active) ?? EXAMPLE_GROUPS[0]

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_GROUPS.map((g, i) => {
          const on = g.id === active
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActive(g.id)}
              aria-pressed={on}
              className="rounded-full px-4 py-2.5 text-[0.97rem] font-semibold transition-transform active:translate-y-0.5"
              style={{
                fontFamily: 'var(--font-display)',
                background: on ? 'var(--color-ink)' : TILE_COLORS[i % TILE_COLORS.length].bg,
                color: on ? '#fff' : 'var(--color-ink)',
              }}
            >
              {g.label}
            </button>
          )
        })}
      </div>

      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-3">{group.hint}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.items.map((text, i) => (
          <button
            key={text}
            type="button"
            className="chip"
            style={{ background: TILE_COLORS[(i + 2) % TILE_COLORS.length].bg }}
            onClick={() => onPick?.(text)}
          >
            {text}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[0.95rem] text-muted">
        Tap one to start from it — then change it into yours.
      </p>
    </div>
  )
}
