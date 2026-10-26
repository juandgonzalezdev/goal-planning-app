import type { YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { billsForMonth } from './bills'
import { BILL_SPENDING_CATEGORY, monthResult } from './spending'
import type { FinanceData, SpendingCategory } from './types'

/**
 * Optional reference notes. Each one says its source, formula, period and
 * what it includes, and none is a target or a limit: there is no
 * universal right amount for housing or any other cost.
 */

/** What the housing note counts: rent and housing bills, and utilities (water, energy, heating). */
export const HOUSING_CATEGORIES: readonly SpendingCategory[] = ['Housing', 'Utilities']

export type HousingShare =
  | { status: 'ok'; housing: MoneyAmount; income: MoneyAmount; percent: number; months: YearMonth[] }
  /** No income received in the period, or less than 0: a percentage would mean nothing. */
  | { status: 'no-income'; housing: MoneyAmount; months: YearMonth[] }
  /** A housing bill without a known amount in the period: the share would look smaller than it is. */
  | { status: 'incomplete'; months: YearMonth[] }

/**
 * Housing costs as a share of the net income received over the same
 * months. Eurostat uses more than 40 % of disposable income as a sign of
 * housing cost overburden for a household: a measure of difficulty used
 * in statistics, not a recommendation. Net income received is the closest
 * the app has to disposable income, and housing allowances are not
 * recorded separately.
 */
export function housingShare(data: FinanceData, months: readonly YearMonth[], today: CalendarDate): HousingShare {
  const results = months.map(month => monthResult(data, month, today))
  const unknown = months.some(month => billsForMonth(data, month)
    .some(o => o.amount === null && HOUSING_CATEGORIES.includes(BILL_SPENDING_CATEGORY[o.bill.category])))
  if (unknown) return { status: 'incomplete', months: [...months] }
  const housing = sumMinor(results.flatMap(r => r.spending.items.filter(item => HOUSING_CATEGORIES.includes(item.category)).map(item => item.amount)))
  const income = sumMinor(results.map(r => r.income.total))
  if (income <= 0) return { status: 'no-income', housing, months: [...months] }
  return { status: 'ok', housing, income, percent: Math.round((housing * 1000) / income) / 10, months: [...months] }
}

/** Eurostat's threshold for the housing cost overburden rate (share of disposable income). */
export const EUROSTAT_OVERBURDEN_PERCENT = 40
