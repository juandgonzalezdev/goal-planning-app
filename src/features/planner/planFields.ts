import type { GoalPlanInput } from '../../domain/evaluateGoalPlan'
import type { MoneyAmount } from '../../domain/goalAmounts'
import type { CalendarDate } from '../../domain/goalTime'

/** The four planning inputs exactly as the user typed them. */
export type Fields = {
  targetAmount: string
  alreadySaved: string
  targetDate: string
  comfortableContribution: string
}

// Input amounts are PLN; the domain engine receives integers in grosze.
export function toGrosze(value: string): MoneyAmount | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const number = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(number) ? number : null
}

/** Writes grosze back as form text that `toGrosze` reads, e.g. 32_167 -> '321.67'. */
export function fromGrosze(grosze: MoneyAmount): string {
  const remainder = grosze % 100
  return `${(grosze - remainder) / 100}.${String(remainder).padStart(2, '0')}`
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

/** Validated engine input, or null when any field is not acceptable. */
export function fieldsToInput(fields: Fields, today: CalendarDate): GoalPlanInput | null {
  const targetAmount = toGrosze(fields.targetAmount)
  const alreadySaved = toGrosze(fields.alreadySaved)
  const comfortableContribution = toGrosze(fields.comfortableContribution)
  if (targetAmount === null || targetAmount <= 0 || alreadySaved === null || comfortableContribution === null || !isValidCalendarDate(fields.targetDate)) {
    return null
  }
  return { today, targetDate: fields.targetDate, targetAmount, alreadySaved, comfortableContribution }
}

export function sameFields(a: Fields, b: Fields): boolean {
  return a.targetAmount === b.targetAmount && a.alreadySaved === b.alreadySaved
    && a.targetDate === b.targetDate && a.comfortableContribution === b.comfortableContribution
}
