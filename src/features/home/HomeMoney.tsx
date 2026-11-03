import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { summarizeMoney } from '../../domain/finance/moneyAccounts'
import type { FinanceData, Id, MoneyAccountKind } from '../../domain/finance/types'
import { MONEY_KINDS } from '../../ui/chartColors'
import type { CalendarDate } from '../../domain/goalTime'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { HiddenChart } from '../../ui/privacy'
import { balanceDatesText } from './balanceDates'
import { Donut } from './Donut'
import { HomeBlockFrame } from './HomeBlock'
import { SavingsByPurpose } from '../money/SavingsByPurpose'

type Props = { data: FinanceData; asOf: CalendarDate; onOpenGoal: (id: Id) => void; onOpenMoney: () => void }

/**
 * Accounts & Savings, in Money & Goals on Home: what money do I have? The latest balances of Daily Spending,
 * Investments and Savings. Savings is then divided by purpose: goals, the
 * emergency fund and what has no purpose yet. The purposes are part of
 * Savings, so they are never added to it again. Debt is never subtracted.
 * For a past month, the balances entered by the end of that month.
 */
export function HomeMoney({ data, asOf, onOpenGoal, onOpenMoney }: Props) {
  // v5.9 opens with Investment chosen.
  const [chosen, setChosen] = useState<MoneyAccountKind>('investment')
  const summary = summarizeMoney(data, asOf)
  const amounts = useBlockAmounts('money', data.space.currency)
  const { money, hidden } = amounts
  const hasOther = data.moneyAccounts.some(account => account.kind === 'other')
  const kinds = summary.byKind.filter(item => item.kind !== 'other' || hasOther)
  const focus = kinds.find(item => item.kind === chosen) ?? kinds[0]
  const missing = (kind: MoneyAccountKind) => summary.items.some(item => item.account.kind === kind && item.balance === null)

  // One line per kind of account (Savings already holds the goals, so they are not added again).
  const summaryText = data.moneyAccounts.length === 0 ? 'No accounts yet'
    : kinds.map(item => `${MONEY_KINDS[item.kind].label} ${money(item.total)}${missing(item.kind) ? ' +?' : ''}`).join(' · ')
  const actions = <button type="button" className="button-small" data-return-key="accounts-link" onClick={onOpenMoney}>Edit Balances <Icon name="arrowRight" size={16} /></button>

  return (
    <HomeBlockFrame block="money" title="Accounts & Savings" period={balanceDatesText(summary.items.map(item => item.asOf), asOf)} summary={summaryText} actions={actions}>
      {data.moneyAccounts.length === 0
        ? <p className="muted-note">No accounts yet. Add them in Money.</p>
        : <>
          {hidden
            ? <HiddenChart amounts={amounts} kind="donut" />
            : <Donut
              segments={kinds.map(item => ({ value: item.total, color: MONEY_KINDS[item.kind].color }))}
              caption={MONEY_KINDS[focus.kind].label}
              value={money(focus.total)}
            />}
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

      <SavingsByPurpose data={data} asOf={asOf} money={money} hidden={hidden} onOpenGoal={onOpenGoal} level={4} />
    </HomeBlockFrame>
  )
}
