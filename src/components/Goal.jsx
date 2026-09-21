import { GOAL_ENTRIES, NET_PER_ENTRY, goalMet, goalPct } from '../lib/capsule.js'

/**
 * The funding threshold, stated honestly.
 *
 * This is the piece that gives every buyer a reason to recruit the next one: the capsule only
 * happens if enough people join, so participants are not just customers, they are stakeholders in
 * whether it exists at all. The number is not arbitrary and the copy shows the arithmetic, because
 * a threshold nobody believes is worse than no threshold.
 */
export default function Goal({ count }) {
  const n = count ?? 0
  const met = goalMet(n)
  const pct = goalPct(n)
  const remaining = Math.max(0, GOAL_ENTRIES - n)

  return (
    <div className="bg-paper-2 p-7 rounded-sm">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="label">{met ? 'The capsule is funded' : 'The capsule happens at'}</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-mono text-5xl font-bold tabular-nums leading-none">
              {n.toLocaleString()}
            </span>
            <span className="font-mono text-lg text-muted tabular-nums">
              / {GOAL_ENTRIES.toLocaleString()}
            </span>
          </div>
        </div>
        {!met && (
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tabular-nums text-seal">
              {remaining.toLocaleString()}
            </div>
            <div className="label mt-1">still needed</div>
          </div>
        )}
        {met && <span className="stamp">Funded</span>}
      </div>

      <div
        className="mt-6 h-3 w-full bg-paper-3 rounded-sm overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Entries toward the funding goal"
      >
        <div
          className="h-full bg-ink transition-[width] duration-500"
          style={{ width: `${Math.max(pct, n > 0 ? 1.5 : 0)}%` }}
        />
      </div>

      <div className="mt-6 grid gap-3 text-[0.92rem] leading-relaxed text-ink-2">
        <p>
          {GOAL_ENTRIES.toLocaleString()} entries at $2 nets about{' '}
          <strong className="font-semibold">
            ${Math.round(GOAL_ENTRIES * NET_PER_ENTRY).toLocaleString()}
          </strong>{' '}
          after payment processing. That is what it costs to keep the domain registered and the
          archive online until 2047, and to email every participant when it opens.
        </p>
        <p className="text-ink-3">
          {met ? (
            <>The capsule is funded and will be sealed on December 31. Every entry from here adds margin.</>
          ) : (
            <>
              If we do not reach {GOAL_ENTRIES.toLocaleString()} by December 31,{' '}
              <strong className="font-semibold text-ink-2">
                every payment is refunded and nothing is sealed.
              </strong>{' '}
              A twenty-year promise you cannot afford to keep is not worth making.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
