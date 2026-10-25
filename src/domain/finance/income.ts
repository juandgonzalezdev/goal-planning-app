import { dateInMonth, isCalendarDate, isYearMonth, monthsOfYear, type YearMonth } from '../calendar'
import { characterCount } from '../goal'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { isMinorAmount, sumMinor } from '../money'
import type { FinanceData, Id, IncomeEntry, IncomeSource } from './types'

export interface IncomeMonth {
  month: YearMonth
  /** False for a month with nothing recorded yet. Such a month is empty, not 0 and not a forecast. */
  recorded: boolean
  /** Amount per member id; members with nothing that month are 0. */
  byMember: Record<Id, MoneyAmount>
  household: MoneyAmount
}

export interface YearlyIncome {
  year: number
  /** Always twelve months, January first. */
  months: IncomeMonth[]
  byMember: Record<Id, MoneyAmount>
  household: MoneyAmount
  recordedMonthCount: number
}

/** Net income actually received in a year, per member and for the household. Nothing is projected. */
export function yearlyIncome(data: Pick<FinanceData, 'income' | 'space'>, year: number): YearlyIncome {
  const memberIds = data.space.members.map(member => member.id)
  const perMember = (entries: FinanceData['income']) =>
    Object.fromEntries(memberIds.map(id => [id, sumMinor(entries.filter(e => e.memberId === id).map(e => e.amount))]))

  const months = monthsOfYear(year).map(month => {
    const entries = data.income.filter(entry => entry.month === month)
    return { month, recorded: entries.length > 0, byMember: perMember(entries), household: sumMinor(entries.map(e => e.amount)) }
  })
  const yearEntries = data.income.filter(entry => entry.month.startsWith(`${year}-`))
  return {
    year,
    months,
    byMember: perMember(yearEntries),
    household: sumMinor(yearEntries.map(e => e.amount)),
    recordedMonthCount: months.filter(month => month.recorded).length,
  }
}

/** Household income received for one month. */
export const householdIncomeFor = (data: Pick<FinanceData, 'income'>, month: YearMonth): MoneyAmount =>
  sumMinor(data.income.filter(entry => entry.month === month).map(entry => entry.amount))

/** True when the income source is expected in `month`. */
export const isSourceActiveIn = (source: IncomeSource, month: YearMonth) =>
  month >= source.startMonth && (source.endMonth === null || month <= source.endMonth)

export interface MonthIncomeLine {
  source: IncomeSource | null
  /** What was received, or null when nothing was recorded yet. */
  received: IncomeEntry | null
  /** The usual amount, while nothing was received (null once it was). */
  expected: MoneyAmount | null
  payDate: CalendarDate | null
}

export interface MonthIncome {
  lines: MonthIncomeLine[]
  received: MoneyAmount
  /** Expected amounts of the sources that have not arrived yet this month. */
  expected: MoneyAmount
  /** received + expected: what Home shows. */
  total: MoneyAmount
  /** received: everything is recorded. expected: nothing arrived yet. mixed: some of each. none: no income at all. */
  basis: 'received' | 'expected' | 'mixed' | 'none'
}

/**
 * The income of a month, keeping what really arrived apart from what is
 * only expected. A source counts as received once an entry for it (same
 * source and month) is recorded; until then its usual amount is expected.
 */
export function monthIncome(data: Pick<FinanceData, 'income' | 'incomeSources'>, month: YearMonth): MonthIncome {
  const entries = data.income.filter(entry => entry.month === month)
  const lines: MonthIncomeLine[] = data.incomeSources.filter(source => isSourceActiveIn(source, month)).map(source => {
    const received = entries.find(entry => entry.sourceId === source.id) ?? null
    return { source, received, expected: received ? null : source.amount, payDate: dateInMonth(month, source.payDay) }
  })
  for (const entry of entries) {
    if (!lines.some(line => line.received === entry)) lines.push({ source: null, received: entry, expected: null, payDate: null })
  }
  const received = sumMinor(lines.flatMap(line => (line.received ? [line.received.amount] : [])))
  const expected = sumMinor(lines.flatMap(line => (line.expected === null ? [] : [line.expected])))
  const hasReceived = lines.some(line => line.received)
  const hasExpected = lines.some(line => line.expected !== null)
  return {
    lines, received, expected, total: received + expected,
    basis: hasReceived && hasExpected ? 'mixed' : hasReceived ? 'received' : hasExpected ? 'expected' : 'none',
  }
}

export const SOURCE_NAME_MAX_LENGTH = 40

export interface IncomeSourceFields {
  name: string
  amount: MoneyAmount
  payDay: number
  startMonth: YearMonth
  endMonth: YearMonth | null
}

export type IncomeSourceError = 'name-required' | 'name-too-long' | 'invalid-amount' | 'invalid-pay-day' | 'invalid-start' | 'invalid-end' | 'ends-before-start'

export function validateIncomeSource(fields: IncomeSourceFields): IncomeSourceError[] {
  const errors: IncomeSourceError[] = []
  const name = fields.name.trim()
  if (name === '') errors.push('name-required')
  else if (characterCount(name) > SOURCE_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (!isMinorAmount(fields.amount) || fields.amount < 0) errors.push('invalid-amount')
  if (!Number.isInteger(fields.payDay) || fields.payDay < 1 || fields.payDay > 31) errors.push('invalid-pay-day')
  if (!isYearMonth(fields.startMonth)) errors.push('invalid-start')
  if (fields.endMonth !== null && !isYearMonth(fields.endMonth)) errors.push('invalid-end')
  else if (fields.endMonth !== null && fields.endMonth < fields.startMonth) errors.push('ends-before-start')
  return errors
}

export type IncomeResult = { status: 'ok'; data: FinanceData } | { status: 'invalid'; errors: IncomeSourceError[] }

/** Adds or changes an expected income. Income already received is not touched. */
export function saveIncomeSource(data: FinanceData, id: Id, memberId: Id, fields: IncomeSourceFields): IncomeResult {
  const errors = validateIncomeSource(fields)
  if (errors.length > 0) return { status: 'invalid', errors }
  const source: IncomeSource = { id, memberId, name: fields.name.trim(), amount: fields.amount, currency: data.space.currency, payDay: fields.payDay, startMonth: fields.startMonth, endMonth: fields.endMonth }
  const exists = data.incomeSources.some(s => s.id === id)
  return { status: 'ok', data: { ...data, incomeSources: exists ? data.incomeSources.map(s => (s.id === id ? source : s)) : [...data.incomeSources, source] } }
}

/** Removes an expected income. Income already received stays, without the link. */
export const deleteIncomeSource = (data: FinanceData, id: Id): FinanceData => ({
  ...data,
  incomeSources: data.incomeSources.filter(source => source.id !== id),
  income: data.income.map(entry => {
    if (entry.sourceId !== id) return entry
    const rest = { ...entry }
    delete rest.sourceId
    return rest
  }),
})

/**
 * Records what really arrived for a source in a month (replacing an
 * earlier record of the same source and month), or removes it with null.
 */
export function recordIncomeReceived(data: FinanceData, source: IncomeSource, month: YearMonth, received: { id: Id; amount: MoneyAmount; receivedOn: CalendarDate } | null): FinanceData | null {
  const others = data.income.filter(entry => !(entry.sourceId === source.id && entry.month === month))
  if (received === null) return { ...data, income: others }
  if (!isMinorAmount(received.amount) || received.amount < 0 || !isCalendarDate(received.receivedOn)) return null
  const entry: IncomeEntry = { id: received.id, memberId: source.memberId, sourceId: source.id, month, receivedOn: received.receivedOn, amount: received.amount, currency: data.space.currency }
  return { ...data, income: [...others, entry] }
}
