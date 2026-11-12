import type { MoneyAmount } from '../domain/goalAmounts'
import type { CalendarDate } from '../domain/goalTime'
import type { YearMonth } from '../domain/calendar'
import type { CurrencyCode } from '../domain/money'
import { activeLanguage, t } from '../i18n'

/*
 * Dates and months follow the app's language (Phase B1). English keeps its
 * own hand-written forms, exactly as before; Spanish and Polish use the
 * browser's Intl, always on a UTC date built from the text, so the device's
 * time zone can never move a day. Amounts keep one format in every language
 * (decision D3): only words change, never a value or its currency.
 */
const LOCALES = { en: 'en-GB', es: 'es-ES', pl: 'pl-PL' } as const
const intlCache = new Map<string, Intl.DateTimeFormat>()
function intlDate(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const language = activeLanguage()
  const key = `${language}:${JSON.stringify(options)}`
  let format = intlCache.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALES[language], { ...options, timeZone: 'UTC' })
    intlCache.set(key, format)
  }
  return format
}
const utc = (year: number, month: number, day = 1) => {
  // Date.UTC treats 0–99 as 1900–1999. Set the actual year, month and day together.
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date
}
const parts = (date: string) => date.split('-').map(Number)

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * 'YYYY-MM-DD' shown as e.g. '21 Jan 2032'. Read straight from the text, so
 * the device's time zone can never shift the day.
 */
export function formatDate(date: CalendarDate): string {
  const [year, month, day] = parts(date)
  if (activeLanguage() !== 'en') return intlDate({ day: 'numeric', month: 'short', year: 'numeric' }).format(utc(year, month, day))
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

/** A short range of days, such as "1–7 Jan" (or "30 Dec – 5 Jan" across months). */
export function formatDayRange(from: CalendarDate, to: CalendarDate): string {
  if (activeLanguage() !== 'en') {
    const [fy, fm, fd] = parts(from)
    const [ty, tm, td] = parts(to)
    return intlDate({ day: 'numeric', month: 'short' }).formatRange(utc(fy, fm, fd), utc(ty, tm, td))
  }
  const day = (date: CalendarDate) => Number(date.slice(8, 10))
  const name = (date: CalendarDate) => MONTH_NAMES[Number(date.slice(5, 7)) - 1]
  return from.slice(0, 7) === to.slice(0, 7) ? `${day(from)}–${day(to)} ${name(to)}` : `${day(from)} ${name(from)} – ${day(to)} ${name(to)}`
}

/**
 * The day an estimate is worked out from. In the own space it is really
 * today; the demo uses its own fixed date, so it never says "today" there.
 */
export const referenceDay = (today: CalendarDate, isDemo: boolean): string =>
  t(isDemo ? 'date.referenceDemo' : 'date.referenceToday', { date: formatDate(today) })

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
  if (activeLanguage() !== 'en') return intlDate({ month: 'long', year: 'numeric' }).format(utc(Number(month.slice(0, 4)), Number(month.slice(5, 7))))
  return `${LONG_MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${Number(month.slice(0, 4))}`
}

/** '2026-10' shown as 'Oct 2026', for the labels under a chart. */
export function formatShortYearMonth(month: YearMonth): string {
  if (activeLanguage() !== 'en') return intlDate({ month: 'short', year: 'numeric' }).format(utc(Number(month.slice(0, 4)), Number(month.slice(5, 7))))
  return `${LONG_MONTH_NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3)} ${Number(month.slice(0, 4))}`
}

/** The weekday of a date, e.g. 'Saturday'. Calculated in UTC, so the time zone can never change it. */
export function weekdayOf(date: CalendarDate): string {
  const [year, month, day] = parts(date)
  if (activeLanguage() !== 'en') return intlDate({ weekday: 'long' }).format(utc(year, month, day))
  return WEEKDAY_NAMES[utc(year, month, day).getUTCDay()]
}

/** Calendar column headings, Monday first: the short name shown and the full name for screen readers. */
export function weekHeadings(): readonly { short: string; full: string }[] {
  // 2024-01-01 was a Monday.
  if (activeLanguage() !== 'en') return [1, 2, 3, 4, 5, 6, 7].map(day => ({ short: intlDate({ weekday: 'short' }).format(utc(2024, 1, day)), full: intlDate({ weekday: 'long' }).format(utc(2024, 1, day)) }))
  return [1, 2, 3, 4, 5, 6, 0].map(index => ({ short: WEEKDAY_NAMES[index].slice(0, 3), full: WEEKDAY_NAMES[index] }))
}

/** A date in full, for screen readers and headings: '2026-12-22' -> 'Tuesday 22 December 2026'. */
export function formatLongDate(date: CalendarDate): string {
  const [year, month, day] = parts(date)
  if (activeLanguage() !== 'en') return intlDate({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(utc(year, month, day))
  return `${weekdayOf(date)} ${day} ${LONG_MONTH_NAMES[month - 1]} ${year}`
}

/** The twelve month names on their own (as a list shows them), in the app's language, for the app's own month pickers. */
export function monthNamesLong(): readonly string[] {
  if (activeLanguage() === 'en') return LONG_MONTH_NAMES
  const capital = (text: string) => text.charAt(0).toLocaleUpperCase(LOCALES[activeLanguage()]) + text.slice(1)
  return Array.from({ length: 12 }, (_, index) => capital(intlDate({ month: 'long' }).format(utc(2024, index + 1))))
}

export const formatMonths = (count: number) => t('date.months', { count })

/** '2026-10' shown as just the month's name, 'October'. */
export const monthName = (month: YearMonth) => (activeLanguage() === 'en'
  ? LONG_MONTH_NAMES[Number(month.slice(5, 7)) - 1]
  : intlDate({ month: 'long' }).format(utc(2024, Number(month.slice(5, 7)))))

/** '2026-10' as a short month name, 'Oct' (month wheel). */
export const shortMonthName = (month: YearMonth) => (activeLanguage() === 'en'
  ? LONG_MONTH_NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3)
  : intlDate({ month: 'short' }).format(utc(2024, Number(month.slice(5, 7)))).replace('.', ''))

/** A yearly rate in hundredths of a percent shown as e.g. '18.50%'. */
export const formatRate = (basisPoints: number) => `${(basisPoints / 100).toFixed(2)}%`

/** A due day shown as 'Day 22' (short months use their last day). */
export const formatDueDay = (day: number) => t('date.dueDay', { day })
