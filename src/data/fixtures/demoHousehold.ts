import type { BillMonth, FinanceData, IncomeEntry } from '../../domain/finance/types'

/**
 * Demo household: invented people and amounts only. It has the same shape
 * as the approved Demo v5.9 data, including its tricky cases (a bill whose
 * amount is not known yet, loans that end, a due day of 31, a card with an
 * older balance). The two goals are the approved example goals, empty.
 *
 * A real user's space never starts with this data. Since the Alex demo
 * (see demoAlex.ts) the app opens the Individual demo; this Duo household
 * stays as a test fixture for the Duo screens.
 */
export const DEMO_TODAY = '2026-10-23'

const ALEX_INCOME = [500_000, 500_000, 520_000, 520_000, 520_000, 540_050, 540_050, 540_050, 560_025, 560_025]
const JORDAN_INCOME = [610_010, 610_010, 610_010, 610_010, 610_010, 610_010, 910_010, 610_010, 610_010, 610_010]

const income: IncomeEntry[] = ALEX_INCOME.flatMap((alex, index) => {
  const month = `2026-${String(index + 1).padStart(2, '0')}`
  return [
    { id: `income-alex-${month}`, memberId: 'alex', month, receivedOn: `${month}-08`, amount: alex, currency: 'PLN' },
    { id: `income-jordan-${month}`, memberId: 'jordan', month, receivedOn: `${month}-09`, amount: JORDAN_INCOME[index], currency: 'PLN' },
  ]
})

export function createDemoHousehold(): FinanceData {
  return {
    schemaVersion: 2,
    space: {
      id: 'demo-space',
      name: 'Demo Household',
      mode: 'duo',
      currency: 'PLN',
      members: [
        { id: 'alex', name: 'Alex', color: '#3B82F6' },
        { id: 'jordan', name: 'Jordan', color: '#10B981' },
      ],
    },
    preferences: { language: 'en', theme: 'system', displayCurrency: 'PLN' },
    incomeSources: [],
    income: structuredClone(income),
    bills: [
      { id: 'furniture-loan', name: 'Furniture Loan', category: 'Loans', owner: 'shared', amount: 15_000, currency: 'PLN', dueDay: 5, startMonth: '2026-10', endMonth: '2027-06', debtId: 'furniture' },
      { id: 'language-course', name: 'Language Course', category: 'Education', owner: 'jordan', amount: 30_000, currency: 'PLN', dueDay: 7, startMonth: '2026-10', endMonth: null },
      { id: 'bank-plan', name: 'Bank Plan', category: 'Subscriptions', owner: 'shared', amount: 3_000, currency: 'PLN', dueDay: 7, startMonth: '2026-10', endMonth: null },
      { id: 'streaming', name: 'Streaming', category: 'Subscriptions', owner: 'shared', amount: 4_500, currency: 'PLN', dueDay: 8, startMonth: '2026-10', endMonth: null },
      { id: 'rent', name: 'Rent', category: 'Housing', owner: 'shared', amount: 240_000, currency: 'PLN', dueDay: 10, startMonth: '2026-10', endMonth: null },
      { id: 'building-fees', name: 'Building Fees', category: 'Housing', owner: 'shared', amount: 60_000, currency: 'PLN', dueDay: 10, startMonth: '2026-10', endMonth: null },
      { id: 'car-loan', name: 'Car Loan', category: 'Loans', owner: 'shared', amount: 180_000, currency: 'PLN', dueDay: 12, startMonth: '2026-10', endMonth: '2028-10', debtId: 'car' },
      { id: 'music', name: 'Music', category: 'Subscriptions', owner: 'shared', amount: 2_599, currency: 'PLN', dueDay: 17, startMonth: '2026-10', endMonth: null },
      { id: 'phone', name: 'Phone & Internet', category: 'Utilities', owner: 'shared', amount: null, currency: 'PLN', dueDay: 22, startMonth: '2026-10', endMonth: null },
      { id: 'gym', name: 'Gym', category: 'Other', owner: 'alex', amount: 9_999, currency: 'PLN', dueDay: 31, startMonth: '2026-10', endMonth: null },
    ],
    // October is all paid. Phone & Internet's October bill was 120.45;
    // November's amount is not known yet, so November has no record.
    billMonths: [
      ...['furniture-loan', 'language-course', 'bank-plan', 'streaming', 'rent', 'building-fees', 'car-loan', 'music', 'gym']
        .map((billId): BillMonth => ({ billId, month: '2026-10', paid: true })),
      { billId: 'phone', month: '2026-10', paid: true, amount: 12_045 },
    ],
    debts: [
      { id: 'card', kind: 'card', name: 'Credit Card', owner: 'shared', currency: 'PLN', yearlyInterestBasisPoints: 1800, dueDay: 15, closingDay: 22 },
      { id: 'car', kind: 'loan', name: 'Car Loan', owner: 'shared', currency: 'PLN', yearlyInterestBasisPoints: 850, dueDay: 12, finalPaymentMonth: '2028-10' },
      { id: 'furniture', kind: 'loan', name: 'Furniture Loan', owner: 'shared', currency: 'PLN', yearlyInterestBasisPoints: 0, dueDay: 5, finalPaymentMonth: '2027-06' },
    ],
    moneyAccounts: [
      { id: 'everyday', kind: 'daily-spending', name: 'Everyday Account', owner: 'shared', currency: 'PLN' },
      { id: 'investments', kind: 'investment', name: 'Investment Account', owner: 'jordan', currency: 'PLN' },
      { id: 'emergency-cash', kind: 'savings', name: 'Emergency Cash', owner: 'shared', currency: 'PLN' },
    ],
    balances: [
      { id: 'balance-card-2026-09', accountId: 'card', asOf: '2026-09-23', amount: 340_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-card-2026-10', accountId: 'card', asOf: DEMO_TODAY, amount: 325_040, currency: 'PLN', source: 'entered' },
      { id: 'balance-car', accountId: 'car', asOf: DEMO_TODAY, amount: 4_200_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-furniture', accountId: 'furniture', asOf: DEMO_TODAY, amount: 135_000, currency: 'PLN', source: 'entered' },
      { id: 'balance-everyday', accountId: 'everyday', asOf: DEMO_TODAY, amount: 120_035, currency: 'PLN', source: 'entered' },
      { id: 'balance-investments', accountId: 'investments', asOf: DEMO_TODAY, amount: 98_065, currency: 'PLN', source: 'entered' },
      { id: 'balance-emergency', accountId: 'emergency-cash', asOf: DEMO_TODAY, amount: 30_000, currency: 'PLN', source: 'entered' },
    ],
    goals: [
      { id: 'trip-to-japan', kind: 'goal', name: 'Trip to Japan', owner: 'shared', target: 2_000_000, currency: 'PLN', deadline: null, openingBalance: 0, createdOn: DEMO_TODAY, status: 'active' },
      { id: 'christmas-gift', kind: 'goal', name: 'Christmas Gift', owner: 'alex', target: 50_000, currency: 'PLN', deadline: '2026-12-25', openingBalance: 0, createdOn: DEMO_TODAY, status: 'active' },
    ],
    goalMovements: [],
  }
}
