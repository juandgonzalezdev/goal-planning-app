import { addMonthsToYearMonth, yearMonthOf, type YearMonth } from '../calendar'
import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import { sumMinor } from '../money'
import { isWithinBillDates, usualAmountFor } from './bills'
import { latestBalance } from './balances'
import { linkedBill } from './debts'
import { addGoalMovement, emergencyFund, goalSaved } from './goals'
import { BILL_SPENDING_CATEGORY, monthEnd, monthSpending, type SpendingItem } from './spending'
import type { EmergencyBasis, FinanceData, Goal, Id, Owner, SpendingCategory } from './types'

/**
 * The emergency fund estimate:
 *
 *   target = confirmed essential spending per month × months of cover
 *
 * The app only proposes the lines and amounts below; the user confirms
 * which ones are essential and can change any amount. Nothing is created
 * or assigned until the user confirms, and a reference (1, 3 or 6 months)
 * is a common rule of thumb, never a personal guarantee.
 */

/** Categories proposed as essential to start with. The user can change every one. */
export const ESSENTIAL_BY_DEFAULT: readonly SpendingCategory[] = ['Housing', 'Utilities', 'Groceries', 'Transport', 'Health']

/** Variable spending is averaged over up to this many complete months (those with records), so one unusual month does not decide it. */
export const AVERAGE_MONTHS = 6

export const COVER_OPTIONS = [1, 3, 6] as const

export type EssentialLineKind = 'bill' | 'variable' | 'annual' | 'debt'

export interface EssentialLine {
  key: string
  kind: EssentialLineKind
  label: string
  category: SpendingCategory | 'Debt payments'
  /** Per month. null when it is not known: then the estimate is incomplete until the user enters it. */
  monthly: MoneyAmount | null
  /** How the amount was worked out, in plain words. */
  method: string
  essentialByDefault: boolean
}

export interface EssentialsEstimate {
  /** The last complete month the averages use. */
  throughMonth: YearMonth
  /** The months the averages use (oldest first), and how many of them have any spending recorded. */
  averageMonths: YearMonth[]
  monthsWithRecords: number
  lines: EssentialLine[]
  /** One-off costs left out of the averages (this is what a fund is for), from the last 12 months. */
  exceptional: SpendingItem[]
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortMonth = (month: YearMonth) => `${MONTH_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

/**
 * The last complete month on `today`: the month itself on its last day,
 * otherwise the month before (an unfinished month would look cheaper).
 */
export function lastCompleteMonth(today: CalendarDate): YearMonth {
  const month = yearMonthOf(today)
  return today === monthEnd(month) ? month : addMonthsToYearMonth(month, -1)
}

/**
 * Proposes the essential lines from the records:
 * - each bill, at its usual amount now (a yearly bill ÷ 12);
 * - each loan installment and card minimum payment (required payments);
 * - variable spending per category, averaged over the last 6 complete
 *   months, leaving out one-off costs; once-a-year costs over the last
 *   12 months ÷ 12.
 * Transfers to savings and goal contributions are never spending, so they
 * are never in it.
 */
export function estimateEssentials(data: FinanceData, today: CalendarDate): EssentialsEstimate {
  const through = lastCompleteMonth(today)
  const averageMonths = Array.from({ length: AVERAGE_MONTHS }, (_, i) => addMonthsToYearMonth(through, i - AVERAGE_MONTHS + 1))
  const yearMonths = Array.from({ length: 12 }, (_, i) => addMonthsToYearMonth(through, i - 11))
  const nowMonth = yearMonthOf(today)
  const lines: EssentialLine[] = []

  for (const bill of data.bills) {
    if (bill.debtId || !isWithinBillDates(bill, nowMonth)) continue
    const usual = usualAmountFor(bill, nowMonth)
    const yearly = bill.frequency === 'yearly'
    const category = BILL_SPENDING_CATEGORY[bill.category]
    lines.push({
      key: `bill:${bill.id}`, kind: 'bill', label: bill.name, category,
      monthly: usual === null ? null : yearly ? Math.round(usual / 12) : usual,
      method: usual === null ? 'The usual amount is not entered' : yearly ? 'Once a year, ÷ 12' : `Usual amount in ${shortMonth(nowMonth)}`,
      essentialByDefault: ESSENTIAL_BY_DEFAULT.includes(category),
    })
  }

  for (const debt of data.debts) {
    const balance = latestBalance(data.balances, debt.id, today)
    if (balance !== null && balance.amount <= 0) continue
    const bill = linkedBill(data, debt.id)
    if (debt.kind === 'card') {
      lines.push({ key: `debt:${debt.id}`, kind: 'debt', label: `${debt.name} minimum payment`, category: 'Debt payments',
        monthly: debt.minimumPayment ?? null, method: debt.minimumPayment === undefined ? 'The minimum payment is not entered' : 'Minimum payment as entered from the statement', essentialByDefault: true })
      continue
    }
    const amount = bill && isWithinBillDates(bill, nowMonth) ? usualAmountFor(bill, nowMonth) : debt.monthlyPayment ?? null
    lines.push({ key: `debt:${debt.id}`, kind: 'debt', label: `${debt.name} installment`, category: 'Debt payments',
      monthly: amount, method: amount === null ? 'The installment is not entered' : 'Required monthly installment', essentialByDefault: true })
  }

  const spentIn = (months: readonly YearMonth[]) => months.flatMap(month => monthSpending(data, month).items).filter(item => item.source === 'expense')
  const recent = spentIn(averageMonths)
  const monthsWithRecords = averageMonths.filter(month => recent.some(item => item.month === month)).length
  const regularCategories = [...new Set(recent.filter(item => item.nature === 'regular').map(item => item.category))]
  for (const category of new Set<SpendingCategory>([...regularCategories, 'Groceries'])) {
    const items = recent.filter(item => item.category === category && item.nature === 'regular')
    const known = items.length > 0
    lines.push({
      key: `variable:${category}`, kind: 'variable', label: category, category,
      // Only the months with records count, so a space started two months ago is not divided by six.
      monthly: known ? Math.round(sumMinor(items.map(item => item.amount)) / monthsWithRecords) : null,
      method: !known ? 'No spending recorded yet'
        : monthsWithRecords === AVERAGE_MONTHS ? `Average of ${shortMonth(averageMonths[0])} – ${shortMonth(through)} (${AVERAGE_MONTHS} months), one-off costs left out`
        : `Average of the ${monthsWithRecords === 1 ? 'one month' : `${monthsWithRecords} months`} with records up to ${shortMonth(through)}, one-off costs left out`,
      essentialByDefault: ESSENTIAL_BY_DEFAULT.includes(category),
    })
  }
  const lastYear = spentIn(yearMonths)
  const annual = lastYear.filter(item => item.nature === 'annual')
  if (annual.length > 0) {
    lines.push({ key: 'annual', kind: 'annual', label: 'Once-a-year costs', category: 'Other',
      monthly: Math.round(sumMinor(annual.map(item => item.amount)) / 12), method: `Last 12 months ÷ 12`, essentialByDefault: false })
  }

  return { throughMonth: through, averageMonths, monthsWithRecords, lines, exceptional: lastYear.filter(item => item.nature === 'exceptional') }
}

/** One line as the user confirmed it: essential or not, and its amount (null while not known). */
export interface ConfirmedLine {
  key: string
  essential: boolean
  monthly: MoneyAmount | null
}

export type EssentialsTotal =
  | { status: 'complete'; monthly: MoneyAmount }
  /** Some essential line has no amount: the total would be too low, so no target is proposed. */
  | { status: 'incomplete'; knownMonthly: MoneyAmount; missing: string[] }

export function confirmedEssentials(lines: readonly ConfirmedLine[]): EssentialsTotal {
  const essential = lines.filter(line => line.essential)
  const missing = essential.filter(line => line.monthly === null).map(line => line.key)
  const knownMonthly = sumMinor(essential.flatMap(line => (line.monthly === null ? [] : [line.monthly])))
  return missing.length > 0 ? { status: 'incomplete', knownMonthly, missing } : { status: 'complete', monthly: knownMonthly }
}

/** Essential spending per month × months, in minor units. */
export const emergencyTarget = (monthlyEssentials: MoneyAmount, months: number): MoneyAmount => Math.round(monthlyEssentials * months)

/**
 * How many months of essential spending a fund covers, rounded down to
 * one decimal, so the cover is never overstated. null without a known
 * monthly amount above 0.
 */
export function coverMonths(saved: MoneyAmount, monthlyEssentials: MoneyAmount | null): number | null {
  if (monthlyEssentials === null || monthlyEssentials <= 0) return null
  return Math.floor((Math.max(saved, 0) * 10) / monthlyEssentials) / 10
}

export interface EmergencyDraft {
  /** null: create the fund without a target. */
  target: MoneyAmount | null
  basis?: EmergencyBasis
  /** Savings the user already has and wants to count in the fund (taken from unassigned savings, never new money). */
  alreadySetAside: MoneyAmount
}

export type EmergencyResult =
  | { status: 'ok'; data: FinanceData; goalId: Id }
  | { status: 'rejected'; error: 'fund-exists' | 'invalid-target' | 'invalid-amount' | 'more-than-unassigned' }

/**
 * Creates the emergency fund from a confirmed draft. Only one fund can
 * exist: with one already there, nothing is created. Money already set
 * aside is assigned from unassigned savings (Savings does not grow), so
 * it is never counted twice.
 */
export function createEmergencyFundFromDraft(data: FinanceData, ids: { goalId: Id; movementId: Id }, owner: Owner, today: CalendarDate, draft: EmergencyDraft): EmergencyResult {
  if (emergencyFund(data.goals)) return { status: 'rejected', error: 'fund-exists' }
  if (draft.target !== null && (!Number.isSafeInteger(draft.target) || draft.target <= 0)) return { status: 'rejected', error: 'invalid-target' }
  if (!Number.isSafeInteger(draft.alreadySetAside) || draft.alreadySetAside < 0) return { status: 'rejected', error: 'invalid-amount' }
  const goal: Goal = {
    id: ids.goalId, kind: 'emergency', name: 'Emergency Fund', owner, target: draft.target, currency: data.space.currency,
    deadline: null, openingBalance: 0, createdOn: today, status: 'active', ...(draft.basis ? { emergencyBasis: draft.basis } : {}),
  }
  const created = { ...data, goals: [...data.goals, goal] }
  if (draft.alreadySetAside === 0) return { status: 'ok', data: created, goalId: goal.id }
  const moved = addGoalMovement(created, { id: ids.movementId, goalId: goal.id, effect: 'assigned', amount: draft.alreadySetAside, date: today, note: 'Already set aside' })
  if (moved.status === 'rejected') return { status: 'rejected', error: moved.error === 'more-than-unassigned' ? 'more-than-unassigned' : 'invalid-amount' }
  return { status: 'ok', data: moved.data, goalId: goal.id }
}

/** Sets the fund's target (or none) after a review. What it holds and its history stay as they are. */
export function reviewEmergencyFund(data: FinanceData, goalId: Id, target: MoneyAmount | null, basis: EmergencyBasis | null): FinanceData | null {
  const fund = data.goals.find(goal => goal.id === goalId && goal.kind === 'emergency')
  if (!fund || (target !== null && (!Number.isSafeInteger(target) || target <= 0))) return null
  return {
    ...data,
    goals: data.goals.map(goal => {
      if (goal.id !== goalId) return goal
      const next: Goal = { ...goal, target }
      if (basis) next.emergencyBasis = basis
      else delete next.emergencyBasis
      return next
    }),
  }
}

export interface EmergencyCover {
  fund: Goal | null
  saved: MoneyAmount
  /** From the fund's reviewed basis, when there is one. */
  monthlyEssentials: MoneyAmount | null
  months: number | null
}

/**
 * What the fund covers today: only what the fund holds. Other goals,
 * unassigned savings and investments are never counted automatically.
 */
export function emergencyCover(data: FinanceData, asOf?: CalendarDate): EmergencyCover {
  const fund = emergencyFund(data.goals)
  if (!fund) return { fund: null, saved: 0, monthlyEssentials: null, months: null }
  const saved = goalSaved(fund, data.goalMovements, asOf)
  const monthly = fund.emergencyBasis?.monthlyEssentials ?? null
  return { fund, saved, monthlyEssentials: monthly, months: coverMonths(saved, monthly) }
}
