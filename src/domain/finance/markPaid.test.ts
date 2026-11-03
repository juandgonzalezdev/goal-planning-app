import { describe, expect, it } from 'vitest'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../../data/fixtures/demoAlex'
import { validateFinanceData } from '../../data/validate'
import { billsForMonth, markBillNotPaid, markBillPaid, validatePayment, type PaymentFields } from './bills'
import { summarizeDebts } from './debts'
import { accountFlows } from './flows'
import { monthSpending } from './spending'
import type { FinanceData } from './types'

// Mark as Paid (M1) as one change: the month's amount, the date, the account and, for a loan,
// the interest from the statement. It never guesses interest and never changes a Remaining Balance.
const TODAY = ALEX_DEMO_TODAY
const record = (data: FinanceData, billId: string, month: string) => data.billMonths.find(item => item.billId === billId && item.month === month)
const occurrence = (data: FinanceData, billId: string, month: string) => billsForMonth(data, month).find(item => item.bill.id === billId)!
const fields = (patch: Partial<PaymentFields> = {}): PaymentFields => ({ amount: 6_999, paidOn: '2026-12-30', paidFrom: 'everyday', interest: null, ...patch })
/** Alex's December Small Loan payment, not paid again. */
const unpaidLoan = () => markBillNotPaid(createAlexDemo(), 'small-loan-payment', '2026-12')

describe('markBillPaid', () => {
  it.each(['2026-02-29', '2026-02-30', '2026-04-31'])('rejects the impossible date %s without changing data', paidOn => {
    const data = createAlexDemo()
    expect(validatePayment(data, 'phone', '2026-12', fields({ paidOn }), TODAY)).toContain('invalid-date')
    expect(markBillPaid(data, 'phone', '2026-12', fields({ paidOn }), TODAY)).toBe(data)
  })
  it('records paid, the date and the account in one change, and keeps the usual amount when it is the same', () => {
    const before = createAlexDemo()
    const after = markBillPaid(before, 'phone', '2026-12', fields(), TODAY)
    expect(record(after, 'phone', '2026-12')).toMatchObject({ paid: true, paidOn: '2026-12-30', paidFrom: 'everyday' })
    expect(record(after, 'phone', '2026-12')).not.toHaveProperty('amount')
    expect(after.bills).toBe(before.bills)
    expect(validateFinanceData(after)).toMatchObject({ status: 'valid' })
  })

  it('a different amount changes only that month; the usual amount again needs no amount of its own', () => {
    const changed = markBillPaid(createAlexDemo(), 'phone', '2026-12', fields({ amount: 7_500 }), TODAY)
    expect(occurrence(changed, 'phone', '2026-12').amount).toBe(7_500)
    expect(occurrence(changed, 'phone', '2026-11').amount).toBe(6_999)
    const back = markBillPaid(markBillNotPaid(changed, 'phone', '2026-12'), 'phone', '2026-12', fields({ amount: 6_999 }), TODAY)
    expect(record(back, 'phone', '2026-12')).not.toHaveProperty('amount')
  })

  it('Not sure keeps no account, so the payment does not move any account', () => {
    const after = markBillPaid(createAlexDemo(), 'phone', '2026-12', fields({ paidFrom: null }), TODAY)
    expect(record(after, 'phone', '2026-12')).not.toHaveProperty('paidFrom')
    expect(accountFlows(after, ['2026-12']).filter(flow => flow.kind === 'bill' && flow.label === 'Phone & Internet')).toEqual([])
    const known = markBillPaid(createAlexDemo(), 'phone', '2026-12', fields(), TODAY)
    expect(accountFlows(known, ['2026-12']).filter(flow => flow.kind === 'bill' && flow.label === 'Phone & Internet'))
      .toEqual([expect.objectContaining({ accountId: 'everyday', amount: -6_999, date: '2026-12-30' })])
  })

  it('counts a loan’s interest in Spent only when it is given, and never changes the Remaining Balance', () => {
    const base = unpaidLoan()
    const owed = summarizeDebts(base, TODAY)
    const without = markBillPaid(base, 'small-loan-payment', '2026-12', fields({ amount: 27_660, paidOn: '2026-12-15' }), TODAY)
    expect(record(without, 'small-loan-payment', '2026-12')).not.toHaveProperty('interest')
    expect(monthSpending(without, '2026-12').items.some(item => item.source === 'loan-interest' && item.billId === 'small-loan-payment')).toBe(false)
    const withInterest = markBillPaid(base, 'small-loan-payment', '2026-12', fields({ amount: 27_660, paidOn: '2026-12-15', interest: 1_840 }), TODAY)
    expect(monthSpending(withInterest, '2026-12').items.find(item => item.source === 'loan-interest' && item.billId === 'small-loan-payment')?.amount).toBe(1_840)
    expect(summarizeDebts(withInterest, TODAY)).toEqual(owed)
    expect(withInterest.balances).toBe(base.balances)
    expect(withInterest.debts).toBe(base.debts)
  })

  it('refuses what it cannot record, and then changes nothing', () => {
    const data = createAlexDemo()
    const check = (patch: Partial<PaymentFields>, billId = 'phone', month = '2026-12') => validatePayment(data, billId, month, fields(patch), TODAY)
    expect(check({ paidOn: '2027-01-02' })).toEqual(['date-after-today'])
    expect(check({ paidOn: '2026-13-40' })).toEqual(['invalid-date'])
    expect(check({ amount: -1 })).toEqual(['invalid-amount'])
    expect(check({ amount: 12.5 })).toEqual(['invalid-amount'])
    expect(check({ paidFrom: 'credit-card' })).toEqual(['unknown-account'])
    expect(check({ interest: 100 })).toEqual(['interest-not-loan'])
    expect(check({ interest: 100 }, 'card-payment')).toEqual(['interest-not-loan'])
    expect(check({ amount: 27_660, interest: 30_000 }, 'small-loan-payment')).toEqual(['interest-above-amount'])
    expect(check({}, 'video')).toEqual(['not-due'])
    expect(markBillPaid(data, 'phone', '2026-12', fields({ paidOn: '2027-01-02' }), TODAY)).toBe(data)
  })
})

describe('markBillNotPaid', () => {
  it('removes the date, the account and the interest, and keeps the month’s amount', () => {
    const paid = markBillPaid(unpaidLoan(), 'small-loan-payment', '2026-12', fields({ amount: 28_000, paidOn: '2026-12-15', interest: 1_840 }), TODAY)
    const unpaid = markBillNotPaid(paid, 'small-loan-payment', '2026-12')
    expect(record(unpaid, 'small-loan-payment', '2026-12')).toEqual({ billId: 'small-loan-payment', month: '2026-12', paid: false, amount: 28_000 })
    expect(validateFinanceData(unpaid)).toMatchObject({ status: 'valid' })
  })
})
