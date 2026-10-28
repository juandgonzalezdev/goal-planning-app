import type { MoneyAmount } from '../domain/goalAmounts'
import type { CalendarDate } from '../domain/goalTime'
import type { YearMonth } from '../domain/calendar'
import type { CurrencyCode } from '../domain/money'

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

/**
 * The day an estimate is worked out from. In the own space it is really
 * today; the demo uses its own fixed date, so it never says "today" there.
 */
export const referenceDay = (today: CalendarDate, isDemo: boolean): string =>
  isDemo ? `${formatDate(today)} (the demo’s date)` : `today (${formatDate(today)})`

/**
 * An amount in minor units shown the way the approved design shows money,
 * e.g. 719_403 PLN -> '7194,03 zł'. Used by the new finance screens.
 */
export function formatAmount(minor: MoneyAmount, currency: CurrencyCode): string {
  return amountFormat(currency).format(minor / 100)
}

const amountFormats = new Map<CurrencyCode, Intl.NumberFormat>()
function amountFormat(currency: CurrencyCode) {
  let format = amountFormats.get(currency)
  if (!format) {
    format = new Intl.NumberFormat('pl-PL', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    amountFormats.set(currency, format)
  }
  return format
}

const LONG_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** '2026-10' shown as 'October 2026'. */
export function formatYearMonth(month: YearMonth): string {
  return `${LONG_MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

/** The weekday of a date, e.g. 'Saturday'. Calculated in UTC, so the time zone can never change it. */
export function weekdayOf(date: CalendarDate): string {
  const [year, month, day] = date.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

/** Calendar column headings, Monday first: the short name shown and the full name for screen readers. */
export const WEEK_HEADINGS: readonly { short: string; full: string }[] = [1, 2, 3, 4, 5, 6, 0].map(index => ({ short: WEEKDAY_NAMES[index].slice(0, 3), full: WEEKDAY_NAMES[index] }))

/** A date in full, for screen readers and headings: '2026-12-22' -> 'Tuesday 22 December 2026'. */
export function formatLongDate(date: CalendarDate): string {
  const [year, month, day] = date.split('-').map(Number)
  return `${weekdayOf(date)} ${day} ${LONG_MONTH_NAMES[month - 1]} ${year}`
}

/** The twelve month names, for the app's own month pickers (never the browser's language). */
export const MONTH_NAMES_LONG: readonly string[] = LONG_MONTH_NAMES

export const formatMonths = (count: number) => `${count} ${count === 1 ? 'month' : 'months'}`

/** '2026-10' shown as just the month's name, 'October'. */
export const monthName = (month: YearMonth) => LONG_MONTH_NAMES[Number(month.slice(5, 7)) - 1]

/** A yearly rate in hundredths of a percent shown as e.g. '18.50%'. */
export const formatRate = (basisPoints: number) => `${(basisPoints / 100).toFixed(2)}%`

/** A due day shown as 'Day 22' (short months use their last day). */
export const formatDueDay = (day: number) => `Day ${day}`
