import { useEffect, useState } from 'react'
import { countdown } from '../lib/capsule.js'

/**
 * Two very different jobs, same component.
 *  - variant="seal"  — the deadline. Ticks every second, because urgency is the point.
 *  - variant="open"  — twenty years out. Ticks every minute; a seconds counter on a 20-year span
 *                      is noise, and re-rendering it every second for two decades is silly.
 */
export default function Countdown({ target, variant = 'seal', className = '', tone = 'dark' }) {
  const [t, setT] = useState(() => countdown(target))

  useEffect(() => {
    const tick = () => setT(countdown(target))
    tick()
    const every = variant === 'seal' ? 1000 : 30000
    const id = setInterval(tick, every)
    return () => clearInterval(id)
  }, [target, variant])

  const units =
    variant === 'seal'
      ? [
          ['days', t.days],
          ['hrs', t.hours],
          ['min', t.minutes],
          ['sec', t.seconds],
        ]
      : [
          ['years', Math.floor(t.days / 365.2425)],
          ['days', t.days],
        ]

  return (
    <div className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${className}`}>
      {units.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span
            className={`font-mono font-bold tabular-nums leading-none ${
              tone === 'light' ? 'text-paper' : 'text-ink'
            }`}
            style={{ fontSize: variant === 'seal' ? 'clamp(2rem,6vw,3.4rem)' : 'clamp(1.6rem,4vw,2.4rem)' }}
          >
            {value.toLocaleString()}
          </span>
          <span
            className={`mt-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] ${
              tone === 'light' ? 'text-paper/50' : 'text-muted'
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
