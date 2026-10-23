import type { CalendarDate } from '../goalTime'
import type { MoneyAmount } from '../goalAmounts'
import type { CurrencyCode } from '../money'
import type { YearMonth } from '../calendar'

/**
 * The financial data of one space (Personal, Duo or Group), as the app
 * keeps it. Every amount is a whole number of minor units (grosze, cents)
 * with its currency next to it. Totals are never stored: they are always
 * calculated from these records, so they can never disagree with them.
 */

/** Ids are stable text keys, so records can point at each other. */
export type Id = string

/** How many people share the space. It is not a price plan. */
export type SpaceMode = 'personal' | 'duo' | 'group'

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

/** Money one member actually received. Expected income is never recorded here. */
export interface IncomeEntry {
  id: Id
  memberId: Id
  /** The month the income counts for. */
  month: YearMonth
  /** The day it arrived. Kept apart from `month`: they can differ. */
  receivedOn: CalendarDate
  amount: MoneyAmount
  currency: CurrencyCode
}

export const BILL_CATEGORIES = ['Housing', 'Loans', 'Education', 'Subscriptions', 'Utilities', 'Other'] as const
export type BillCategory = (typeof BILL_CATEGORIES)[number]

/** Something paid every month, such as rent or a subscription. */
export interface RecurringBill {
  id: Id
  name: string
  category: BillCategory
  owner: Owner
  /** The usual monthly amount, or null when it changes and is not known yet. */
  amount: MoneyAmount | null
  currency: CurrencyCode
  /** Day of the month it is due, 1 to 31. Short months use their last day. */
  dueDay: number
  /** First month the bill is due. */
  startMonth: YearMonth
  /** Last month it is due (e.g. a loan's final installment), or null if it has no end. */
  endMonth: YearMonth | null
  /** The loan or card this bill pays, if any. Paying the bill never changes that debt's balance. */
  debtId?: Id
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
  /** Loans only: the agreed monthly installment. */
  monthlyPayment?: MoneyAmount
  /** Loans only: the month of the last installment. */
  finalPaymentMonth?: YearMonth
}

export const MONEY_ACCOUNT_KINDS = ['daily-spending', 'investment', 'emergency', 'other'] as const
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
}

export type GoalStatus = 'active' | 'archived'

/**
 * A savings pot. What is saved is never stored here: it is the opening
 * balance plus the pot's movements. A goal sets money aside; it is not
 * extra money on top of the household's accounts.
 */
export interface Goal {
  id: Id
  name: string
  owner: Owner
  target: MoneyAmount
  currency: CurrencyCode
  /** null for a flexible goal with no date. */
  deadline: CalendarDate | null
  /** What was already in the pot when the goal was created (0 for a new pot). */
  openingBalance: MoneyAmount
  createdOn: CalendarDate
  /** Archived instead of deleted, so its history is not lost. */
  status: GoalStatus
}

/** Money put into a pot (positive) or taken out of it (negative). No bank transfer happens. */
export interface GoalMovement {
  id: Id
  goalId: Id
  date: CalendarDate
  amount: MoneyAmount
  note: string
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
  schemaVersion: 1
  space: Space
  preferences: Preferences
  income: IncomeEntry[]
  bills: RecurringBill[]
  billMonths: BillMonth[]
  debts: DebtAccount[]
  moneyAccounts: MoneyAccount[]
  balances: BalanceSnapshot[]
  goals: Goal[]
  goalMovements: GoalMovement[]
}
