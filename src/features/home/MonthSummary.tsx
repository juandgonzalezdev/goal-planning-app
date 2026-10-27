import { useId, useState } from 'react'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { monthFunding } from '../../domain/finance/flows'
import { monthIncome } from '../../domain/finance/income'
import { monthResult } from '../../domain/finance/spending'
import type { FinanceData } from '../../domain/finance/types'
import { formatYearMonth, monthName } from '../../ui/format'
import { EyeToggle } from '../../ui/privacy'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { HomeBlockFrame } from './HomeBlock'

type Props = { data: FinanceData; month: YearMonth; today: CalendarDate; onOpenIncome: () => void; onOpenBills: () => void; onOpenHistory: () => void }

/**
 * How is my month? Four numbers, each with one clear meaning:
 * - Income: what was received (and, for a month still going, what is expected).
 * - Planned Bills: the month's obligations, paid or not.
 * - Spent: real spending (paid bills, expenses, loan interest; never a
 *   transfer, a savings movement or the principal of a debt).
 * - Result: income received minus spent.
 * Details explains the result and, for a deficit, how it was covered.
 */
export function MonthSummary({ data, month, today, onOpenIncome, onOpenBills, onOpenHistory }: Props) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const amounts = useBlockAmounts('month', data.space.currency)
  const { money } = amounts
  const r = monthResult(data, month, today)
  const expected = monthIncome(data, month)
  const future = month > today.slice(0, 7)
  const name = monthName(month)
  const funding = open ? monthFunding(data, month, today) : null

  const resultNote = future ? 'Nothing has happened yet'
    : r.result < 0 ? 'Spent more than received' : 'Income minus spent'
  const summary = future ? 'Nothing has happened yet' : `Result ${money(r.result)} · ${resultNote}`
  return (
    <HomeBlockFrame block="month" title="This Month" period={formatYearMonth(month)} summary={summary} actions={<EyeToggle block="month" />}>
      <div className="stat-grid">
        <button type="button" className="stat" onClick={onOpenIncome}>
          <small>Income</small><b>{r.income.entries.length === 0 && expected.expected === 0 ? '—' : money(r.income.total)}</b>
          <small>{expected.expected > 0 ? `Received · ${money(expected.expected)} still expected` : r.income.entries.length === 0 ? 'Nothing received' : 'Received'}</small>
        </button>
        <button type="button" className="stat" onClick={onOpenBills}>
          <small>Planned Bills</small><b>{money(r.planned.knownTotal)}</b>
          <small>{r.planned.unknownCount > 0 ? `+ ${r.planned.unknownCount} unknown ${r.planned.unknownCount === 1 ? 'amount' : 'amounts'}` : `${r.planned.count} ${r.planned.count === 1 ? 'bill' : 'bills'}, paid or not`}</small>
        </button>
        <button type="button" className="stat" onClick={onOpenHistory}>
          <small>Spent</small><b>{money(r.spending.total)}</b>
          <small>Paid bills and spending</small>
        </button>
        <div className={`stat${!future && !amounts.hidden && r.result < 0 ? ' stat-warning' : ''}`}>
          <small>Result</small><b>{future ? '—' : money(r.result)}</b>
          <small>{resultNote}</small>
        </div>
      </div>
      {r.income.extraordinary > 0 && (
        <p className="muted-note">Income includes {money(r.income.extraordinary)} of one-off income. Without it, the result would be {money(r.result - r.income.extraordinary)}.</p>
      )}
      {(r.spending.unknownAmountCount > 0 || r.spending.unsplitLoanPayments.length > 0) && (
        <p className="muted-note">
          {r.spending.unknownAmountCount > 0 && `${r.spending.unknownAmountCount === 1 ? 'One paid bill has' : `${r.spending.unknownAmountCount} paid bills have`} no amount, so Spent may be higher. `}
          {r.spending.unsplitLoanPayments.length > 0 && 'A loan payment has no interest split, so its interest is not in Spent.'}
        </p>
      )}
      <button type="button" className="text-button" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen(!open)}>
        {open ? 'Hide details' : 'How is this worked out?'}
      </button>
      {open && funding && (
        <div id={detailsId} className="explain">
          <p><b>Result</b> = income received − spent. It is not money saved: savings and debt payments are shown below.</p>
          <p><b>Spent</b> counts each cost once: a paid bill, a purchase (with the card when bought, not again when the card is paid) and the interest of a loan payment. Transfers between your accounts, savings and the part of a payment that pays debt back are not spending.</p>
          <p><b>Money in and out of your accounts</b>: {money(r.cashFlow.moneyIn)} in, {money(r.cashFlow.moneyOut)} out (bills, card and loan payments, spending from an account). Card purchases leave your account when you pay the card.</p>
          {!future && <FundingLines funding={funding} money={money} name={name} />}
          <p className="field-help">From the records of {formatYearMonth(month)}. Nothing is estimated.</p>
        </div>
      )}
    </HomeBlockFrame>
  )
}

function FundingLines({ funding, money, name }: { funding: ReturnType<typeof monthFunding>; money: (minor: number) => string; name: string }) {
  const lines: [string, number][] = funding.result < 0
    ? [['From your Savings', -funding.savingsChange], ['From your Everyday money', -funding.everydayChange], ['From Investments', -funding.investmentChange], ['New debt (card or loan)', funding.debtChange]]
    : [['Kept in Savings', funding.savingsChange], ['Kept in your Everyday money', funding.everydayChange], ['Kept in Investments', funding.investmentChange], ['Debt paid back', -funding.debtChange]]
  const shown = lines.filter(([, amount]) => amount !== 0)
  return <>
    <p><b>{funding.result < 0 ? `How ${name}’s deficit was covered` : `Where ${name}’s result went`}</b></p>
    <ul className="line-list" aria-label={funding.result < 0 ? 'How the deficit was covered' : 'Where the result went'}>
      {shown.map(([label, amount]) => <li key={label} className="line"><span>{label}</span><b>{money(amount)}</b></li>)}
      {funding.notExplained !== 0 && <li className="line"><span>Not explained by the records<small>Income or spending without an account, or savings recorded without a source</small></span><b>{money(funding.result < 0 ? -funding.notExplained : funding.notExplained)}</b></li>}
    </ul>
    <p className="field-help">The lines add up to the {funding.result < 0 ? 'deficit' : 'result'}. A negative line went the other way (for example, money taken from Savings in a month with a positive result).</p>
  </>
}
