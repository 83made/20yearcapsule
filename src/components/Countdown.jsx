import { useEffect, useState } from 'react'
import { countdown } from '../lib/capsule.js'

/**
 * Two very different jobs, same component.
 *
 *  - variant="seal"  — the deadline. Four units that ADD UP to one duration: 100 days, 16 hours,
 *                      44 minutes, 51 seconds. Ticks every second, because urgency is the point.
 *
 *  - variant="open"  — twenty years out, expressed two ways. These are ALTERNATIVES, not parts of
 *                      a sum, so they cannot be laid out like the deadline: side by side they read
 *                      as "20 years and 7,405 days", which is nonsense. One headline figure with
 *                      the other as an explicit "or" underneath. Ticks every half minute; a seconds
 *                      counter on a 20-year span is noise.
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

  const big = tone === 'light' ? 'text-paper' : 'text-ink'
  const small = tone === 'light' ? 'text-paper/50' : 'text-muted'

  if (variant === 'open') {
    const years = Math.floor(t.days / 365.2425)
    return (
      <div className={className}>
        <div className="flex items-baseline gap-2.5">
          <span
            className={`font-mono font-bold tabular-nums leading-none ${big}`}
            style={{ fontSize: 'clamp(2rem,6vw,3.4rem)' }}
          >
            {years}
          </span>
          <span
            className={`font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] ${small}`}
          >
            {years === 1 ? 'year' : 'years'}
          </span>
        </div>
        <div className={`mt-2 font-mono text-[0.78rem] tabular-nums ${small}`}>
          or {t.days.toLocaleString()} days
        </div>
      </div>
    )
  }

  const units = [
    ['days', t.days],
    ['hrs', t.hours],
    ['min', t.minutes],
    ['sec', t.seconds],
  ]

  return (
    <div className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${className}`}>
      {units.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span
            className={`font-mono font-bold tabular-nums leading-none ${big}`}
            style={{ fontSize: 'clamp(2rem,6vw,3.4rem)' }}
          >
            {value.toLocaleString()}
          </span>
          <span
            className={`mt-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] ${small}`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
