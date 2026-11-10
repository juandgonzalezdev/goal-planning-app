import type { CalendarDate } from '../goalTime'
import { addDays, addMonthsToYearMonth, dateInMonth, yearMonthOf } from '../calendar'
import { countMonthlyOpportunities } from '../monthlyPlan'
import { debtMonthPayment, linkedBill } from './debts'
import { upcomingCharges } from './subscriptions'
import type { DebtAccount, FinanceData, Goal } from './types'
import type { YearMonth } from '../calendar'
import { billsForMonth, summarizeBills } from './bills'
import { monthIncome } from './income'
import { activeGoals, goalSaved } from './goals'
import { sumMinor } from '../money'

export type RingArea = 'income' | 'bills' | 'debts' | 'goals'
const ratio = (done: number, total: number): number | null => total > 0 ? Math.min(100, Math.max(0, done / total * 100)) : null

/** Received share of this month's recorded + still expected income, never a fixed budget. */
export function incomeRingProgress(data: FinanceData, month: YearMonth) {
  const income = monthIncome(data, month)
  const hasForecast = income.lines.some(line => line.source && line.source.amount > 0)
  return { ...income, hasForecast, percent: hasForecast ? ratio(income.received, income.total) : null }
}

/** Count obligations, including unknown amounts and preserved historical payments. */
export function billsRingProgress(data: FinanceData, month: YearMonth) {
  const summary = summarizeBills(billsForMonth(data, month))
  return { ...summary, percent: ratio(summary.paidCount, summary.count) }
}

/** Only linked bill occurrences have a verifiable payment status. Unlinked active debts are disclosed separately. */
export function debtsRingProgress(data: FinanceData, month: YearMonth) {
  const debtIds = new Set(data.debts.map(debt => debt.id))
  const occurrences = billsForMonth(data, month).filter(item => item.bill.debtId && debtIds.has(item.bill.debtId))
  const summary = summarizeBills(occurrences)
  const unverifiedCount = data.debts.filter(debt => !linkedBill(data, debt.id)
    && (!debt.startMonth || month >= debt.startMonth) && (!debt.finalPaymentMonth || month <= debt.finalPaymentMonth)).length
  return { count: summary.count, paidCount: summary.paidCount, unverifiedCount, percent: ratio(summary.paidCount, summary.count) }
}

/** Current goal records and all movements, like Goals. Not a reconstruction of past goal status or targets. */
export function goalsRingProgress(data: FinanceData) {
  const active = activeGoals(data.goals)
  const included = active.filter(goal => goal.target !== null && Number.isSafeInteger(goal.target) && goal.target > 0)
  const counted = sumMinor(included.map(goal => Math.min(goal.target!, Math.max(0, goalSaved(goal, data.goalMovements)))))
  const saved = sumMinor(included.map(goal => goalSaved(goal, data.goalMovements)))
  const target = sumMinor(included.map(goal => goal.target!))
  return { saved, counted, target, count: included.length, withoutTargetCount: active.length - included.length, percent: ratio(counted, target) }
}

/** Reuse bill scheduling, including paid, paused, yearly and ended bills. */
export function nextDebtPayment(data: FinanceData, debt: DebtAccount, asOf: CalendarDate) {
  const bill = linkedBill(data, debt.id)
  if (bill) return upcomingCharges(data, bill, addDays(asOf, -1), 1)[0] ?? null
  const first = yearMonthOf(asOf)
  const month = dateInMonth(first, debt.dueDay) < asOf ? addMonthsToYearMonth(first, 1) : first
  if (debt.startMonth && month < debt.startMonth) {
    return { dueDate: dateInMonth(debt.startMonth, debt.dueDay), amount: debtMonthPayment(data, debt, debt.startMonth).amount }
  }
  if (debt.finalPaymentMonth && month > debt.finalPaymentMonth) return null
  return { dueDate: dateInMonth(month, debt.dueDay), amount: debtMonthPayment(data, debt, month).amount }
}

/** Calendar orientation only: never used as a money percentage. */
export function goalMonthPosition(goal: Goal, today: CalendarDate) {
  if (!goal.deadline) return null
  const total = countMonthlyOpportunities(goal.createdOn, goal.deadline) + 1
  return { current: Math.min(countMonthlyOpportunities(goal.createdOn, today) + 1, total), total }
}
