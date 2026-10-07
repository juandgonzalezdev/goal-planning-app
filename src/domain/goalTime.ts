/** A calendar date written as 'YYYY-MM-DD', e.g. '2026-10-30'. */
export type CalendarDate = string

/** Facts about a goal's deadline. They do not depend on any plan. */
export interface DeadlineFacts {
  /** Whole calendar days from today to the deadline. Never negative. */
  daysRemaining: number
  /** True only when the deadline is strictly after today. */
  isInFuture: boolean
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Converts a 'YYYY-MM-DD' date into a whole number of days counted from a
 * fixed starting point. Using UTC means there are no daylight-saving shifts,
 * so every day is exactly 24 hours long.
 */
function toDayNumber(date: CalendarDate): number {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY
}

export function getDeadlineFacts(
  today: CalendarDate,
  deadline: CalendarDate,
): DeadlineFacts {
  const daysUntilDeadline = toDayNumber(deadline) - toDayNumber(today)

  return {
    daysRemaining: Math.max(daysUntilDeadline, 0),
    isInFuture: daysUntilDeadline > 0,
  }
}