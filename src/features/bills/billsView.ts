import { isYearMonth, yearMonthOf, type YearMonth } from '../../domain/calendar'
import type { BillOccurrence } from '../../domain/finance/bills'
import type { Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { formatDate, formatYearMonth, monthName, weekdayOf } from '../../ui/format'

export type BillsMode = 'calendar' | 'list'
export type BillsFilter = 'all' | 'pending' | 'paid'

/**
 * How Bills looks: Calendar or List, the status filter and the chosen day.
 * The app keeps it for the session, so coming back from a bill shows the
 * same view. The month is not here: it is the app's shared month.
 */
export interface BillsView {
  mode: BillsMode
  filter: BillsFilter
  /** The day chosen in the calendar; only used while it belongs to the month shown. */
  selected: CalendarDate | null
  /**
   * A bill just added from the day panel, with what happened to the save
   * (e.g. "Bill added. Demo only: not saved."). The panel says so until the
   * day, the month, the view or the filter changes.
   */
  added: { id: Id; message: string } | null
}

export const INITIAL_BILLS_VIEW: BillsView = { mode: 'calendar', filter: 'all', selected: null, added: null }

export const FILTER_NAMES: Record<BillsFilter, string> = { all: 'All', pending: 'Pending', paid: 'Paid' }

/** The bills a filter shows. It only hides bills on screen: the month's totals never use it. */
export const filterBills = (occurrences: readonly BillOccurrence[], filter: BillsFilter): BillOccurrence[] =>
  filter === 'all' ? [...occurrences] : occurrences.filter(o => (filter === 'paid' ? o.paid : !o.paid))

/**
 * The day the calendar shows first: the one chosen before (if it is in this
 * month), else the reference day (today, or the demo's date) when it is in
 * this month, else the first day with bills. null when the month has none.
 */
export function selectedDay(month: YearMonth, chosen: CalendarDate | null, today: CalendarDate, shown: readonly BillOccurrence[]): CalendarDate | null {
  if (chosen && yearMonthOf(chosen) === month) return chosen
  if (yearMonthOf(today) === month) return today
  return shown[0]?.dueDate ?? null
}

/** A short day for the day bar, e.g. "Tue 22 Dec" (from '2026-12-22'). */
export const shortDay = (date: CalendarDate) => `${weekdayOf(date).slice(0, 3)} ${formatDate(date).replace(/ \d{4}$/, '')}`

/** The bills of one day that fit in a calendar cell, and how many more there are ("+N more"). */
export function cellBills(dayBills: readonly BillOccurrence[], max: number): { shown: BillOccurrence[]; more: number } {
  // With exactly one too many, the last place shows the bill itself rather than "+1 more".
  if (dayBills.length <= max) return { shown: [...dayBills], more: 0 }
  return { shown: dayBills.slice(0, max - 1), more: dayBills.length - (max - 1) }
}

/** A typed due day as a number (NaN unless it is one or two digits; the range is checked by the bill rules). */
export const readDueDay = (text: string) => (/^\d{1,2}$/.test(text.trim()) ? Number(text) : NaN)

/** The check sentence above the buttons, e.g. "Monthly on day 22, starting December 2026. No end date." null while the day or month is not valid. */
export function scheduleSentence(draft: { dueDay: string; startMonth: string; endMonth: string }, yearly = false): string | null {
  const day = readDueDay(draft.dueDay)
  if (!(day >= 1 && day <= 31) || !isYearMonth(draft.startMonth)) return null
  const repeat = yearly ? `Once a year in ${monthName(draft.startMonth)}, on day ${day}` : `Monthly on day ${day}`
  // An end month before the start is an error shown on its field: the sentence then says nothing about the end.
  const end = draft.endMonth === '' ? '. No end date.'
    : isYearMonth(draft.endMonth) && draft.endMonth >= draft.startMonth ? `, ending ${formatYearMonth(draft.endMonth)}.` : '.'
  return `${repeat}, starting ${formatYearMonth(draft.startMonth)}${end}`
}
