import type { CalendarDate } from '../../domain/goalTime'
import { formatDate } from '../../ui/format'

/**
 * The date line of blocks that show recorded balances (Total Debt, My
 * Money). It tells the dates the balances were really entered for, and
 * never suggests they were all entered on one day when they were not, or
 * that they are a forecast for the month shown.
 */
export function balanceDatesText(dates: readonly (CalendarDate | null)[], asOf: CalendarDate): string {
  const known = dates.filter((date): date is CalendarDate => date !== null).sort()
  if (known.length === 0) return `No balances entered by ${formatDate(asOf)}`
  const first = known[0]
  const last = known[known.length - 1]
  const missing = known.length < dates.length ? ' · Some not entered' : ''
  return first === last
    ? `Balances as of ${formatDate(last)}${missing}`
    : `Latest balances, dated ${formatDate(first)} to ${formatDate(last)}${missing}`
}
