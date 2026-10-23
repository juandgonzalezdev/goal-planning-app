import { monthsOfYear, type YearMonth } from '../calendar'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import type { FinanceData, Id } from './types'

export interface IncomeMonth {
  month: YearMonth
  /** False for a month with nothing recorded yet. Such a month is empty, not 0 and not a forecast. */
  recorded: boolean
  /** Amount per member id; members with nothing that month are 0. */
  byMember: Record<Id, MoneyAmount>
  household: MoneyAmount
}

export interface YearlyIncome {
  year: number
  /** Always twelve months, January first. */
  months: IncomeMonth[]
  byMember: Record<Id, MoneyAmount>
  household: MoneyAmount
  recordedMonthCount: number
}

/** Net income actually received in a year, per member and for the household. Nothing is projected. */
export function yearlyIncome(data: Pick<FinanceData, 'income' | 'space'>, year: number): YearlyIncome {
  const memberIds = data.space.members.map(member => member.id)
  const perMember = (entries: FinanceData['income']) =>
    Object.fromEntries(memberIds.map(id => [id, sumMinor(entries.filter(e => e.memberId === id).map(e => e.amount))]))

  const months = monthsOfYear(year).map(month => {
    const entries = data.income.filter(entry => entry.month === month)
    return { month, recorded: entries.length > 0, byMember: perMember(entries), household: sumMinor(entries.map(e => e.amount)) }
  })
  const yearEntries = data.income.filter(entry => entry.month.startsWith(`${year}-`))
  return {
    year,
    months,
    byMember: perMember(yearEntries),
    household: sumMinor(yearEntries.map(e => e.amount)),
    recordedMonthCount: months.filter(month => month.recorded).length,
  }
}

/** Household income received for one month. */
export const householdIncomeFor = (data: Pick<FinanceData, 'income'>, month: YearMonth): MoneyAmount =>
  sumMinor(data.income.filter(entry => entry.month === month).map(entry => entry.amount))
