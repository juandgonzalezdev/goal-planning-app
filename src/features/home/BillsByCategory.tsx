import { useState } from 'react'
import type { YearMonth } from '../../domain/calendar'
import { billsByCategory } from '../../domain/finance/home'
import type { BillCategory, FinanceData } from '../../domain/finance/types'
import { CATEGORY_COLORS } from '../../ui/chartColors'
import { formatAmount, formatYearMonth } from '../../ui/format'
import { Donut } from './Donut'

/** Monthly Bills · By Category: the ring, one tile per category, and the bills of the chosen one. */
export function BillsByCategory({ data, month }: { data: FinanceData; month: YearMonth }) {
  const [chosen, setChosen] = useState<BillCategory | null>(null)
  const breakdown = billsByCategory(data, month)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  // A category missing from this month is simply not chosen.
  const focus = breakdown.categories.find(item => item.category === chosen) ?? null

  return (
    <section className="block home-section" aria-labelledby="home-categories">
      <h2 id="home-categories" className="section-title">Monthly Bills · By Category</h2>
      {breakdown.categories.length === 0 && breakdown.unknownCount === 0
        ? <p className="muted-note">No bills for {formatYearMonth(month)}.</p>
        : <>
          <Donut
            segments={breakdown.categories.map(item => ({ value: item.total, color: CATEGORY_COLORS[item.category] }))}
            caption={focus ? focus.category : 'TOTAL MONTHLY'}
            value={money(focus ? focus.total : breakdown.total)}
          />
          <div className="tiles">
            {breakdown.categories.map(item => (
              <button key={item.category} type="button" aria-pressed={focus === item} className={focus === item ? 'is-active' : ''}
                onClick={() => setChosen(focus === item ? null : item.category)}>
                <span><i className="owner-dot" style={{ background: CATEGORY_COLORS[item.category] }} aria-hidden="true" />{item.category}</span>
                <b>{money(item.total)}</b>
              </button>
            ))}
          </div>
          {focus && (
            <ul className="line-list" aria-label={`${focus.category} bills`}>
              {focus.occurrences.map(({ bill, amount }) => (
                <li key={bill.id} className="line"><span>{bill.name}</span><b>{amount === null ? 'Amount needed' : money(amount)}</b></li>
              ))}
            </ul>
          )}
          {breakdown.unknownCount > 0 && (
            <p className="muted-note">
              {breakdown.unknownCount === 1 ? 'One bill has' : `${breakdown.unknownCount} bills have`} no recorded amount for this month.
            </p>
          )}
        </>}
    </section>
  )
}
