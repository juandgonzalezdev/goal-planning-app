import type { BillOccurrence } from '../../domain/finance/bills'
import type { BillMonth, FinanceData } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate } from '../../ui/format'

/** The date Mark as Paid suggests: the due date once it has passed, otherwise today (as Record Received does). */
export const suggestedPaidOn = (occurrence: BillOccurrence, today: CalendarDate) => (occurrence.dueDate <= today ? occurrence.dueDate : today)

/** "Paid on 15 Dec 2026 · Everyday Account", or without an account when none was given. */
export function paidText(data: FinanceData, record: BillMonth | undefined) {
  if (!record?.paid) return ''
  const account = record.paidFrom ? data.moneyAccounts.find(item => item.id === record.paidFrom)?.name ?? 'a deleted account' : null
  return [record.paidOn ? `Paid on ${formatDate(record.paidOn)}` : 'Paid', account ?? 'Account not given'].join(' · ')
}

export const billMonthOf = (data: FinanceData, occurrence: BillOccurrence) =>
  data.billMonths.find(record => record.billId === occurrence.bill.id && record.month === occurrence.month)
