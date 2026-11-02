import { useState } from 'react'
import { todayString } from '../../app/today'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import type { FinanceData } from '../../domain/finance/types'
import { buildReport, type ReportPeriod } from '../../report/report'
import { formatYearMonth } from '../../ui/format'

type Props = { data: FinanceData; isDemo: boolean; months: YearMonth[]; month: YearMonth; today: CalendarDate; getGeneratedOn?: () => CalendarDate }

/**
 * Export Report: a PDF of a month or a year, to read, print or share. It
 * is a report, not a copy that can be restored (Data Backup is), and it
 * is never a bank statement. Whether it includes amounts is chosen here,
 * whatever Home shows, and the report says so on its first page.
 */
export function ReportSection({ data, isDemo, months, month, today, getGeneratedOn = todayString }: Props) {
  const started = months.filter(m => m <= today.slice(0, 7))
  const [kind, setKind] = useState<'month' | 'year'>('month')
  const [chosen, setChosen] = useState<YearMonth>(started.includes(month) ? month : started[started.length - 1] ?? month)
  const [includeAmounts, setIncludeAmounts] = useState(true)
  const [message, setMessage] = useState('')
  const year = Number(chosen.slice(0, 4))

  const download = () => {
    const period: ReportPeriod = kind === 'month' ? { kind: 'month', month: chosen } : { kind: 'year', year }
    const pdf = buildReport(data, { period, today, generatedOn: getGeneratedOn(), includeAmounts, isDemo })
    const blob = new Blob([pdf.toBytes() as BlobPart], { type: 'application/pdf' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `financial-report-${kind === 'month' ? chosen : year}${includeAmounts ? '' : '-no-amounts'}.pdf`
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage(`Report for ${kind === 'month' ? formatYearMonth(chosen) : year} downloaded ${includeAmounts ? 'with' : 'without'} amounts.`)
  }

  return (
    <section className="sub-block" aria-labelledby="data-report">
      <h3 id="data-report" className="section-title">Export Report</h3>
      <p className="field-help">A PDF summary to read or print: income, spending by category, pending payments, debts, accounts, savings and goals, and what is missing. It is not a backup and not a bank statement.</p>
      <div className="segmented" role="group" aria-label="Report period">
        {(['month', 'year'] as const).map(option => (
          <button key={option} type="button" aria-pressed={kind === option} className={kind === option ? 'is-active' : ''} onClick={() => setKind(option)}>
            {option === 'month' ? 'One Month' : 'Whole Year'}
          </button>
        ))}
      </div>
      {kind === 'month' && (
        <div className="form-field">
          <label htmlFor="report-month">Month</label>
          <select id="report-month" value={chosen} onChange={e => setChosen(e.target.value)}>
            {started.map(m => <option key={m} value={m}>{formatYearMonth(m)}</option>)}
          </select>
        </div>
      )}
      {kind === 'year' && <p className="muted-note">{year}, the months up to {formatYearMonth(started[started.length - 1] ?? chosen)}.</p>}
      <label className="check-row" htmlFor="report-amounts">
        <input id="report-amounts" type="checkbox" checked={includeAmounts} onChange={e => setIncludeAmounts(e.target.checked)} />
        <span>Include amounts<small>{includeAmounts
          ? 'The report shows every amount, even if they are hidden on Home.'
          : 'Every amount is replaced by •••• and the report says so on its first page.'}</small></span>
      </label>
      <button type="button" className="button-secondary" disabled={started.length === 0} onClick={download}>Download PDF</button>
      <p className="muted-note" role="status">{message}</p>
    </section>
  )
}
