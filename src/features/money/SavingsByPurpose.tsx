import { Icon } from '../../components/Icon'
import { savingsSummary } from '../../domain/finance/savings'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { sharePercents } from '../../ui/chart'

const PURPOSE_COLORS = ['#3b82f6', '#c09662', '#c183a8', '#55a6a4', '#7299c5', '#8874ce']
const EMERGENCY_COLOR = '#55a58f'
const UNASSIGNED_COLOR = 'var(--color-track-strong)'

type Props = {
  data: FinanceData
  /** Balances entered up to this day. */
  asOf: CalendarDate
  /** How an amount is written (Home passes its block's, which may hide it). */
  money: (minor: number) => string
  /** Amounts hidden: the bar is not drawn either. */
  hidden: boolean
  onOpenGoal: (id: Id) => void
}

/**
 * Savings divided by purpose: each goal, the Emergency Fund and what has
 * no purpose yet. The purposes are part of Savings, so they are never
 * added to it again. The same on Home and in Money.
 */
export function SavingsByPurpose({ data, asOf, money, hidden, onOpenGoal }: Props) {
  const savings = savingsSummary(data, asOf)
  const parts = [
    ...savings.purposes.map((purpose, index) => ({
      key: purpose.goal.id, name: purpose.goal.name, amount: purpose.saved, goalId: purpose.goal.id,
      color: purpose.goal.kind === 'emergency' ? EMERGENCY_COLOR : PURPOSE_COLORS[index % PURPOSE_COLORS.length],
    })),
    ...(savings.unassigned !== null && savings.unassigned > 0
      ? [{ key: 'unassigned', name: 'Unassigned', amount: savings.unassigned, goalId: null, color: UNASSIGNED_COLOR }] : []),
  ]
  const shares = sharePercents(parts.map(part => part.amount))
  if (savings.accounts.length === 0 && savings.purposes.length === 0) return null

  return (
    <div className="savings-split" aria-label="Savings by purpose" role="group">
      <h3 className="section-title">Savings</h3>
      <p className="muted-note">Your savings are divided by purpose.</p>
      {parts.length > 0 && !hidden && (
        <div className="bar stacked" aria-hidden="true">
          {parts.map((part, index) => <span key={part.key} style={{ width: `${shares[index]}%`, background: part.color }} />)}
        </div>
      )}
      <ul className="line-list">
        {parts.map(part => (
          <li key={part.key}>
            {part.goalId
              ? <button type="button" className="line line-button" data-return-key={`goal-${part.goalId}`} onClick={() => onOpenGoal(part.goalId!)}>
                <span><i className="owner-dot" style={{ background: part.color }} aria-hidden="true" />{part.name}</span><b>{money(part.amount)}</b><Icon name="arrowRight" size={16} />
              </button>
              : <div className="line"><span><i className="owner-dot" style={{ background: part.color }} aria-hidden="true" />{part.name}</span><b>{money(part.amount)}</b></div>}
          </li>
        ))}
        <li className="line total-line"><span>Savings</span><b>{savings.total === null ? 'Not known' : money(savings.total)}</b></li>
      </ul>
      {savings.total === null && (
        <p className="muted-note">{savings.accounts.length === 0
          ? 'No savings account is entered, so Savings is not known. The amounts above are what your goals hold.'
          : 'A savings balance is missing, so Savings and Unassigned are not known.'}</p>
      )}
      {savings.unassigned !== null && savings.unassigned < 0 && (
        <p className="callout callout-warning" role="alert">
          Your purposes hold {money(-savings.unassigned)} more than your savings accounts. Update a balance or move money out of a goal.
        </p>
      )}
      <p className="field-help">Goals and the Emergency Fund are part of Savings, not extra money.</p>
    </div>
  )
}
