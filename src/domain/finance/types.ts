import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import type { CurrencyCode } from '../money'
import type { YearMonth } from '../calendar'

/**
 * The financial data of one space (Individual, Duo or Group), as the app
 * keeps it. Every amount is a whole number of minor units (grosze, cents)
 * with its currency next to it. Totals are never stored: they are always
 * calculated from these records, so they can never disagree with them.
 */

/** Ids are stable text keys, so records can point at each other. */
export type Id = string

/** How many people share the space (Individual, Duo or Group). It is not a price plan. */
export type SpaceMode = 'individual' | 'duo' | 'group'

export interface Member {
  id: Id
  name: string
  /** The person's colour in charts, e.g. '#3B82F6'. */
  color: string
}

/**
 * Who a record belongs to: one member, or everyone in the space. It says
 * nothing about who pays it or who may see it; those are separate rules.
 */
export type Owner = Id | 'shared'

export interface Space {
  id: Id
  name: string
  mode: SpaceMode
  /** The currency every record in this space uses (see `validate.ts`). */
  currency: CurrencyCode
  members: Member[]
}

/**
 * Income a member expects every month, such as a salary or a grant, and
 * the day it usually arrives. It is a plan, not money received: Home
 * labels it as expected until an IncomeEntry records what really came in.
 */
export interface IncomeSource {
  id: Id
  memberId: Id
  name: string
  /** The usual net amount per month. */
  amount: MoneyAmount
  currency: CurrencyCode
  /** Day of the month it usually arrives, 1 to 31. */
  payDay: number
  startMonth: YearMonth
  endMonth: YearMonth | null
}

/** Money one member actually received. Expected income is never recorded here. */
export interface IncomeEntry {
  id: Id
  memberId: Id
  /** The income source it came from, if any. */
  sourceId?: Id
  /** The month the income counts for. */
  month: YearMonth
  /** The day it arrived. Kept apart from `month`: they can differ. */
  receivedOn: CalendarDate
  amount: MoneyAmount
  currency: CurrencyCode
}

export const BILL_CATEGORIES = ['Housing', 'Utilities', 'Transport', 'Subscriptions', 'Loans', 'Cards', 'Education', 'Other'] as const
export type BillCategory = (typeof BILL_CATEGORIES)[number]

/** Something paid every month, such as rent or a subscription. */
export interface RecurringBill {
  id: Id
  name: string
  category: BillCategory
  owner: Owner
  /** The usual monthly amount from `startMonth`, or null when it changes and is not known yet. */
  amount: MoneyAmount | null
  /**
   * Later changes to the usual amount, each from its month on, oldest
   * first. Months before a change keep the amount they had.
   */
  amountChanges?: { from: YearMonth; amount: MoneyAmount | null }[]
  currency: CurrencyCode
  /** Day of the month it is due, 1 to 31. Short months use their last day. */
  dueDay: number
  /** First month the bill is due. */
  startMonth: YearMonth
  /** Last month it is due (e.g. a loan's final installment), or null if it has no end. */
  endMonth: YearMonth | null
  /**
   * The loan or card this bill pays, if any. The bill is then the one place
   * that holds the monthly payment, so it is counted once. Paying the bill
   * never changes that debt's balance.
   */
  debtId?: Id
  /** Free text, e.g. what a subscriptions bill covers. */
  note?: string
}

/**
 * What is known about one bill in one month. Months without a record use
 * the bill's usual amount and are unpaid. Each month is separate, so
 * changing one never changes another.
 */
export interface BillMonth {
  billId: Id
  month: YearMonth
  /** Replaces the usual amount for this month only. null means "amount not known". Absent means "use the usual amount". */
  amount?: MoneyAmount | null
  paid: boolean
  /** The day it was marked paid, when known. */
  paidOn?: CalendarDate
}

export type DebtKind = 'card' | 'loan'

export interface DebtAccount {
  id: Id
  kind: DebtKind
  name: string
  owner: Owner
  currency: CurrencyCode
  /** Yearly interest in hundredths of a percent: 14.5% is 1450. */
  yearlyInterestBasisPoints: number
  /** Day of the month the payment is due. */
  dueDay: number
  /** Cards only: the day the statement closes. */
  closingDay?: number
  /**
   * Cards only: the minimum payment as the user read it on the statement.
   * It is an entered amount; the app has no rule to calculate it.
   */
  minimumPayment?: MoneyAmount
  /**
   * The planned monthly payment, only for a debt that no bill pays. When a
   * bill is linked (bill.debtId), the bill's amount is the payment.
   */
  monthlyPayment?: MoneyAmount
  /** Loans only: the month of the first installment. */
  startMonth?: YearMonth
  /** Loans only: the month of the last installment, as agreed. */
  finalPaymentMonth?: YearMonth
}

/**
 * Daily Spending: everyday money. Investment: invested money. Savings:
 * saved money (a savings account, a piggy bank), which the user can divide
 * by purpose with goals and an emergency fund.
 */
export const MONEY_ACCOUNT_KINDS = ['daily-spending', 'investment', 'savings', 'other'] as const
export type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number]

/** Money the household has somewhere: an everyday account, investments, cash. */
export interface MoneyAccount {
  id: Id
  kind: MoneyAccountKind
  name: string
  owner: Owner
  currency: CurrencyCode
}

/**
 * A balance the user entered, and the date it was true on. Used for debts
 * (what is still owed) and money accounts (what is there). A new balance
 * is a new snapshot: earlier ones stay as history and are never invented.
 */
export interface BalanceSnapshot {
  id: Id
  accountId: Id
  asOf: CalendarDate
  amount: MoneyAmount
  currency: CurrencyCode
  /**
   * Where the balance came from: typed by the user, or worked out from a
   * goal movement that recorded new savings or money taken out.
   */
  source: 'entered' | 'goal-movement'
  /** The goal movement behind it, when source is 'goal-movement'. */
  movementId?: Id
}

export type GoalStatus = 'active' | 'archived'

/** A goal the user is saving for, or the emergency fund (which has no target). */
export type GoalKind = 'goal' | 'emergency'

/**
 * A savings pot: a purpose for part of the money in Savings. What is saved
 * is never stored here: it is the opening balance plus the pot's
 * movements. It is part of Savings, never extra money on top of it.
 */
export interface Goal {
  id: Id
  kind: GoalKind
  name: string
  owner: Owner
  /** Required for a goal; null only for the emergency fund. */
  target: MoneyAmount | null
  currency: CurrencyCode
  /** null for a flexible goal with no date. */
  deadline: CalendarDate | null
  /** What was already in the pot when the goal was created (0 for a new pot). */
  openingBalance: MoneyAmount
  createdOn: CalendarDate
  /** Archived instead of deleted, so its history is not lost. */
  status: GoalStatus
}

/**
 * What a goal movement does to Savings. Only the record changes: no bank
 * transfer happens.
 * - new-savings: money saved now. The pot and the savings account grow.
 * - assigned: savings that were already there (unassigned) go to the pot.
 * - unassigned: money leaves the pot and stays in Savings, unassigned.
 * - taken-out: money leaves the pot and the savings account (spent or moved out).
 */
export const MOVEMENT_EFFECTS = ['new-savings', 'assigned', 'unassigned', 'taken-out'] as const
export type MovementEffect = (typeof MOVEMENT_EFFECTS)[number]

/** Money put into a pot (positive) or taken out of it (negative). No bank transfer happens. */
export interface GoalMovement {
  id: Id
  goalId: Id
  date: CalendarDate
  amount: MoneyAmount
  note: string
  effect: MovementEffect
  /** The savings account that grew or shrank (new-savings and taken-out only). */
  accountId?: Id
}

export type Language = 'en' | 'es' | 'pl'
export type Theme = 'system' | 'light' | 'dark' | 'day-night'

export interface Preferences {
  language: Language
  theme: Theme
  /** The currency the user prefers to see. Amounts are never converted without a real exchange rate. */
  displayCurrency: CurrencyCode
}

export interface FinanceData {
  schemaVersion: 2
  space: Space
  preferences: Preferences
  incomeSources: IncomeSource[]
  income: IncomeEntry[]
  bills: RecurringBill[]
  billMonths: BillMonth[]
  debts: DebtAccount[]
  moneyAccounts: MoneyAccount[]
  balances: BalanceSnapshot[]
  goals: Goal[]
  goalMovements: GoalMovement[]
}
