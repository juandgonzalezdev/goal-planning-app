import type { GoalProgress } from '../../domain/finance/goals'
import type { CurrencyCode } from '../../domain/money'
import { formatAmount, formatMonths } from '../../ui/format'

const weeks = (count: number) => `${count} ${count === 1 ? 'week' : 'weeks'}`

/** "To Reach Your Goal": a suggested weekly or monthly amount. Suggestions only; nothing is paid. */
export function GoalPace({ progress, currency }: { progress: GoalProgress; currency: CurrencyCode }) {
  const { pace } = progress
  if (pace.status === 'no-deadline' || pace.status === 'reached') return null
  const money = (minor: number) => formatAmount(minor, currency)
  return (
    <section className="block" aria-labelledby="goal-pace">
      <h2 id="goal-pace" className="section-title">To Reach Your Goal</h2>
      {pace.status === 'deadline-passed'
        ? <p className="muted-note">The target date has passed. You can change it in Edit Goal.</p>
        : <>
          {pace.weekly && <p className="pace-line"><b>{money(pace.weekly.amount)}</b> per week <small>for {weeks(pace.weekly.opportunities)}</small></p>}
          {pace.monthly && <p className="pace-line"><b>{money(pace.monthly.amount)}</b> per month <small>for {formatMonths(pace.monthly.opportunities)}</small></p>}
          {!pace.weekly && !pace.monthly && <p className="muted-note">Less than a week is left. You still need {money(progress.remaining)}.</p>}
        </>}
      <p className="muted-note">Suggestions, not payments. Nothing is paid automatically.</p>
    </section>
  )
}
