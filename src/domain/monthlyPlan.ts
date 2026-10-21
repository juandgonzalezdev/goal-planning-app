import type { CalendarDate } from './goalTime'

const MONTHS_PER_YEAR = 12

/** A calendar date split into numbers. `month` runs from 1 (January) to 12. */
interface DateParts {
  year: number
  month: number
  day: number
}

function parseDate(date: CalendarDate): DateParts {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  }
}

/** Last day number of a month, e.g. 28 or 29 for February. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the *following* month is the last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Returns the date that is `months` months after `date`. If that month is
 * too short to contain the day number, it moves back to the month's last
 * day (31 Jan + 1 month = 28 Feb, or 29 Feb in a leap year).
 */
function addMonths(date: DateParts, months: number): DateParts {
  const monthIndex = date.year * MONTHS_PER_YEAR + (date.month - 1) + months
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR)
  const month = (monthIndex % MONTHS_PER_YEAR) + 1
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) }
}

function isAfter(a: DateParts, b: DateParts): boolean {
  if (a.year !== b.year) return a.year > b.year
  if (a.month !== b.month) return a.month > b.month
  return a.day > b.day
}

function formatDate({ year, month, day }: DateParts): CalendarDate {
  const pad = (value: number, length: number) => String(value).padStart(length, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/**
 * Returns the calendar date `months` whole months after `date`, using the
 * same month-end rule as the opportunity count (31 Jan + 1 month = 28 Feb,
 * or 29 Feb in a leap year). `months` must be a non-negative whole number.
 * Counting `months` opportunities from `date` to the result always gives
 * exactly `months`, and the day before the result gives one fewer.
 */
export function addMonthsToDate(date: CalendarDate, months: number): CalendarDate {
  return formatDate(addMonths(parseDate(date), months))
}

/**
 * Monthly Plan rule: the number of whole months that fit between today and
 * the deadline. This is the number of monthly contribution opportunities.
 * It never goes below 0.
 */
export function countMonthlyOpportunities(
  today: CalendarDate,
  deadline: CalendarDate,
): number {
  const start = parseDate(today)
  const end = parseDate(deadline)

  const calendarMonthsApart =
    (end.year - start.year) * MONTHS_PER_YEAR + (end.month - start.month)
  if (calendarMonthsApart <= 0) return 0

  // The deadline falls in the month `calendarMonthsApart` months from now.
  // If today's day number, moved into that month, lands after the deadline,
  // the last of those months is not complete yet.
  const lastDateReached = addMonths(start, calendarMonthsApart)
  return isAfter(lastDateReached, end)
    ? calendarMonthsApart - 1
    : calendarMonthsApart
}