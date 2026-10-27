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
  /** Where it came from, in the user's words (e.g. a freelance client), when there is no source. */
  note?: string
  /** True for money that will not come again, such as a tax refund. It is never treated as usual income. */
  extraordinary?: boolean
  /** The money account it arrived in, when known. */
  accountId?: Id
  /**
   * When this record was entered in the app (an ISO date and time), only
   * to list same-day records in the order they were entered. Records
   * entered before this existed and the demo's have none; it is never
   * invented for them.
   */
  recordedAt?: string
}

export const BILL_CATEGORIES = ['Housing', 'Utilities', 'Transport', 'Subscriptions', 'Loans', 'Cards', 'Education', 'Other'] as const
export type BillCategory = (typeof BILL_CATEGORIES)[number]

/** How often a bill is due. A yearly bill is due once a year, in the month of its `startMonth`. */
export type BillFrequency = 'monthly' | 'yearly'

/** The user's own view of a subscription. The app never decides it for them. */
export const SUBSCRIPTION_RATINGS = ['needed', 'adjustable', 'optional'] as const
export type SubscriptionRating = (typeof SUBSCRIPTION_RATINGS)[number]

/**
 * What is known about a subscription bill. null means "not known", which
 * is different from false ("it cannot be paused").
 */
export interface SubscriptionInfo {
  canPause: boolean | null
  canCancel: boolean | null
  /** The user's classification, or null while it is not set. */
  rating: SubscriptionRating | null
  /** A known cost to start again after a pause (0 when there is none). Absent when not known. */
  restartFee?: MoneyAmount
}

/** Something paid every month (or every year), such as rent or a subscription. */
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
  /** Monthly when absent. */
  frequency?: BillFrequency
  /** Months in which the bill is paused: it is not due then. Payments already made are never changed. */
  pausedMonths?: YearMonth[]
  /** Present on subscription bills, when the user entered it. */
  subscription?: SubscriptionInfo
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
  /** The money account it was paid from, when known. */
  paidFrom?: Id
  /**
   * Loan bills only: the interest inside this installment, as the lender
   * showed it. The rest is principal, which lowers the debt. Absent when
   * the split is not known: then the app never guesses it.
   */
  interest?: MoneyAmount
  /**
   * When the payment was marked paid in the app (an ISO date and time), only
   * to list same-day records in the order they were entered. Records
   * entered before this existed and the demo's have none; it is never
   * invented for them.
   */
  recordedAt?: string
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
  /**
   * When this record was entered in the app (an ISO date and time), only
   * to list same-day records in the order they were entered. Records
   * entered before this existed and the demo's have none; it is never
   * invented for them.
   */
  recordedAt?: string
}

export type GoalStatus = 'active' | 'archived'

/** A goal the user is saving for, or the emergency fund. */
export type GoalKind = 'goal' | 'emergency'

/** How an emergency fund target was worked out, when the user reviewed it in the app. */
export interface EmergencyBasis {
  /** Months of essential spending the target covers (1, 3 or 6, or the user's own). */
  months: number
  /** The confirmed essential spending per month the target was based on. */
  monthlyEssentials: MoneyAmount
  reviewedOn: CalendarDate
}

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
  /** Optional: null when the user has not set a target. A deadline needs a target. */
  target: MoneyAmount | null
  currency: CurrencyCode
  /** null for a flexible goal with no date. */
  deadline: CalendarDate | null
  /** What was already in the pot when the goal was created (0 for a new pot). */
  openingBalance: MoneyAmount
  createdOn: CalendarDate
  /** Archived instead of deleted, so its history is not lost. */
  status: GoalStatus
  /** Emergency fund only: how its target was worked out, if it was reviewed in the app. */
  emergencyBasis?: EmergencyBasis
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

/** What a goal movement did to Savings, in plain words (Goals and History). */
export const MOVEMENT_EFFECT_NAMES: Record<MovementEffect, string> = {
  'new-savings': 'New savings',
  assigned: 'From unassigned savings',
  unassigned: 'Back to unassigned savings',
  'taken-out': 'Taken out of savings',
}

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
  /**
   * When this record was entered in the app (an ISO date and time), only
   * to list same-day records in the order they were entered. Records
   * entered before this existed and the demo's have none; it is never
   * invented for them.
   */
  recordedAt?: string
}

/**
 * Spending categories. Bills keep their own categories; for spending they
 * are shown in these groups (loan and card bills only add their interest).
 */
export const SPENDING_CATEGORIES = ['Housing', 'Utilities', 'Groceries', 'Eating Out', 'Transport', 'Health', 'Subscriptions', 'Leisure',
  'Shopping', 'Gifts', 'Education', 'Home', 'Interest & Fees', 'Other'] as const
export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number]

/**
 * regular: everyday or monthly spending. annual: once a year (insurance,
 * a yearly plan). exceptional: an unexpected or one-off cost, such as an
 * urgent repair. Used to tell usual spending apart from one-off months.
 */
export const SPENDING_NATURES = ['regular', 'annual', 'exceptional'] as const
export type SpendingNature = (typeof SPENDING_NATURES)[number]

/**
 * Money spent that is not a bill: groceries, a taxi, a repair. Paid from
 * a money account, or with a card (then it is new card debt, and paying the
 * card later is not spent again).
 */
export interface Expense {
  id: Id
  date: CalendarDate
  /** Always above 0. */
  amount: MoneyAmount
  currency: CurrencyCode
  category: SpendingCategory
  description: string
  /** A money account, or a card (a debt of kind 'card'). */
  accountId: Id
  nature: SpendingNature
  /**
   * When this record was entered in the app (an ISO date and time), only
   * to list same-day records in the order they were entered. Records
   * entered before this existed and the demo's have none; it is never
   * invented for them.
   */
  recordedAt?: string
}

/**
 * Money moved between two of the user's own money accounts. It is never
 * income or spending: one account goes down, the other goes up.
 */
export interface Transfer {
  id: Id
  date: CalendarDate
  /** Always above 0. */
  amount: MoneyAmount
  currency: CurrencyCode
  fromAccountId: Id
  toAccountId: Id
  note: string
  /**
   * When this record was entered in the app (an ISO date and time), only
   * to list same-day records in the order they were entered. Records
   * entered before this existed and the demo's have none; it is never
   * invented for them.
   */
  recordedAt?: string
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
  schemaVersion: 3
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
  expenses: Expense[]
  transfers: Transfer[]
}
