/**
 * Informational payoff estimates for a loan or credit card.
 *
 * Amounts are decimal units (for example 120.5 means 120.50); the card or
 * loan screen converts its minor units before calling. Interest is the yearly rate divided by 12, charged each month
 * on the outstanding balance. The estimate assumes the same rate and
 * payment every month and no new borrowing.
 */

/** The longest payoff this estimate calculates: 50 years. */
export const PAYOFF_LIMIT_MONTHS = 600

/** Below this the balance counts as fully paid (half a grosz). */
const PAID_OFF_TOLERANCE = 0.005

export type PayoffEstimate =
  | { status: 'estimated'; months: number; interest: number }
  /** A value is missing, not a number, or negative. */
  | { status: 'invalid-input' }
  /** The payment is zero or does not exceed the first month's interest, so the balance never goes down. */
  | { status: 'payment-too-low' }
  /** The balance goes down, but paying it off takes more than PAYOFF_LIMIT_MONTHS. */
  | { status: 'longer-than-limit' }

export function calculatePayoff(balance: number, yearlyRate: number, payment: number): PayoffEstimate {
  if (![balance, yearlyRate, payment].every(Number.isFinite) || balance < 0 || yearlyRate < 0 || payment < 0) {
    return { status: 'invalid-input' }
  }
  if (balance === 0) return { status: 'estimated', months: 0, interest: 0 }
  const r = yearlyRate / 1200
  if (payment <= balance * r || payment === 0) return { status: 'payment-too-low' }
  let outstanding = balance, interest = 0, months = 0
  while (outstanding > PAID_OFF_TOLERANCE && months < PAYOFF_LIMIT_MONTHS) {
    const charge = outstanding * r
    const paid = Math.min(outstanding + charge, payment)
    interest += charge
    outstanding = Math.max(0, outstanding + charge - paid)
    months++
  }
  return outstanding <= PAID_OFF_TOLERANCE
    ? { status: 'estimated', months, interest }
    : { status: 'longer-than-limit' }
}

export interface ExtraPaymentInput {
  balance: number
  yearlyRate: number
  regularPayment: number
  /** Added to the regular payment every month. */
  extraMonthly: number
  /** Paid once, straight away, before the first monthly payment. */
  oneOffPayment: number
}

export type ExtraPaymentComparison =
  | {
      status: 'compared'
      withoutExtra: { months: number; interest: number }
      withExtra: { months: number; interest: number }
      monthsSaved: number
      interestSaved: number
    }
  | { status: 'invalid-input' }
  | { status: 'one-off-above-balance' }
  /** Why the regular plan, without extra, cannot be estimated. */
  | { status: 'payment-too-low' }
  | { status: 'longer-than-limit' }

/**
 * Compares paying the regular amount with paying extra. Extra payments
 * shorten the loan; they never lower the regular payment.
 */
export function compareExtraPayments(input: ExtraPaymentInput): ExtraPaymentComparison {
  const { balance, yearlyRate, regularPayment, extraMonthly, oneOffPayment } = input
  if (![extraMonthly, oneOffPayment].every(Number.isFinite) || extraMonthly < 0 || oneOffPayment < 0) {
    return { status: 'invalid-input' }
  }
  const withoutExtra = calculatePayoff(balance, yearlyRate, regularPayment)
  if (withoutExtra.status === 'invalid-input') return withoutExtra
  if (oneOffPayment > balance) return { status: 'one-off-above-balance' }
  if (withoutExtra.status !== 'estimated') return withoutExtra

  // A lower balance and a higher payment can only be paid off sooner.
  const withExtra = calculatePayoff(balance - oneOffPayment, yearlyRate, regularPayment + extraMonthly)
  if (withExtra.status !== 'estimated') return { status: 'invalid-input' }

  return {
    status: 'compared',
    withoutExtra: { months: withoutExtra.months, interest: withoutExtra.interest },
    withExtra: { months: withExtra.months, interest: withExtra.interest },
    monthsSaved: Math.max(0, withoutExtra.months - withExtra.months),
    interestSaved: Math.max(0, withoutExtra.interest - withExtra.interest),
  }
}
