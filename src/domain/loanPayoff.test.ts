import { describe, expect, it } from 'vitest'
import { calculatePayoff, compareExtraPayments, PAYOFF_LIMIT_MONTHS, type ExtraPaymentInput } from './loanPayoff'

// Synthetic test values only. 12% a year is exactly 1% a month, which keeps
// the numbers easy to check by hand.
const LOAN: ExtraPaymentInput = { balance: 12000, yearlyRate: 12, regularPayment: 1000, extraMonthly: 0, oneOffPayment: 0 }

describe('calculatePayoff', () => {
  it('estimates months and total interest for a regular payment', () => {
    // The closed formula gives 12.85 months, so the 13th payment is a partial one.
    const estimate = calculatePayoff(12000, 12, 1000)
    expect(estimate).toMatchObject({ status: 'estimated', months: 13 })
    if (estimate.status === 'estimated') expect(estimate.interest).toBeCloseTo(847.79, 2)
  })

  it('divides the balance evenly when there is no interest', () => {
    expect(calculatePayoff(12000, 0, 1000)).toEqual({ status: 'estimated', months: 12, interest: 0 })
  })

  it('needs one partial last payment when the balance does not divide evenly', () => {
    expect(calculatePayoff(1050, 0, 100)).toEqual({ status: 'estimated', months: 11, interest: 0 })
  })

  it('treats a zero balance as already paid off', () => {
    expect(calculatePayoff(0, 12, 0)).toEqual({ status: 'estimated', months: 0, interest: 0 })
  })

  it.each([
    ['a balance that is not a number', NaN, 12, 1000],
    ['an interest rate that is not a number', 12000, NaN, 1000],
    ['a payment that is not a number', 12000, 12, NaN],
    ['an infinite balance', Infinity, 12, 1000],
    ['a negative balance', -1, 12, 1000],
    ['a negative interest rate', 12000, -1, 1000],
    ['a negative payment', 12000, 12, -1],
  ])('rejects %s', (_, balance, rate, payment) => {
    expect(calculatePayoff(balance, rate, payment)).toEqual({ status: 'invalid-input' })
  })

  it('says the payment is too low when it is zero', () => {
    expect(calculatePayoff(12000, 0, 0)).toEqual({ status: 'payment-too-low' })
  })

  it('says the payment is too low when it only covers the interest', () => {
    // 1% of 12,000 is 120 a month, so the balance never goes down.
    expect(calculatePayoff(12000, 12, 120)).toEqual({ status: 'payment-too-low' })
    expect(calculatePayoff(12000, 12, 119.99)).toEqual({ status: 'payment-too-low' })
  })

  it('still estimates when the payment is only slightly above the interest', () => {
    expect(calculatePayoff(12000, 12, 121)).toMatchObject({ status: 'estimated' })
  })
})

describe('the 600-month limit', () => {
  it('is 50 years', () => {
    expect(PAYOFF_LIMIT_MONTHS).toBe(600)
  })

  it('estimates a payoff of exactly 600 months', () => {
    expect(calculatePayoff(600, 0, 1)).toEqual({ status: 'estimated', months: 600, interest: 0 })
  })

  it('reports longer-than-limit at 601 months, not a payment that is too low', () => {
    expect(calculatePayoff(601, 0, 1)).toEqual({ status: 'longer-than-limit' })
  })

  it('reports longer-than-limit when the payment covers the interest but very slowly', () => {
    // Interest is 1,000 a month; 1,001 reduces the balance, but would take about 694 months.
    expect(calculatePayoff(100000, 12, 1001)).toEqual({ status: 'longer-than-limit' })
  })

  it('estimates just inside the limit with interest', () => {
    expect(calculatePayoff(100000, 12, 1002.57)).toMatchObject({ status: 'estimated', months: 600 })
    expect(calculatePayoff(100000, 12, 1002.55)).toEqual({ status: 'longer-than-limit' })
  })
})

describe('compareExtraPayments', () => {
  it('shows the same plan twice when there is no extra payment', () => {
    const comparison = compareExtraPayments(LOAN)
    expect(comparison).toMatchObject({ status: 'compared', monthsSaved: 0, interestSaved: 0 })
    if (comparison.status === 'compared') expect(comparison.withExtra).toEqual(comparison.withoutExtra)
  })

  it('saves months and interest with an extra monthly payment', () => {
    const comparison = compareExtraPayments({ ...LOAN, extraMonthly: 200 })
    expect(comparison).toMatchObject({
      status: 'compared',
      withoutExtra: { months: 13 },
      withExtra: { months: 11 },
      monthsSaved: 2,
    })
    if (comparison.status !== 'compared') return
    expect(comparison.withoutExtra.interest).toBeCloseTo(847.79, 2)
    expect(comparison.withExtra.interest).toBeCloseTo(707.82, 2)
    expect(comparison.interestSaved).toBeCloseTo(139.97, 2)
  })

  it('saves more as the extra monthly payment grows', () => {
    const saved = [0, 100, 500, 1000].map(extraMonthly => {
      const comparison = compareExtraPayments({ ...LOAN, extraMonthly })
      return comparison.status === 'compared' ? comparison.interestSaved : NaN
    })
    expect(saved[0]).toBe(0)
    for (let i = 1; i < saved.length; i++) expect(saved[i]).toBeGreaterThan(saved[i - 1])
  })

  it('saves months and interest with a one-time payment', () => {
    const comparison = compareExtraPayments({ ...LOAN, oneOffPayment: 2000 })
    expect(comparison).toMatchObject({ status: 'compared', withExtra: { months: 11 }, monthsSaved: 2 })
    if (comparison.status === 'compared') expect(comparison.interestSaved).toBeCloseTo(257.94, 2)
  })

  it('pays everything off at once when the one-time payment equals the balance', () => {
    const comparison = compareExtraPayments({ ...LOAN, oneOffPayment: 12000 })
    expect(comparison).toMatchObject({ status: 'compared', withExtra: { months: 0, interest: 0 }, monthsSaved: 13 })
    if (comparison.status === 'compared') expect(comparison.interestSaved).toBeCloseTo(847.79, 2)
  })

  it('rejects a one-time payment above the balance', () => {
    expect(compareExtraPayments({ ...LOAN, oneOffPayment: 12000.01 })).toEqual({ status: 'one-off-above-balance' })
  })

  it.each([
    ['an extra monthly payment that is not a number', { extraMonthly: NaN }],
    ['a negative extra monthly payment', { extraMonthly: -1 }],
    ['a one-time payment that is not a number', { oneOffPayment: NaN }],
    ['a negative one-time payment', { oneOffPayment: -1 }],
    ['a balance that is not a number', { balance: NaN }],
    ['a negative interest rate', { yearlyRate: -1 }],
  ])('rejects %s', (_, change) => {
    expect(compareExtraPayments({ ...LOAN, ...change })).toEqual({ status: 'invalid-input' })
  })

  it('explains when the regular payment does not cover the interest', () => {
    expect(compareExtraPayments({ ...LOAN, regularPayment: 120, extraMonthly: 500 })).toEqual({ status: 'payment-too-low' })
  })

  it('explains when the regular plan takes longer than 600 months', () => {
    expect(compareExtraPayments({ ...LOAN, balance: 601, yearlyRate: 0, regularPayment: 1 })).toEqual({ status: 'longer-than-limit' })
  })
})
