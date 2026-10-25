import type { BillMonth, FinanceData } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'

/**
 * The public demo: Alex, an invented university student with an
 * Individual space. Every person, amount and date here is invented.
 *
 * Amounts set by the Product Owner (never change them to make an example fit):
 * - Net income 6,500.00 PLN a month, arriving on the 1st.
 * - Seven monthly bills, 5,750.00 PLN in total: Rent 4,000 (2nd),
 *   Utilities 700 (5th), Transport 200 (6th), Subscriptions 80 (10th),
 *   Small Loan 320 (15th), Credit Card Payment 200 (22nd), Student Loan 250 (25th).
 * - Credit Card: Remaining Balance 1,800, statement closes on the 20th, payment on the 22nd.
 * - Student Loan: Remaining Balance 12,000.
 * - Goals: Trip to Japan (flexible) 600 of 10,000; Christmas Gift
 *   (24 Dec 2026) 100 saved; Emergency Fund 300.
 *
 * Values added for the demo (documented in docs/demo-alex.md):
 * - Demo date 23 Oct 2026. October income received on 1 Oct. October bills
 *   up to the 22nd are paid (on their due date); Student Loan (25th) is
 *   not paid yet, so 250 is left to pay. November has nothing paid.
 * - Small Loan: 3,600 still owed on 15 Oct, 9.90% a year, Nov 2025 to Oct 2027.
 * - Student Loan: 2.00% a year, Oct 2024 to Dec 2030, balance as of 1 Oct.
 * - Credit Card: 18.50% a year, minimum payment 90 as read on the
 *   statement (entered, no rule), balance as of 23 Oct.
 * - Christmas Gift target 400. Emergency Fund has no target.
 * - Accounts: Everyday Account 820 (Daily Spending), Investment Account
 *   500, Savings Account 1,200 and Piggy Bank 150 (Savings 1,350, of which
 *   1,000 has a purpose and 350 is unassigned).
 * - Subscriptions cover Music 25, Video 40 and Cloud Storage 15.
 */
export const ALEX_DEMO_TODAY: CalendarDate = '2026-10-23'

const PAID_IN_OCTOBER: [string, CalendarDate][] = [
  ['rent', '2026-10-02'],
  ['utilities', '2026-10-05'],
  ['transport', '2026-10-06'],
  ['subscriptions', '2026-10-10'],
  ['small-loan-payment', '2026-10-15'],
  ['card-payment', '2026-10-22'],
]

export function createAlexDemo(): FinanceData {
  const bill = (id: string, name: string, category: FinanceData['bills'][number]['category'], amount: number, dueDay: number, extra: Partial<FinanceData['bills'][number]> = {}) =>
    ({ id, name, category, owner: 'alex', amount, currency: 'PLN' as const, dueDay, startMonth: '2026-10', endMonth: null, ...extra })
  return {
    schemaVersion: 2,
    space: { id: 'demo-alex', name: 'Alex', mode: 'individual', currency: 'PLN', members: [{ id: 'alex', name: 'Alex', color: '#3B82F6' }] },
    preferences: { language: 'en', theme: 'system', displayCurrency: 'PLN' },
    incomeSources: [
      { id: 'net-income', memberId: 'alex', name: 'Net Income', amount: 650_000, currency: 'PLN', payDay: 1, startMonth: '2026-10', endMonth: null },
    ],
    income: [
      { id: 'income-2026-10', memberId: 'alex', sourceId: 'net-income', month: '2026-10', receivedOn: '2026-10-01', amount: 650_000, currency: 'PLN' },
    ],
    bills: [
      bill('rent', 'Rent', 'Housing', 400_000, 2),
      bill('utilities', 'Utilities', 'Utilities', 70_000, 5),
      bill('transport', 'Transport', 'Transport', 20_000, 6, { note: 'Monthly student transit pass' }),
      bill('subscriptions', 'Subscriptions', 'Subscriptions', 8_000, 10, { note: 'Music 25 PLN, Video 40 PLN, Cloud Storage 15 PLN' }),
      bill('small-loan-payment', 'Small Loan', 'Loans', 32_000, 15, { debtId: 'small-loan', endMonth: '2027-10' }),
      bill('card-payment', 'Credit Card Payment', 'Cards', 20_000, 22, { debtId: 'credit-card' }),
      bill('student-loan-payment', 'Student Loan', 'Loans', 25_000, 25, { debtId: 'student-loan', endMonth: '2030-12' }),
    ],
    billMonths: PAID_IN_OCTOBER.map(([billId, paidOn]): BillMonth => ({ billId, month: '2026-10', paid: true, paidOn })),
    debts: [
      { id: 'credit-card', kind: 'card', name: 'Credit Card', owner: 'alex', currency: 'PLN', yearlyInterestBasisPoints: 1850, dueDay: 22, closingDay: 20, minimumPayment: 9_000 },
      { id: 'student-loan', kind: 'loan', name: 'Student Loan', owner: 'alex', currency: 'PLN', yearlyInterestBasisPoints: 200, dueDay: 25, startMonth: '2024-10', finalPaymentMonth: '2030-12' },
      { id: 'small-loan', kind: 'loan', name: 'Small Loan', owner: 'alex', currency: 'PLN', yearlyInterestBasisPoints: 990, dueDay: 15, startMonth: '2025-11', finalPaymentMonth: '2027-10' },
    ],
    moneyAccounts: [
      { id: 'everyday', kind: 'daily-spending', name: 'Everyday Account', owner: 'alex', currency: 'PLN' },
      { id: 'investments', kind: 'investment', name: 'Investment Account', owner: 'alex', currency: 'PLN' },
      { id: 'savings-account', kind: 'savings', name: 'Savings Account', owner: 'alex', currency: 'PLN' },
      { id: 'piggy-bank', kind: 'savings', name: 'Piggy Bank', owner: 'alex', currency: 'PLN' },
    ],
    balances: [
      { id: 'balance-card', accountId: 'credit-card', asOf: '2026-10-23', amount: 180_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-student-loan', accountId: 'student-loan', asOf: '2026-10-01', amount: 1_200_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-small-loan', accountId: 'small-loan', asOf: '2026-10-15', amount: 360_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-everyday', accountId: 'everyday', asOf: '2026-10-23', amount: 82_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-investments', accountId: 'investments', asOf: '2026-10-01', amount: 50_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-savings-account', accountId: 'savings-account', asOf: '2026-10-20', amount: 120_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-piggy-bank', accountId: 'piggy-bank', asOf: '2026-10-23', amount: 15_000, currency: 'PLN', source: 'entered' },
    ],
    // What was saved before Alex started using the app is the opening
    // balance: it is already in Savings, so it is not taken from income again.
    goals: [
      { id: 'trip-to-japan', kind: 'goal', name: 'Trip to Japan', owner: 'alex', target: 1_000_000, currency: 'PLN', deadline: null, openingBalance: 60_000, createdOn: '2026-10-01', status: 'active' },
      { id: 'christmas-gift', kind: 'goal', name: 'Christmas Gift', owner: 'alex', target: 40_000, currency: 'PLN', deadline: '2026-12-24', openingBalance: 10_000, createdOn: '2026-10-01', status: 'active' },
      { id: 'emergency-fund', kind: 'emergency', name: 'Emergency Fund', owner: 'alex', target: null, currency: 'PLN', deadline: null, openingBalance: 30_000, createdOn: '2026-10-01', status: 'active' },
    ],
    goalMovements: [],
  }
}
