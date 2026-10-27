import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { summarizeMoney } from '../../domain/finance/moneyAccounts'
import { savingsSummary } from '../../domain/finance/savings'
import type { FinanceData, Id, MoneyAccountKind } from '../../domain/finance/types'
import { sharePercents } from '../../ui/chart'
import { MONEY_KINDS } from '../../ui/chartColors'
import type { CalendarDate } from '../../domain/goalTime'
import { EyeToggle } from '../../ui/privacy'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { balanceDatesText } from './balanceDates'
import { Donut } from './Donut'
import { HomeBlockFrame } from './HomeBlock'

const PURPOSE_COLORS = ['#3b82f6', '#c09662', '#c183a8', '#55a6a4', '#7299c5', '#8874ce']
const EMERGENCY_COLOR = '#55a58f'
const UNASSIGNED_COLOR = 'var(--color-track-strong)'

type Props = { data: FinanceData; title: string; asOf: CalendarDate; onOpenGoal: (id: Id) => void; onOpenData: () => void }

/**
 * What money do I have? The latest balances of Daily Spending,
 * Investments and Savings. Savings is then divided by purpose: goals, the
 * emergency fund and what has no purpose yet. The purposes are part of
 * Savings, so they are never added to it again. Debt is never subtracted.
 * For a past month, the balances entered by the end of that month.
 */
export function HomeMoney({ data, title, asOf, onOpenGoal, onOpenData }: Props) {
  // v5.9 opens with Investment chosen.
  const [chosen, setChosen] = useState<MoneyAccountKind>('investment')
  const summary = summarizeMoney(data, asOf)
  const savings = savingsSummary(data, asOf)
  const { money, hidden } = useBlockAmounts('money', data.space.currency)
  const hasOther = data.moneyAccounts.some(account => account.kind === 'other')
  const kinds = summary.byKind.filter(item => item.kind !== 'other' || hasOther)
  const focus = kinds.find(item => item.kind === chosen) ?? kinds[0]
  const missing = (kind: MoneyAccountKind) => summary.items.some(item => item.account.kind === kind && item.balance === null)

  const parts = [
    ...savings.purposes.map((purpose, index) => ({
      key: purpose.goal.id, name: purpose.goal.name, amount: purpose.saved, goalId: purpose.goal.id,
      color: purpose.goal.kind === 'emergency' ? EMERGENCY_COLOR : PURPOSE_COLORS[index % PURPOSE_COLORS.length],
    })),
    ...(savings.unassigned !== null && savings.unassigned > 0
      ? [{ key: 'unassigned', name: 'Unassigned', amount: savings.unassigned, goalId: null, color: UNASSIGNED_COLOR }] : []),
  ]
  const shares = sharePercents(parts.map(part => part.amount))
  // One line per kind of account (Savings already holds the goals, so they are not added again).
  const summaryText = data.moneyAccounts.length === 0 ? 'No accounts yet'
    : kinds.map(item => `${MONEY_KINDS[item.kind].label} ${money(item.total)}${missing(item.kind) ? ' +?' : ''}`).join(' · ')
  const actions = <>
    <EyeToggle block="money" />
    <button type="button" className="button-small" onClick={onOpenData}>Edit Balances <Icon name="arrowRight" size={16} /></button>
  </>

  return (
    <HomeBlockFrame block="money" title={title} period={balanceDatesText(summary.items.map(item => item.asOf), asOf)} summary={summaryText} actions={actions}>
      {data.moneyAccounts.length === 0
        ? <p className="muted-note">No accounts yet. Add them in Data.</p>
        : <>
          <Donut
            segments={hidden ? [] : kinds.map(item => ({ value: item.total, color: MONEY_KINDS[item.kind].color }))}
            caption={MONEY_KINDS[focus.kind].label}
            value={money(focus.total)}
          />
          <div className={`tiles${kinds.length === 3 ? ' three' : ''}`}>
            {kinds.map(item => (
              <button key={item.kind} type="button" aria-pressed={item === focus} className={item === focus ? 'is-active' : ''} onClick={() => setChosen(item.kind)}>
                <span><i className="owner-dot" style={{ background: MONEY_KINDS[item.kind].color }} aria-hidden="true" />{MONEY_KINDS[item.kind].label}</span>
                <b>{money(item.total)}{missing(item.kind) && ' +?'}</b>
              </button>
            ))}
          </div>
          {summary.missingBalanceCount > 0 && (
            <p className="muted-note">{summary.missingBalanceCount === 1 ? 'One account has' : `${summary.missingBalanceCount} accounts have`} no balance yet, so a total may be higher.</p>
          )}
        </>}

      {(savings.accounts.length > 0 || savings.purposes.length > 0) && (
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
                  ? <button type="button" className="line line-button" onClick={() => onOpenGoal(part.goalId!)}>
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
      )}
    </HomeBlockFrame>
  )
}
