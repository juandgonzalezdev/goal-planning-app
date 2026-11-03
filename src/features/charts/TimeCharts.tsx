import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { LineChart, type ChartLine, type ChartPoint } from '../../components/LineChart'
import { addMonthsToYearMonth, daysBetween, yearMonthOf, type YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { debtSeries, goalSteps, knownRuns, monthsUpTo, payoffPath, savingsSeries } from '../../domain/finance/series'
import type { FinanceData, Goal, Id } from '../../domain/finance/types'
import { formatDate, formatShortYearMonth, formatYearMonth } from '../../ui/format'
import { EFFECT_NAMES } from '../../ui/labels'

/**
 * Three of the four charts of Rumbo de diseño §7 (the fourth, Income &
 * Spending, is History's Year Overview): Savings over time in Money,
 * Saved over time on a goal and Remaining Balance over time on a card or
 * loan. Each draws only records; with fewer than two there is no line,
 * only the figure or what to do first.
 */

/** How many months Savings and Remaining Balance look back, this month included. */
export const CHART_MONTHS = 12
/** How far the Remaining Balance estimate is drawn, at most. */
export const ESTIMATE_MONTHS = 12

type Money = (minor: number) => string

/** Labels under a monthly chart: the first month, the middle one and the last. */
const monthLabels = (months: readonly YearMonth[]) => {
  const last = months.length - 1
  const at = last > 1 ? [0, Math.round(last / 2), last] : [0, last]
  return [...new Set(at)].map(index => ({ x: last ? index / last : 0.5, text: formatShortYearMonth(months[index]) }))
}
/** Empty stretches of a monthly chart: between two runs of records. */
const monthGaps = (runs: number[][], last: number) => runs.slice(1).map((run, index) => ({ from: runs[index][runs[index].length - 1] / last, to: run[0] / last }))
const xOf = (index: number, last: number) => (last ? index / last : 0.5)

/** Savings over time, in Money › Accounts & Savings. */
export function SavingsOverTime({ data, today, money }: { data: FinanceData; today: CalendarDate; money: Money }) {
  const months = monthsUpTo(today, CHART_MONTHS)
  const series = savingsSeries(data, months, today)
  const recorded = series.flatMap((point, index) => (point.total === null ? [] : [{ ...point, total: point.total, index }]))
  const [selected, setSelected] = useState<string | null>(null)
  const hasSavings = data.moneyAccounts.some(account => account.kind === 'savings')
  const last = months.length - 1

  let body
  if (recorded.length === 0) {
    body = hasSavings
      ? <p className="muted-note">Update your savings balances in Money once a month to see how they change. No savings balance was entered in the last {CHART_MONTHS} months.</p>
      : <p className="muted-note">Add a savings account with its balance (Add Account, above). Update it once a month to see how it changes.</p>
  } else if (recorded.length === 1) {
    const only = recorded[0]
    body = <p className="pace-line"><b>{money(only.total)}</b> at the end of {formatYearMonth(only.month)}. Update your balance next month to see how it changes.</p>
  } else {
    const runs = knownRuns(series.map(point => point.total))
    const points: ChartPoint[] = recorded.map(point => ({
      key: point.month, x: xOf(point.index, last), value: point.total, label: `${formatYearMonth(point.month)}: ${money(point.total)}`,
    }))
    const lines: ChartLine[] = runs.map(run => ({ style: 'record', points: run.map(index => ({ x: xOf(index, last), value: series[index].total! })) }))
    const chosen = series.find(point => point.month === (selected ?? recorded[recorded.length - 1].month))!
    body = (
      <LineChart name={`Savings over time, ${formatYearMonth(months[0])} to ${formatYearMonth(months[last])}`} lines={lines} points={points} gaps={monthGaps(runs, last)}
        xLabels={monthLabels(months)} money={money} legend={[{ style: 'record', text: 'Savings at the end of the month' }]}
        selected={chosen.month} onSelect={setSelected}
        detail={<>
          <p><b>{formatYearMonth(chosen.month)}</b>: {money(chosen.total!)} in savings</p>
          <p className="field-help">Balances entered: {chosen.entered.map(item => `${item.account.name} (${formatDate(item.snapshot.asOf)})`).join(', ')}.</p>
        </>}
        table={{
          head: ['Month', 'Savings', 'Balances entered'],
          rows: series.map(point => ({ key: point.month, cells: [formatYearMonth(point.month), point.total === null ? 'Not entered' : money(point.total), point.entered.map(item => item.account.name).join(', ') || '—'] })),
        }} />
    )
  }
  return (
    <section className="chart-section" aria-labelledby="savings-chart-title">
      <h3 id="savings-chart-title" className="section-title">Savings over time</h3>
      <p className="field-help">Only months with a savings balance entered have a point. Goals are part of these savings, not extra money.</p>
      {body}
    </section>
  )
}

/** Saved over time, on a goal's screen. Choosing a step can show its record in Savings Activity. */
export function GoalSavedOverTime({ data, goal, today, money, onShowRecord, onAddContribution }: {
  data: FinanceData; goal: Goal; today: CalendarDate; money: Money; onShowRecord: (key: string) => void; onAddContribution: () => void
}) {
  const steps = goalSteps(goal, data.goalMovements)
  const [selected, setSelected] = useState<string | null>(null)
  let body
  if (steps.length === 0) {
    body = <div className="empty-state">
      <p className="muted-note">No contributions yet. Add one when you set money aside for this goal.</p>
      <button type="button" className="button-small align-start" onClick={onAddContribution}><Icon name="plus" size={16} /> Add Contribution</button>
    </div>
  } else if (steps.length === 1) {
    body = <p className="pace-line"><b>{money(steps[0].saved)}</b> since {formatDate(steps[0].date)}. Each Contribution or Withdrawal adds a step here.</p>
  } else {
    const start = steps[0].date
    const end = [today, steps[steps.length - 1].date, ...(goal.deadline && goal.target !== null ? [goal.deadline] : [])].sort().pop()!
    const total = Math.max(daysBetween(start, end), 1)
    const xAt = (date: CalendarDate) => daysBetween(start, date) / total
    const points: ChartPoint[] = steps.map(step => ({
      key: step.key, x: xAt(step.date), value: step.saved,
      label: `${formatDate(step.date)}: ${step.movement ? `${EFFECT_NAMES[step.movement.effect]} ${step.amount >= 0 ? '+' : '−'}${money(Math.abs(step.amount))}` : 'Already saved when it was added'}, saved ${money(step.saved)}`,
    }))
    const lastSaved = steps[steps.length - 1].saved
    const recordEnd = today > steps[steps.length - 1].date ? today : steps[steps.length - 1].date
    const lines: ChartLine[] = [{ style: 'record', step: true, points: [...points, { x: xAt(recordEnd), value: lastSaved }] }]
    const chosen = steps.find(step => step.key === selected) ?? steps[steps.length - 1]
    body = (
      <LineChart name={`${goal.name}: saved over time`} lines={lines} points={points}
        level={goal.target !== null ? { value: goal.target, label: `Target ${money(goal.target)}` } : null}
        mark={goal.deadline && goal.target !== null ? { x: xAt(goal.deadline), label: `Target date ${formatDate(goal.deadline)}` } : null}
        xLabels={[{ x: 0, text: formatDate(start) }, { x: 1, text: formatDate(end) }]} money={money}
        legend={[{ style: 'record', text: 'Saved' }, ...(goal.target !== null ? [{ style: 'level' as const, text: 'Target' }] : [])]}
        selected={chosen.key} onSelect={setSelected}
        detail={<>
          <p><b>{formatDate(chosen.date)}</b>: {chosen.movement ? `${EFFECT_NAMES[chosen.movement.effect]} ${chosen.amount >= 0 ? '+' : '−'}${money(Math.abs(chosen.amount))}` : `Already saved when it was added: ${money(chosen.amount)}`}. Saved after it: {money(chosen.saved)}.</p>
          <button type="button" className="text-button" onClick={() => onShowRecord(chosen.key)}>Show in Savings Activity</button>
        </>}
        table={{
          head: ['Date', 'Change', 'Saved'],
          rows: steps.map(step => ({ key: step.key, cells: [formatDate(step.date), step.movement ? `${EFFECT_NAMES[step.movement.effect]} ${step.amount >= 0 ? '+' : '−'}${money(Math.abs(step.amount))}` : `Already saved ${money(step.amount)}`, money(step.saved)] })),
        }} />
    )
  }
  return (
    <section className="block chart-section" aria-labelledby="goal-chart-title">
      <h2 id="goal-chart-title" className="section-title">Saved over time</h2>
      {body}
    </section>
  )
}

/**
 * Remaining Balance over time, on a card or loan. The balances entered are
 * the solid line; the estimate, drawn from the latest balance with the
 * planned payment, is dashed and says so.
 */
export function DebtBalanceOverTime({ data, debtId, today, money, plannedPayment, yearlyInterestBasisPoints, onShowRecord, onUpdateBalance }: {
  data: FinanceData; debtId: Id; today: CalendarDate; money: Money; plannedPayment: number | null; yearlyInterestBasisPoints: number
  onShowRecord: (snapshotId: Id) => void; onUpdateBalance: () => void
}) {
  const history = monthsUpTo(today, CHART_MONTHS)
  const series = debtSeries(data.balances, debtId, history)
  const recorded = series.flatMap((point, index) => (point.snapshot ? [{ month: point.month, snapshot: point.snapshot, index }] : []))
  const [selected, setSelected] = useState<string | null>(null)
  let body
  if (recorded.length === 0) {
    body = <div className="empty-state">
      <p className="muted-note">Enter the balance from your statement. Each update adds a point here.</p>
      <button type="button" className="button-small align-start" onClick={onUpdateBalance}>Update Balance</button>
    </div>
  } else if (recorded.length === 1) {
    const only = recorded[0].snapshot
    body = <p className="pace-line"><b>{money(only.amount)}</b> on {formatDate(only.asOf)}. Each balance you enter adds a point here.</p>
  } else {
    const latest = recorded[recorded.length - 1]
    // The estimate starts at the latest balance, the month after it, only when it is this month's or last month's.
    const startsFresh = latest.month >= addMonthsToYearMonth(yearMonthOf(today), -1)
    const path = startsFresh && plannedPayment ? payoffPath(latest.snapshot.amount, yearlyInterestBasisPoints, plannedPayment, ESTIMATE_MONTHS) : []
    const pathMonths = path.map((_, index) => addMonthsToYearMonth(latest.month, index + 1))
    // The months along the chart: the last 12, then the months of the estimate after them.
    const axis = [...history, ...pathMonths.filter(month => month > history[history.length - 1])]
    const lastIndex = axis.length - 1
    const runs = knownRuns(series.map(point => point.snapshot?.amount ?? null))
    const lines: ChartLine[] = [
      ...runs.map(run => ({ style: 'record' as const, points: run.map(index => ({ x: xOf(index, lastIndex), value: series[index].snapshot!.amount })) })),
      ...(path.length ? [{ style: 'estimate' as const, points: [{ x: xOf(latest.index, lastIndex), value: latest.snapshot.amount }, ...path.map((value, index) => ({ x: xOf(axis.indexOf(pathMonths[index]), lastIndex), value }))] }] : []),
    ]
    const points: ChartPoint[] = recorded.map(point => ({
      key: point.snapshot.id, x: xOf(point.index, lastIndex), value: point.snapshot.amount, label: `${formatDate(point.snapshot.asOf)}: ${money(point.snapshot.amount)}`,
    }))
    const chosen = recorded.find(point => point.snapshot.id === selected) ?? latest
    body = <>
      <LineChart name="Remaining Balance over time" lines={lines} points={points} gaps={monthGaps(runs, lastIndex)}
        xLabels={monthLabels(axis)} money={money}
        legend={[{ style: 'record', text: 'Balance entered' }, ...(path.length ? [{ style: 'estimate' as const, text: `Estimate if you pay ${money(plannedPayment!)} a month` }] : [])]}
        selected={chosen.snapshot.id} onSelect={setSelected}
        detail={<>
          <p><b>Balance · {formatDate(chosen.snapshot.asOf)}</b>: {money(chosen.snapshot.amount)} ({chosen.snapshot.source === 'entered' ? 'Entered' : 'From a goal movement'})</p>
          <button type="button" className="text-button" onClick={() => onShowRecord(chosen.snapshot.id)}>Show in Balance History</button>
        </>}
        table={{
          head: ['Month', 'Remaining Balance', 'Kind'],
          rows: [
            ...series.map(point => ({ key: point.month, cells: [formatYearMonth(point.month), point.snapshot ? money(point.snapshot.amount) : 'Not entered', point.snapshot ? `Entered on ${formatDate(point.snapshot.asOf)}` : '—'] })),
            ...path.map((value, index) => ({ key: `estimate-${pathMonths[index]}`, cells: [formatYearMonth(pathMonths[index]), money(value), 'Estimate'] })),
          ],
        }} />
      {path.length > 0 && <p className="field-help">The dashed line is an estimate from the balance of {formatDate(latest.snapshot.asOf)}, paying {money(plannedPayment!)} every month with the same interest{path[path.length - 1] > 0 ? `, for the next ${ESTIMATE_MONTHS} months` : ''}. It is not a record.</p>}
    </>
  }
  return (
    <section className="block chart-section" aria-labelledby="debt-chart-title">
      <h2 id="debt-chart-title" className="section-title">Remaining Balance over time</h2>
      {body}
    </section>
  )
}
