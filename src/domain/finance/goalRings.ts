import type { CalendarDate } from '../goalTime'
import { addDays, addMonthsToYearMonth, dateInMonth, yearMonthOf } from '../calendar'
import { countMonthlyOpportunities } from '../monthlyPlan'
import { debtMonthPayment, linkedBill } from './debts'
import { upcomingCharges } from './subscriptions'
import type { DebtAccount, FinanceData, Goal } from './types'

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
