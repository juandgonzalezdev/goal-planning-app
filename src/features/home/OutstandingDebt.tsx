import { summarizeDebts } from '../../domain/finance/debts'
import type { FinanceData } from '../../domain/finance/types'
import { formatAmount } from '../../ui/format'

/** What is still owed on each card and loan, as entered (loan installments are not debt). */
export function OutstandingDebt({ data }: { data: FinanceData }) {
  const { items } = summarizeDebts(data)
  return (
    <section className="block home-section" aria-labelledby="home-debt">
      <h2 id="home-debt" className="section-title">Outstanding Debt</h2>
      {items.length === 0
        ? <p className="muted-note">No cards or loans yet.</p>
        : <ul className="line-list">
          {items.map(({ debt, balance }) => (
            <li key={debt.id} className="line">
              <span>{debt.name}</span>
              <b>{balance === null ? 'Balance needed' : formatAmount(balance, data.space.currency)}</b>
            </li>
          ))}
        </ul>}
    </section>
  )
}
