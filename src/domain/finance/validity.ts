import type { YearMonth } from '../calendar'

/**
 * Whether an income source or a bill is in force on a reference month:
 * - upcoming: its first month is still to come,
 * - ended: its last month has passed,
 * - active: otherwise (including its first and last month).
 * The reference month is the month of "today" (the demo's date in the
 * demo), never a month chosen to look at a past payment.
 */
export type Validity = 'active' | 'upcoming' | 'ended'
export type ValidityFilter = Validity | 'all'

export const VALIDITY_NAMES: Record<Validity, string> = { active: 'Active', upcoming: 'Upcoming', ended: 'Ended' }

type Dated = { startMonth: YearMonth; endMonth: YearMonth | null }

export function validityOn(item: Dated, month: YearMonth): Validity {
  if (item.startMonth > month) return 'upcoming'
  if (item.endMonth !== null && item.endMonth < month) return 'ended'
  return 'active'
}

export const matchesValidity = (item: Dated, month: YearMonth, filter: ValidityFilter) =>
  filter === 'all' || validityOn(item, month) === filter

/** How many items are active, upcoming and ended on the month, and in all. */
export function countByValidity(items: readonly Dated[], month: YearMonth): Record<ValidityFilter, number> {
  const counts = { active: 0, upcoming: 0, ended: 0, all: items.length }
  for (const item of items) counts[validityOn(item, month)] += 1
  return counts
}

/** The filter actually used: Upcoming falls back to Active once nothing is upcoming. */
export const usableFilter = (value: ValidityFilter, counts: Record<ValidityFilter, number>): ValidityFilter =>
  value === 'upcoming' && counts.upcoming === 0 ? 'active' : value
