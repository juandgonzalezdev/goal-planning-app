import { yearMonthOf } from '../domain/calendar'
import { isSourceActiveIn } from '../domain/finance/income'
import { toPay } from '../domain/finance/overview'
import type { FinanceData } from '../domain/finance/types'
import type { CalendarDate } from '../domain/goalTime'

/** What + Add in the header can start: records of what happened first, then plans. */
export type AddChoice = 'spending' | 'income-received' | 'transfer' | 'balance' | 'contribution' | 'payment' | 'income' | 'bill' | 'goal'

export const ADD_LABELS = {
  'spending': 'Add Spending',
  'income-received': 'Record Income Received',
  'transfer': 'Add Transfer',
  'balance': 'Update a Balance',
  'contribution': 'Add a Contribution',
  'payment': 'Mark a Bill as Paid',
  'income': 'Add Income',
  'bill': 'Add Bill',
  'goal': 'Add Goal',
} as const satisfies Record<AddChoice, string>

/**
 * The choices that apply to the space today. A record needs what it records
 * (a source with income this month, two accounts for a transfer, an account
 * for a balance, an active goal, a bill still to pay this month); spending
 * and the three plans are always offered.
 */
export function addChoices(data: FinanceData, today: CalendarDate): { record: AddChoice[]; plan: AddChoice[] } {
  const month = yearMonthOf(today)
  const unpaid = toPay(data, month, today)
  const applies: Record<AddChoice, boolean> = {
    'spending': true,
    'income-received': data.incomeSources.some(source => isSourceActiveIn(source, month)),
    'transfer': data.moneyAccounts.length > 1,
    'balance': data.moneyAccounts.length > 0,
    'contribution': data.goals.some(goal => goal.status === 'active'),
    'payment': unpaid.overdue.length + unpaid.open.length > 0,
    'income': true, 'bill': true, 'goal': true,
  }
  const pick = (list: AddChoice[]) => list.filter(choice => applies[choice])
  return { record: pick(['spending', 'income-received', 'transfer', 'balance', 'contribution', 'payment']), plan: pick(['income', 'bill', 'goal']) }
}
