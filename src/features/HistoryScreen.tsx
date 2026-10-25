import { usualAmountFor } from '../domain/finance/bills'
import type { FinanceData } from '../domain/finance/types'
import { formatAmount, formatDate, formatYearMonth } from '../ui/format'
import { EFFECT_NAMES } from '../ui/labels'

/**
 * Financial History: only what was recorded, newest first, in four
 * separate lists. Nothing is estimated and no chart is drawn from today's
 * balances.
 */
export function HistoryScreen({ data }: { data: FinanceData }) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const billName = (id: string) => data.bills.find(bill => bill.id === id)
  const accountName = (id: string) => data.debts.find(d => d.id === id)?.name ?? data.moneyAccounts.find(a => a.id === id)?.name ?? 'Deleted account'
  const goalName = (id: string) => data.goals.find(goal => goal.id === id)?.name ?? 'Deleted goal'

  const payments = data.billMonths
    .filter(record => record.paid && billName(record.billId))
    .map(record => {
      const bill = billName(record.billId)!
      const amount = record.amount !== undefined ? record.amount : usualAmountFor(bill, record.month)
      return { key: `${record.billId}:${record.month}`, sort: record.paidOn ?? `${record.month}-00`, bill, record, amount }
    })
    .sort((a, b) => b.sort.localeCompare(a.sort))
  const balances = data.balances.map((snapshot, order) => ({ snapshot, order })).sort((a, b) => b.snapshot.asOf.localeCompare(a.snapshot.asOf) || b.order - a.order)
  const movements = data.goalMovements.map((movement, order) => ({ movement, order })).sort((a, b) => b.movement.date.localeCompare(a.movement.date) || b.order - a.order)
  const openings = data.goals.filter(goal => goal.openingBalance > 0)

  return (
    <div className="tab-screen">
      <h1 className="tab-title">Financial History</h1>
      <p className="muted-note">Only what was recorded, newest first. Nothing here is estimated.</p>

      <section className="block" aria-labelledby="history-payments">
        <h2 id="history-payments" className="section-title">Payment History</h2>
        {payments.length === 0 ? <p className="muted-note">No bills marked as paid yet.</p> : (
          <ul className="line-list">
            {payments.map(({ key, bill, record, amount }) => (
              <li key={key} className="line">
                <span>{bill.name}<small>{formatYearMonth(record.month)} · {record.paidOn ? `Paid on ${formatDate(record.paidOn)}` : 'Paid (date not recorded)'}</small></span>
                <b>{amount === null ? 'Amount not known' : money(amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block" aria-labelledby="history-balances">
        <h2 id="history-balances" className="section-title">Balance History</h2>
        {balances.length === 0 ? <p className="muted-note">No balances entered yet.</p> : (
          <ul className="line-list">
            {balances.map(({ snapshot }) => (
              <li key={snapshot.id} className="line">
                <span>{accountName(snapshot.accountId)}<small>{formatDate(snapshot.asOf)} · {snapshot.source === 'entered' ? 'Entered by you' : 'From a goal movement'}</small></span>
                <b>{money(snapshot.amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block" aria-labelledby="history-goals">
        <h2 id="history-goals" className="section-title">Savings &amp; Goal Activity</h2>
        {movements.length === 0 && openings.length === 0 ? <p className="muted-note">No goal activity yet.</p> : (
          <ul className="line-list">
            {movements.map(({ movement }) => (
              <li key={movement.id} className="line">
                <span>{goalName(movement.goalId)}<small>{formatDate(movement.date)} · {EFFECT_NAMES[movement.effect]}{movement.note ? ` · ${movement.note}` : ''}</small></span>
                <b className={movement.amount >= 0 ? 'amount-in' : ''}>{movement.amount >= 0 ? '+' : '−'}{money(Math.abs(movement.amount))}</b>
              </li>
            ))}
            {openings.map(goal => (
              <li key={`opening-${goal.id}`} className="line">
                <span>{goal.name}<small>{formatDate(goal.createdOn)} · Already saved when it was added</small></span>
                <b>{money(goal.openingBalance)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block" aria-labelledby="history-changes">
        <h2 id="history-changes" className="section-title">Changes to Your Data <span className="badge">Coming later</span></h2>
        <p className="muted-note">Edits to names, dates and amounts are not logged yet. The lists above show payments, balances and goal activity only.</p>
      </section>
    </div>
  )
}
