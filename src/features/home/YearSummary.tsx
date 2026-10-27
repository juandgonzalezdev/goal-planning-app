import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { yearlyIncome } from '../../domain/finance/income'
import { yearSummary } from '../../domain/finance/year'
import { EUROSTAT_OVERBURDEN_PERCENT, housingShare } from '../../domain/finance/indicators'
import type { FinanceData } from '../../domain/finance/types'
import { barPercent } from '../../ui/chart'
import { formatYearMonth } from '../../ui/format'
import { EyeToggle } from '../../ui/privacy'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { HomeBlockFrame } from './HomeBlock'

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Props = { data: FinanceData; year: number; today: CalendarDate; month: YearMonth; onSelectMonth: (month: YearMonth) => void }

/**
 * Year Summary, last on Home: income received, money spent and the
 * result of each month of the year, from the records. Savings and debt at
 * the end of each month come from the balances entered by then. Months
 * after today show nothing: they have not happened. A month opens on Home.
 * Everything shows when the block is open; closed, it keeps the year's result.
 */
export function YearSummary({ data, year, today, month, onSelectMonth }: Props) {
  const summary = yearSummary(data, year, today)
  const { money, hidden, percent } = useBlockAmounts('year', data.space.currency)
  const members = data.space.members
  const income = members.length > 1 ? yearlyIncome(data, year) : null
  const largest = Math.max(0, ...summary.months.map(row => Math.abs(row.result)))
  const started = summary.months.filter(row => row.started).length

  const summaryText = started === 0 ? `Nothing has happened in ${year} yet` : `Result for ${year}: ${money(summary.result)}`
  return (
    <HomeBlockFrame block="year" title="Year Summary" period={`${year} · ${started} of 12 months so far`} summary={summaryText} actions={<EyeToggle block="year" />}>
      <dl className="year-stats">
        <div><dt>Income in {year}</dt><dd>{money(summary.income)}</dd></div>
        <div><dt>Spent in {year}</dt><dd>{money(summary.spending)}</dd></div>
        <div className={summary.result < 0 ? 'stat-warning' : ''}><dt>Result for {year}</dt><dd>{money(summary.result)}</dd></div>
      </dl>
      {summary.extraordinaryIncome > 0 && <p className="muted-note">Includes {money(summary.extraordinaryIncome)} of one-off income.</p>}
      {summary.deficitMonths.length > 0 && (
        <p className="muted-note">Spending was higher than income in {summary.deficitMonths.map(m => SHORT_MONTHS[Number(m.slice(5, 7)) - 1]).join(', ')}. Open a month to see how it was covered.</p>
      )}
      <div className="year-details">
        <ul className="month-bars" aria-label={`Result by month in ${year}`}>
          {summary.months.map((row, index) => (
            <li key={row.month}>
              <button type="button" className={`monthly-row result-row${row.month === month ? ' is-active' : ''}`} disabled={!row.started}
                aria-label={`${formatYearMonth(row.month)}: ${row.started ? `result ${hidden ? 'amount hidden' : money(row.result)}` : 'not started yet'}. Open on Home`}
                onClick={() => onSelectMonth(row.month)}>
                <span>{SHORT_MONTHS[index]}</span>
                <span className="bar result-bar" aria-hidden="true">
                  {row.started && <span className={row.result < 0 ? 'is-negative' : 'is-positive'}
                    style={{ width: `${hidden ? 50 : barPercent(Math.abs(row.result), largest) / 2}%` }} />}
                </span>
                <small>{row.started ? money(row.result) : '—'}</small>
              </button>
            </li>
          ))}
        </ul>
        <p className="field-help">Result = income received − money spent. Bars to the right are months with money left over; to the left, months that needed savings or credit.</p>
        <table className="year-table">
          <caption className="visually-hidden">Savings and debt at the end of each month</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Savings</th><th scope="col">Debt</th></tr></thead>
          <tbody>
            {summary.months.filter(row => row.started).map(row => (
              <tr key={row.month}>
                <th scope="row">{SHORT_MONTHS[Number(row.month.slice(5, 7)) - 1]}</th>
                <td>{row.savingsAtEnd === null ? 'Not known' : money(row.savingsAtEnd)}</td>
                <td>{money(row.debtAtEnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ReferenceNotes data={data} months={summary.months.filter(row => row.started).map(row => row.month)} today={today} money={money} percent={percent} />
        {income && (
          <ul className="line-list" aria-label="Income by person">
            {members.map(member => (
              <li key={member.id} className="line"><span><i className="owner-dot" style={{ background: member.color }} aria-hidden="true" />{member.name}</span><b>{money(income.byMember[member.id] ?? 0)}</b></li>
            ))}
          </ul>
        )}
      </div>
    </HomeBlockFrame>
  )
}

/** Optional notes with their source, formula and period. None of them is a limit or advice. */
function ReferenceNotes({ data, months, today, money, percent }: {
  data: FinanceData; months: YearMonth[]; today: CalendarDate; money: (minor: number) => string; percent: (value: string) => string
}) {
  if (months.length === 0) return null
  const share = housingShare(data, months, today)
  const period = months.length === 1 ? formatYearMonth(months[0]) : `${formatYearMonth(months[0])} – ${formatYearMonth(months[months.length - 1])}`
  return (
    <details className="explain">
      <summary>Reference Notes</summary>
      <h3 className="section-title">Housing costs and income</h3>
      {share.status === 'ok' && <p>Housing and utilities were {percent(`${share.percent.toLocaleString('en-GB')}%`)} of the net income you received ({money(share.housing)} of {money(share.income)}, {period}).</p>}
      {share.status === 'no-income' && <p>No percentage: no income was received in {period}, so a share would mean nothing.</p>}
      {share.status === 'incomplete' && <p>No percentage: a housing or utilities bill has no amount yet in {period}.</p>}
      <p className="field-help">
        Formula: rent and housing bills plus utilities paid, divided by net income received, over the same months. Eurostat counts people whose housing
        costs take more than {EUROSTAT_OVERBURDEN_PERCENT}% of their household’s disposable income as living with a housing cost overburden (EU-SILC
        statistics). That is a measure of difficulty, not a spending limit, and there is no universal right share. Net income here is not exactly
        disposable income: housing allowances are not recorded separately.
      </p>
      <h3 className="section-title">50/30/20</h3>
      <p className="field-help">
        Some budgets split net income into about 50% needs, 30% wants and 20% savings (from the book All Your Worth, 2005). It is a rough guideline,
        not a rule, and the app does not grade you against it.
      </p>
    </details>
  )
}
