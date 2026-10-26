import type { CalendarDate } from '../domain/goalTime'

/** Today's calendar date on this device, as 'YYYY-MM-DD'. */
export function todayString(): CalendarDate {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
