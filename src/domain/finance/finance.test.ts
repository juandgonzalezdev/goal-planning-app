import { describe, expect, it } from 'vitest'
import { createDemoHousehold, DEMO_TODAY } from '../../data/fixtures/demoHousehold'
import { calculatePayoff } from '../loanPayoff'
import { balanceHistory, latestBalance } from './balances'
import { billsForMonth, groupBillsByDay, setBillMonthAmount, setBillPaid, summarizeBills } from './bills'
import { estimateDebtPayoff, summarizeDebts } from './debts'
import { householdIncomeFor, yearlyIncome } from './income'
import { summarizeMoney } from './moneyAccounts'
import { billsByCategory } from './home'
import { monthlyOverview } from './overview'

// Invented demo household (see data/fixtures/demoHousehold.ts). Every
// expected total below was added up by hand from that file, in grosze.

describe('bills', () => {
  it('adds up a fully paid month', () => {
    const october = summarizeBills(billsForMonth(createDemoHousehold(), '2026-10'))
    expect(october).toEqual({ knownTotal: 557_143, unknownCount: 0, leftToPay: 0, unpaidUnknownCount: 0, paidCount: 10, count: 10 })
  })

  it('leaves an unknown amount out of the total instead of counting it as 0 or copying last month', () => {
    const november = billsForMonth(createDemoHousehold(), '2026-11')
    const phone = november.find(o => o.bill.id === 'phone')
    expect(phone).toMatchObject({ amount: null, paid: false, amountChangedThisMonth: false })
    expect(summarizeBills(november)).toEqual({
      knownTotal: 545_098, unknownCount: 1, leftToPay: 545_098, unpaidUnknownCount: 1, paidCount: 0, count: 10,
    })
  })

  it('uses a month-only amount without changing the usual amount', () => {
    const october = billsForMonth(createDemoHousehold(), '2026-10').find(o => o.bill.id === 'phone')
    expect(october).toMatchObject({ amount: 12_045, amountChangedThisMonth: true })
    expect(october?.bill.amount).toBeNull()
  })

  it('stops a loan bill after its final installment month', () => {
    const data = createDemoHousehold()
    expect(billsForMonth(data, '2027-06').some(o => o.bill.id === 'furniture-loan')).toBe(true)
    expect(billsForMonth(data, '2027-07').some(o => o.bill.id === 'furniture-loan')).toBe(false)
    expect(billsForMonth(data, '2028-10').some(o => o.bill.id === 'car-loan')).toBe(true)
    expect(billsForMonth(data, '2028-11').some(o => o.bill.id === 'car-loan')).toBe(false)
    expect(billsForMonth(data, '2026-09')).toEqual([])
  })

  it('moves a due day of 31 to the last day of a short month', () => {
    const gym = (month: string) => billsForMonth(createDemoHousehold(), month).find(o => o.bill.id === 'gym')?.dueDate
    expect(gym('2026-10')).toBe('2026-10-31')
    expect(gym('2026-11')).toBe('2026-11-30')
    expect(gym('2027-02')).toBe('2027-02-28')
  })

  it('groups bills by date in order, with count and total per date', () => {
    const days = groupBillsByDay(billsForMonth(createDemoHousehold(), '2026-10'))
    expect(days.map(d => d.dueDate.slice(8))).toEqual(['05', '07', '08', '10', '12', '17', '22', '31'])
    const seventh = days[1]
    expect(seventh.occurrences.map(o => o.bill.name)).toEqual(['Bank Plan', 'Language Course'])
    expect(seventh.summary).toMatchObject({ count: 2, knownTotal: 33_000 })
  })

  it('adds up known amounts per category, matching the month total', () => {
    const { categories } = billsByCategory(createDemoHousehold(), '2026-10')
    expect(Object.fromEntries(categories.map(c => [c.category, c.total]))).toEqual({
      Loans: 195_000, Education: 30_000, Subscriptions: 10_099, Housing: 300_000, Utilities: 12_045, Other: 9_999,
    })
    expect(categories.reduce((sum, c) => sum + c.total, 0)).toBe(557_143)
  })

  it('changes one month only when marking paid or setting an amount', () => {
    const before = createDemoHousehold()
    let data = setBillPaid(before, 'phone', '2026-11', true)
    data = setBillMonthAmount(data, 'phone', '2026-11', 13_000)
    const phone = (month: string) => billsForMonth(data, month).find(o => o.bill.id === 'phone')
    expect(phone('2026-11')).toMatchObject({ amount: 13_000, paid: true })
    expect(phone('2026-10')).toMatchObject({ amount: 12_045, paid: true })
    expect(phone('2026-12')).toMatchObject({ amount: null, paid: false })
    expect(before.billMonths).toEqual(createDemoHousehold().billMonths)
  })

  it('can go back to the usual amount, or record an amount as not known', () => {
    let data = setBillMonthAmount(createDemoHousehold(), 'rent', '2026-11', 250_000)
    data = setBillMonthAmount(data, 'rent', '2026-11', undefined)
    expect(billsForMonth(data, '2026-11').find(o => o.bill.id === 'rent')).toMatchObject({ amount: 240_000, amountChangedThisMonth: false })
    data = setBillMonthAmount(data, 'rent', '2026-11', null)
    expect(billsForMonth(data, '2026-11').find(o => o.bill.id === 'rent')).toMatchObject({ amount: null, amountChangedThisMonth: true })
  })

  it('never changes a debt balance when a loan bill is paid or its amount changes', () => {
    let data = setBillPaid(createDemoHousehold(), 'car-loan', '2026-11', true)
    data = setBillMonthAmount(data, 'car-loan', '2026-11', 200_000)
    expect(summarizeDebts(data).total).toBe(4_660_040)
    expect(data.balances).toEqual(createDemoHousehold().balances)
  })
})

describe('debts', () => {
  it('adds card balances and loan principals, never installments', () => {
    const debts = summarizeDebts(createDemoHousehold())
    expect(debts.items.map(i => i.balance)).toEqual([325_040, 4_200_000, 135_000])
    expect(debts.total).toBe(4_660_040)
    expect(debts.missingBalanceCount).toBe(0)
  })

  it('uses the newest balance and keeps older ones as history', () => {
    const data = createDemoHousehold()
    expect(latestBalance(data.balances, 'card')).toMatchObject({ amount: 325_040, asOf: DEMO_TODAY })
    expect(balanceHistory(data.balances, 'card').map(b => b.amount)).toEqual([340_000, 325_040])
    // Same date: the balance entered later wins.
    const sameDay = [...data.balances, { id: 'fix', accountId: 'card', asOf: DEMO_TODAY, amount: 320_000, currency: 'PLN' as const, source: 'entered' as const }]
    expect(latestBalance(sameDay, 'card')?.amount).toBe(320_000)
  })

  it('says when a debt has no balance yet instead of counting it as 0', () => {
    const data = createDemoHousehold()
    data.balances = data.balances.filter(b => b.accountId !== 'furniture')
    expect(summarizeDebts(data)).toMatchObject({ total: 4_525_040, missingBalanceCount: 1 })
  })

  it('estimates payoff in grosze with the existing calculator', () => {
    expect(estimateDebtPayoff(135_000, 0, 15_000)).toEqual({ status: 'estimated', months: 9, interest: 0 })
    const car = estimateDebtPayoff(4_200_000, 850, 180_000)
    const reference = calculatePayoff(42_000, 8.5, 1_800)
    if (car.status !== 'estimated' || reference.status !== 'estimated') throw new Error('expected an estimate')
    expect(car.months).toBe(reference.months)
    expect(car.interest).toBe(Math.round(reference.interest * 100))
    expect(estimateDebtPayoff(4_200_000, 850, 10_000)).toEqual({ status: 'payment-too-low' })
  })
})

describe('money accounts', () => {
  it('adds up each kind and the total', () => {
    const money = summarizeMoney(createDemoHousehold())
    expect(money.byKind).toEqual([
      { kind: 'daily-spending', total: 120_035 },
      { kind: 'investment', total: 98_065 },
      { kind: 'savings', total: 30_000 },
      { kind: 'other', total: 0 },
    ])
    expect(money.total).toBe(248_100)
  })
})

describe('income', () => {
  it('adds up received income per member and for the household', () => {
    const year = yearlyIncome(createDemoHousehold(), 2026)
    expect(year.byMember).toEqual({ alex: 5_300_200, jordan: 6_400_100 })
    expect(year.household).toBe(11_700_300)
    expect(year.recordedMonthCount).toBe(10)
  })

  it('shows months with nothing recorded as empty, never as a forecast', () => {
    const year = yearlyIncome(createDemoHousehold(), 2026)
    expect(year.months).toHaveLength(12)
    expect(year.months.slice(10)).toEqual([
      { month: '2026-11', recorded: false, byMember: { alex: 0, jordan: 0 }, household: 0 },
      { month: '2026-12', recorded: false, byMember: { alex: 0, jordan: 0 }, household: 0 },
    ])
    expect(year.months[6]).toMatchObject({ recorded: true, byMember: { alex: 540_050, jordan: 910_010 }, household: 1_450_060 })
  })

  it('keeps each month\'s stacked parts equal to its household total', () => {
    for (const month of yearlyIncome(createDemoHousehold(), 2026).months) {
      expect(month.byMember.alex + month.byMember.jordan).toBe(month.household)
    }
  })

  it('returns an empty year when nothing was recorded', () => {
    expect(yearlyIncome(createDemoHousehold(), 2025)).toMatchObject({ household: 0, recordedMonthCount: 0 })
    expect(householdIncomeFor(createDemoHousehold(), '2026-10')).toBe(1_170_035)
  })
})

describe('monthly overview', () => {
  it('gives the four Home numbers for a month', () => {
    expect(monthlyOverview(createDemoHousehold(), '2026-10')).toMatchObject({
      month: '2026-10', householdIncome: 1_170_035, monthlyCommitments: 557_143, unknownBillCount: 0, leftToPay: 0, totalDebt: 4_660_040,
      // The household has no expected income, so what arrived is all there is.
      income: { basis: 'received', received: 1_170_035, expected: 0, total: 1_170_035 }, incomeMinusBills: 1_170_035 - 557_143,
    })
    expect(monthlyOverview(createDemoHousehold(), '2026-11')).toMatchObject({ householdIncome: 0, monthlyCommitments: 545_098, unknownBillCount: 1, leftToPay: 545_098 })
  })
})
