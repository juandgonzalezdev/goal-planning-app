import { describe, expect, it } from 'vitest'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../../data/fixtures/demoAlex'
import { estimateDebtPayoff } from './debts'
import { goalSaved } from './pots'
import { debtSeries, goalSteps, incomeSpendingByMonth, knownRuns, monthsUpTo, payoffPath, savingsSeries } from './series'
import type { FinanceData } from './types'

// The series behind the four charts (Rumbo de diseño §7): records only, a
// month with nothing entered stays empty, and estimates are kept apart.
const demo = createAlexDemo()
const withoutBalance = (data: FinanceData, accountId: string, asOf: string): FinanceData =>
  ({ ...data, balances: data.balances.filter(snapshot => !(snapshot.accountId === accountId && snapshot.asOf === asOf)) })

describe('months and runs', () => {
  it('counts back from the month of today, across a year', () => {
    expect(monthsUpTo('2026-03-15', 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03'])
  })

  it('splits values into runs at every empty month, so a line never crosses one', () => {
    expect(knownRuns([1, 2, null, 3, null, null, 4, 5])).toEqual([[0, 1], [3], [6, 7]])
    expect(knownRuns([null, null])).toEqual([])
  })
})

describe('Savings over time', () => {
  it('has a point for each month with a savings balance entered, with the total Money shows', () => {
    const series = savingsSeries(demo, monthsUpTo(ALEX_DEMO_TODAY, 12), ALEX_DEMO_TODAY)
    expect(series.map(point => point.total)).toEqual([350_000, 370_000, 405_000, 435_000, 525_000, 550_000, 400_000, 250_000, 170_000, 200_000, 245_000, 290_000])
    expect(series[11].entered.map(item => item.account.name)).toEqual(['Savings Account', 'Piggy Bank'])
  })

  it('leaves a month with no balance entered empty, instead of carrying the last balance over', () => {
    const series = savingsSeries(withoutBalance(demo, 'savings-account', '2026-03-31'), monthsUpTo(ALEX_DEMO_TODAY, 12), ALEX_DEMO_TODAY)
    expect(series[2]).toMatchObject({ month: '2026-03', total: null, entered: [] })
    expect(knownRuns(series.map(point => point.total))).toEqual([[0, 1], [3, 4, 5, 6, 7, 8, 9, 10, 11]])
  })

  it('has no point after today', () => {
    expect(savingsSeries(demo, ['2026-12', '2027-01'], ALEX_DEMO_TODAY)[1].total).toBeNull()
  })
})

describe('Remaining Balance over time', () => {
  it('takes the last balance entered in each month, and nothing in a month without one', () => {
    const data = withoutBalance(demo, 'student-loan', '2026-06-30')
    const series = debtSeries(data.balances, 'student-loan', ['2026-05', '2026-06', '2026-07'])
    expect(series.map(point => point.snapshot?.amount ?? null)).toEqual([1_124_950, null, 1_078_661])
  })

  it('draws the estimate with the same calculation as the Estimate section, and none when the payment is too low', () => {
    const path = payoffPath(500_000, 900, 100_000, 600)
    const estimate = estimateDebtPayoff(500_000, 900, 100_000)
    expect(estimate.status === 'estimated' && path.length).toBe(estimate.status === 'estimated' ? estimate.months : -1)
    expect(path[path.length - 1]).toBe(0)
    expect(path.every((value, index) => index === 0 || value < path[index - 1])).toBe(true)
    expect(payoffPath(962_263, 600, 25_000, 12)).toHaveLength(12)
    expect(payoffPath(500_000, 2400, 5_000, 12)).toEqual([])
    expect(payoffPath(0, 900, 10_000, 12)).toEqual([])
  })
})

describe('Saved over time', () => {
  it('starts with what was already saved and adds each Contribution and Withdrawal, ending on what the goal holds', () => {
    const japan = demo.goals.find(goal => goal.id === 'trip-to-japan')!
    const steps = goalSteps(japan, demo.goalMovements)
    expect(steps[0]).toMatchObject({ key: 'opening', saved: 75_000, movement: null })
    expect(steps.map(step => step.saved).slice(0, 3)).toEqual([75_000, 85_000, 90_000])
    expect(steps[steps.length - 1].saved).toBe(goalSaved(japan, demo.goalMovements))
    const emergency = goalSteps(demo.goals.find(goal => goal.id === 'emergency-fund')!, demo.goalMovements)
    expect(emergency.some(step => step.amount < 0)).toBe(true)
  })

  it('has no opening step for a goal that started at 0', () => {
    const bike = demo.goals.find(goal => goal.id === 'bike')!
    expect(goalSteps(bike, demo.goalMovements).map(step => step.saved)).toEqual([10_000, 20_000])
  })
})

describe('Income & Spending by month', () => {
  it('shows what was received and spent up to today, and later months only with income expected', () => {
    const year = incomeSpendingByMonth(demo, 2026, ALEX_DEMO_TODAY)
    expect(year).toHaveLength(12)
    expect(year.every(row => row.started && !row.nothingRecorded)).toBe(true)
    // December's income has all come in: nothing is still expected.
    expect(year[11].expected).toBe(0)
    const next = incomeSpendingByMonth(demo, 2027, ALEX_DEMO_TODAY)
    expect(next.length).toBeGreaterThan(0)
    expect(next.every(row => !row.started && row.income === 0 && row.spending === 0 && row.expected > 0)).toBe(true)
  })

  it('says a month had nothing recorded instead of drawing 0, and never draws income that did not come in an earlier month', () => {
    const empty: FinanceData = { ...demo, income: [], expenses: [], transfers: [], billMonths: [] }
    const year = incomeSpendingByMonth(empty, 2026, ALEX_DEMO_TODAY)
    expect(year.filter(row => row.month < '2026-12').every(row => row.nothingRecorded && row.expected === 0)).toBe(true)
    expect(year[11].expected).toBeGreaterThan(0)
  })
})
