import { Icon, type IconName } from '../components/Icon'
import type { YearMonth } from '../domain/calendar'
import { evaluateConfirmedGoal, type ConfirmedGoal } from '../domain/goal'
import type { CalendarDate } from '../domain/goalTime'
import { monthlyOverview } from '../domain/finance/overview'
import type { FinanceData } from '../domain/finance/types'
import { formatAmount } from '../ui/format'
import { progressPercent } from '../ui/planStatus'
import { MonthSwitch } from './MonthSwitch'

type Props = {
  data: FinanceData
  months: YearMonth[]
  month: YearMonth
  onMonthChange: (month: YearMonth) => void
  confirmedGoal: ConfirmedGoal | null
  today: CalendarDate
  onOpen: (screen: 'bills' | 'cards' | 'data' | 'goals') => void
}

function SectionCard({ icon, title, text, onOpen, badge }: { icon: IconName; title: string; text: string; onOpen?: () => void; badge?: string }) {
  const body = <>
    <Icon name={icon} />
    <span className="section-card-title">{title}{badge && <span className="badge">{badge}</span>}</span>
    <span className="section-card-text">{text}</span>
  </>
  // A card without an action is plain content, so it is never focusable or announced as a button.
  return onOpen
    ? <button type="button" className="section-card" onClick={onOpen}>{body}</button>
    : <div className="section-card is-unavailable">{body}</div>
}

/**
 * Home, for now: v5.9's Monthly Overview (its first section) plus what My
 * Space offered in Phase 2, until the full v5.9 Home replaces it.
 */
export function HomeScreen({ data, months, month, onMonthChange, confirmedGoal, today, onOpen }: Props) {
  const overview = monthlyOverview(data, month)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const hasIncome = data.income.some(entry => entry.month === month)
  const incomeLabel = data.space.mode === 'individual' ? 'Income' : 'Household Income'
  const progress = confirmedGoal
    ? progressPercent(confirmedGoal.input.targetAmount, evaluateConfirmedGoal(confirmedGoal, today).remainingAmount)
    : 0

  return (
    <div className="tab-screen">
      <h1 className="visually-hidden">Home</h1>
      <MonthSwitch months={months} value={month} onChange={onMonthChange} />
      <section className="stat-grid" aria-label="Monthly Overview">
        <button type="button" className="stat" onClick={() => onOpen('data')}><small>{incomeLabel}</small><b>{hasIncome ? money(overview.householdIncome) : '—'}</b></button>
        <button type="button" className="stat" onClick={() => onOpen('bills')}><small>Monthly Commitments</small><b>{money(overview.monthlyCommitments)}</b></button>
        <button type="button" className="stat" onClick={() => onOpen('bills')}>
          <small>Monthly Left to Pay</small><b>{money(overview.leftToPay)}</b>{overview.unknownBillCount > 0 && <small>+ unknown amount</small>}
        </button>
        <button type="button" className="stat" onClick={() => onOpen('cards')}><small>Total Debt</small><b>{money(overview.totalDebt)}</b></button>
      </section>

      {confirmedGoal && (
        <section className="space-goal" aria-labelledby="space-goal-name">
          <span className="eyebrow-label">Planned goal</span>
          <h2 id="space-goal-name">{confirmedGoal.details.name}</h2>
          <div className="space-progress-head"><span>Progress</span><span>{progress.toFixed(1)}%</span></div>
          <div className="space-progress" role="progressbar" aria-label={`${confirmedGoal.details.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div style={{ width: `${progress}%` }} /></div>
          <button type="button" className="button-secondary" onClick={() => onOpen('goals')}>View goal <Icon name="arrowRight" size={18} /></button>
        </section>
      )}

      <div className="section-grid">
        <SectionCard icon="target" title="Goal Planner" text={confirmedGoal ? 'See or edit your planned goal' : 'Plan a goal step by step'} onOpen={() => onOpen('goals')} />
        <SectionCard icon="assistant" title="Assistant" text="Will explain your numbers in simple words. You always decide." badge="Coming soon" />
      </div>
      <p className="muted-note">More of Home (bills by category, your money, goals and yearly income) arrives in the next version.</p>
    </div>
  )
}
