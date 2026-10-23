import { useState } from 'react'
import { summarizeMoney } from '../../domain/finance/moneyAccounts'
import type { FinanceData, MoneyAccountKind } from '../../domain/finance/types'
import { MONEY_KINDS } from '../../ui/chartColors'
import { formatAmount } from '../../ui/format'
import { Donut } from './Donut'

/** Our Money: the latest balances by kind. Goals are not added here, and debt is never subtracted. */
export function OurMoney({ data, title }: { data: FinanceData; title: string }) {
  // v5.9 opens with Investment chosen.
  const [chosen, setChosen] = useState<MoneyAccountKind>('investment')
  const summary = summarizeMoney(data)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const hasOther = data.moneyAccounts.some(account => account.kind === 'other')
  const kinds = summary.byKind.filter(item => item.kind !== 'other' || hasOther)
  const focus = kinds.find(item => item.kind === chosen) ?? kinds[0]

  return (
    <section className="block home-section" aria-labelledby="home-money">
      <h2 id="home-money" className="section-title">{title}</h2>
      {data.moneyAccounts.length === 0
        ? <p className="muted-note">No accounts yet.</p>
        : <>
          <Donut
            segments={kinds.map(item => ({ value: item.total, color: MONEY_KINDS[item.kind].color }))}
            caption={MONEY_KINDS[focus.kind].label}
            value={money(focus.total)}
          />
          <div className={`tiles${kinds.length === 3 ? ' three' : ''}`}>
            {kinds.map(item => (
              <button key={item.kind} type="button" aria-pressed={item === focus} className={item === focus ? 'is-active' : ''} onClick={() => setChosen(item.kind)}>
                <span><i className="owner-dot" style={{ background: MONEY_KINDS[item.kind].color }} aria-hidden="true" />{MONEY_KINDS[item.kind].label}</span>
                <b>{money(item.total)}</b>
              </button>
            ))}
          </div>
          {summary.missingBalanceCount > 0 && (
            <p className="muted-note">{summary.missingBalanceCount === 1 ? 'One account has' : `${summary.missingBalanceCount} accounts have`} no balance yet.</p>
          )}
        </>}
    </section>
  )
}
