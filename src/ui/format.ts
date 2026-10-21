import type { MoneyAmount } from '../domain/goalAmounts'
import type { CalendarDate } from '../domain/goalTime'

const moneyFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'PLN', minimumFractionDigits: 2, maximumFractionDigits: 2,
})

/** Grosze shown as PLN, e.g. 32_167 -> 'PLN 321.67'. */
export const formatMoney = (grosze: MoneyAmount) => moneyFormat.format(grosze / 100)

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * 'YYYY-MM-DD' shown as e.g. '21 Jan 2032'. Read straight from the text, so
 * the device's time zone can never shift the day.
 */
export function formatDate(date: CalendarDate): string {
  const [year, month, day] = date.split('-').map(Number)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

export const formatMonths = (count: number) => `${count} ${count === 1 ? 'month' : 'months'}`
