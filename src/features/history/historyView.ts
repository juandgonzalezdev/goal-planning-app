import type { YearMonth } from '../../domain/calendar'
import { NO_FILTER, type ActivityEntry, type ActivityType, type HistoryFilter, type HistoryMonth, type HistoryPeriod } from '../../domain/finance/history'
import type { MovementEffect } from '../../domain/finance/types'
import { formatYearMonth } from '../../ui/format'

/** How many records a month shows before Show More. */
export const MONTH_PAGE = 20

/**
 * How History looks while moving around the app: its own period (never
 * the month shared by Home, Bills and Cards), the search and filters, Year
 * Overview open or closed, the months open and how many records each one
 * shows. It is a screen preference, never data, and lasts for the session
 * only. The demo and the own space each have their own.
 */
export interface HistoryView {
  /** null until History is first opened: it then starts on the year of the month shown. */
  filter: HistoryFilter | null
  overviewOpen: boolean
  moreFilters: boolean
  /** The months open. null: the first rule (a one-month period opens, else the newest month with results). */
  openMonths: YearMonth[] | null
  /** Records shown per month (MONTH_PAGE when not in the list). */
  shown: Record<YearMonth, number>
}

export const INITIAL_HISTORY_VIEW: HistoryView = { filter: null, overviewOpen: false, moreFilters: false, openMonths: null, shown: {} }

/** The first period, as before: the year of the month shown when History opens. */
export const firstFilter = (month: YearMonth): HistoryFilter => ({ ...NO_FILTER, period: { kind: 'year', year: Number(month.slice(0, 4)) } })

/** The filters inside More Filters that are on (the period and the search are not among them). */
export function secondaryFilters(filter: HistoryFilter): ('type' | 'category' | 'accountId')[] {
  return (['type', 'category', 'accountId'] as const).filter(key => filter[key] !== 'all')
}

/** True when a search or a filter from More Filters is on: Clear Filters has something to clear. */
export const isNarrowed = (filter: HistoryFilter) => filter.search.trim() !== '' || secondaryFilters(filter).length > 0

/** The months open now: the ones chosen, or the first rule. */
export function openMonthsOf(view: HistoryView, filter: HistoryFilter, groups: readonly HistoryMonth[]): YearMonth[] {
  if (view.openMonths !== null) return view.openMonths
  if (filter.period.kind === 'month') return [filter.period.month]
  return groups.length > 0 ? [groups[0].month] : []
}

/**
 * A new period, search or filter. The list starts again from its first
 * records; with a search or a filter on, every month with results opens so
 * they are all in sight, and without one the first rule applies again.
 */
export function withFilter(view: HistoryView, filter: HistoryFilter, groups: readonly HistoryMonth[]): HistoryView {
  return { ...view, filter, shown: {}, openMonths: isNarrowed(filter) ? groups.map(group => group.month) : null }
}

/** Opens or closes one month. From then on, the months open are the ones chosen. */
export function toggleMonth(view: HistoryView, open: readonly YearMonth[], month: YearMonth): HistoryView {
  return { ...view, openMonths: open.includes(month) ? open.filter(item => item !== month) : [...open, month] }
}

/** Expand All / Collapse All: the month groups only (not Year Overview or More Filters). */
export const setAllMonths = (view: HistoryView, groups: readonly HistoryMonth[], open: boolean): HistoryView =>
  ({ ...view, openMonths: open ? groups.map(group => group.month) : [] })

export const shownIn = (view: HistoryView, month: YearMonth) => view.shown[month] ?? MONTH_PAGE

export const showMore = (view: HistoryView, month: YearMonth): HistoryView =>
  ({ ...view, shown: { ...view.shown, [month]: shownIn(view, month) + MONTH_PAGE } })

export const TYPE_NAMES: Record<ActivityType, string> = {
  income: 'Income', bill: 'Bill payments', spending: 'Spending', transfer: 'Transfers', savings: 'Savings & goals', balance: 'Balances',
}

export function periodLabel(period: HistoryPeriod): string {
  if (period.kind === 'all') return 'all time'
  if (period.kind === 'year') return String(period.year)
  return formatYearMonth(period.month)
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** What each row is, in plain words. Savings movements say what they did to Savings. */
const TYPE_TAGS: Record<Exclude<ActivityType, 'savings'>, string> = {
  income: 'Income received', bill: 'Bill payment', spending: 'Spending', transfer: 'Transfer', balance: 'Balance update',
}
const EFFECT_TAGS: Record<MovementEffect, string> = {
  'new-savings': 'Savings added', 'taken-out': 'Savings taken out', assigned: 'Assigned to a goal', unassigned: 'Released from a goal',
}
/** The row's type in plain words: a savings movement says what it did to Savings. */
export function tagOf(entry: ActivityEntry): string {
  if (entry.type !== 'savings') return TYPE_TAGS[entry.type]
  if (entry.ref.kind === 'opening') return 'Already saved'
  return entry.effect ? EFFECT_TAGS[entry.effect] : 'Savings'
}
