import type { YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { billsForMonth, summarizeBills, type BillOccurrence } from './bills'
import { activeGoals, goalProgress, type GoalProgress } from './goals'
import { BILL_CATEGORIES, type BillCategory, type FinanceData, type Goal } from './types'

export interface CategoryBills {
  category: BillCategory
  /** Known amounts only. */
  total: MoneyAmount
  /** Every bill of the category this month, unknown amounts included. */
  occurrences: BillOccurrence[]
}

export interface BillsByCategory {
  /** In the fixed category order. Categories with no known amount are left out of the chart. */
  categories: CategoryBills[]
  total: MoneyAmount
  /** Bills with no known amount this month; they are not in any total. */
  unknownCount: number
}

/** Monthly Bills by Category on Home, for one month. */
export function billsByCategory(data: Pick<FinanceData, 'bills' | 'billMonths'>, month: YearMonth): BillsByCategory {
  const occurrences = billsForMonth(data, month)
  const summary = summarizeBills(occurrences)
  const categories = BILL_CATEGORIES.map(category => {
    const list = occurrences.filter(o => o.bill.category === category)
    return { category, total: sumMinor(list.flatMap(o => (o.amount === null ? [] : [o.amount]))), occurrences: list }
  }).filter(item => item.total > 0)
  return { categories, total: summary.knownTotal, unknownCount: summary.unknownCount }
}

export interface GoalRow {
  goal: Goal
  progress: GoalProgress
}

/** My Goals on Home: the active goals in the order they were added. Archived pots and the emergency fund are left out. */
export function activeGoalRows(data: Pick<FinanceData, 'goals' | 'goalMovements'>, today: CalendarDate): GoalRow[] {
  return activeGoals(data.goals)
    .map(goal => ({ goal, progress: goalProgress(goal, data.goalMovements, today) }))
}
