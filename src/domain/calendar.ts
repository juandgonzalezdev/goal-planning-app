import type { CalendarDate } from './goalTime'

/** A calendar month written as 'YYYY-MM', e.g. '2026-10'. */
export type YearMonth = string

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_PER_WEEK = 7

const pad = (value: number, length: number) => String(value).padStart(length, '0')

/** Last day number of a month, e.g. 28 or 29 for February. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** True only for a real date written exactly as 'YYYY-MM-DD' (so not '2026-02-30'). */
export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

/** True only for a real month written exactly as 'YYYY-MM'. */
export function isYearMonth(value: unknown): value is YearMonth {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12
}

/** The month a date belongs to: '2026-10-23' -> '2026-10'. */
export const yearMonthOf = (date: CalendarDate): YearMonth => date.slice(0, 7)

/** Moves a month forwards (or backwards with a negative number): '2026-12' + 1 = '2027-01'. */
export function addMonthsToYearMonth(month: YearMonth, count: number): YearMonth {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1, 2)}`
}

/** The twelve months of a year, January first. */
export const monthsOfYear = (year: number): YearMonth[] =>
  Array.from({ length: 12 }, (_, index) => `${pad(year, 4)}-${pad(index + 1, 2)}`)

/**
 * The date a monthly payment falls on in a given month. A day that the
 * month does not have moves back to its last day: day 31 in November is
 * 30 November, and in February it is the 28th (or 29th).
 */
export function dateInMonth(month: YearMonth, day: number): CalendarDate {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  return `${month}-${pad(Math.min(day, daysInMonth(year, monthNumber)), 2)}`
}

/** Whole days from `from` to `to`; negative when `to` is earlier. Time zones play no part. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const dayNumber = (date: CalendarDate) =>
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / MILLISECONDS_PER_DAY
  return dayNumber(to) - dayNumber(from)
}

/**
 * Weekly plan rule, the weekly twin of the monthly one: the number of
 * whole weeks between today and the deadline. The first contribution is
 * one week after today, and a contribution on the deadline itself counts.
 * It never goes below 0.
 */
export function countWeeklyOpportunities(today: CalendarDate, deadline: CalendarDate): number {
  return Math.max(0, Math.floor(daysBetween(today, deadline) / DAYS_PER_WEEK))
}

/** Day of the week of a date, Monday = 0 … Sunday = 6. Read in UTC, so the time zone can never change it. */
export function weekdayIndexMondayFirst(date: CalendarDate): number {
  const [year, month, day] = date.split('-').map(Number)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

/**
 * The weeks of a month for a calendar that starts on Monday: each week has
 * seven places, and places before the 1st or after the last day are null.
 */
export function monthWeeks(month: YearMonth): (CalendarDate | null)[][] {
  const last = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)))
  const days: (CalendarDate | null)[] = Array.from({ length: weekdayIndexMondayFirst(`${month}-01`) }, () => null)
  for (let day = 1; day <= last; day++) days.push(`${month}-${pad(day, 2)}`)
  while (days.length % DAYS_PER_WEEK !== 0) days.push(null)
  return Array.from({ length: days.length / DAYS_PER_WEEK }, (_, week) => days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK))
}

/** The years around `year` (five before and five after by default), for a month picker. */
export const yearsAround = (year: number, before = 5, after = 5): number[] =>
  Array.from({ length: before + after + 1 }, (_, index) => year - before + index)
