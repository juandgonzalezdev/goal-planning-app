import { describe, expect, it } from 'vitest'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../../data/fixtures/demoAlex'
import { exportFinanceData, importFinanceData } from '../../data/exchange'
import { migrateV1toV2 } from '../../data/migrations'
import { validateFinanceData } from '../../data/validate'
import { addMonthsToYearMonth } from '../calendar'
import { sumMinor } from '../money'
import { billsForMonth, setBillMonthAmount, setBillPaid, setUsualAmountFrom, summarizeBills, usualAmountFor } from './bills'
import { deleteDebt, recordBalance, summarizeCards, summarizeDebts } from './debts'
import { addGoalMovement, createGoal, deleteGoal, goalProgress, summarizeGoals, type MovementRequest } from './goals'
import { billsByCategory } from './home'
import { monthIncome } from './income'
import { summarizeMoney } from './moneyAccounts'
import { leftToPayStatus, monthlyOverview } from './overview'
import { savingsSummary } from './savings'
import type { FinanceData, MovementEffect } from './types'

const OCT = '2026-10'
const NOV = '2026-11'
const goalOf = (data: FinanceData, id: string) => data.goals.find(g => g.id === id)!
const move = (data: FinanceData, request: Partial<MovementRequest> & { effect: MovementEffect }) => {
  const result = addGoalMovement(data, { id: 'm1', goalId: 'trip-to-japan', amount: 10_000, date: ALEX_DEMO_TODAY, note: '', ...request })
  if (result.status !== 'ok') throw new Error(result.error)
  return result.data
}

describe('Alex demo data', () => {
  it('is valid, invented data with one member and the approved amounts', () => {
    const data = createAlexDemo()
    expect(validateFinanceData(data)).toMatchObject({ status: 'valid' })
    expect(data.space).toMatchObject({ mode: 'individual', members: [{ name: 'Alex' }] })
    expect(data.bills.map(b => [b.name, b.amount, b.dueDay])).toEqual([
      ['Rent', 400_000, 2], ['Utilities', 70_000, 5], ['Transport', 20_000, 6], ['Subscriptions', 8_000, 10],
      ['Small Loan', 32_000, 15], ['Credit Card Payment', 20_000, 22], ['Student Loan', 25_000, 25],
    ])
    // Nothing from the earlier household example (car and furniture loans).
    expect(JSON.stringify(data)).not.toMatch(/Car Loan|Furniture|Jordan/)
  })

  it('gives 6,500 income, 5,750 of bills and a difference of 750 (1)', () => {
    const overview = monthlyOverview(createAlexDemo(), OCT)
    expect(overview.income).toMatchObject({ basis: 'received', received: 650_000, total: 650_000 })
    expect(overview.monthlyCommitments).toBe(575_000)
    expect(overview.incomeMinusBills).toBe(75_000)
    // November: the same bills; the income is expected, not received.
    const november = monthlyOverview(createAlexDemo(), NOV)
    expect(november).toMatchObject({ monthlyCommitments: 575_000, incomeMinusBills: 75_000, income: { basis: 'expected', expected: 650_000, received: 0 } })
    expect(monthIncome(createAlexDemo(), NOV).lines[0].payDate).toBe('2026-11-01')
  })

  it('starts with October paid up to the 22nd, so only the Student Loan is left', () => {
    const october = summarizeBills(billsForMonth(createAlexDemo(), OCT))
    expect(october).toMatchObject({ paidCount: 6, count: 7, leftToPay: 25_000 })
    expect(leftToPayStatus(october)).toEqual({ status: 'bills-left', leftToPay: 25_000, count: 1 })
    expect(summarizeBills(billsForMonth(createAlexDemo(), NOV)).leftToPay).toBe(575_000)
  })

  it('shows the same debts and total in Home and Cards, from the debt records (2)', () => {
    const data = createAlexDemo()
    const home = summarizeDebts(data)
    const cards = summarizeCards(data, OCT)
    expect(home.total).toBe(1_740_000)
    expect(cards.totalBalance).toBe(home.total)
    expect(cards.items.map(i => [i.debt.name, i.balance])).toEqual(home.items.map(i => [i.debt.name, i.balance]))
    expect(cards.items.map(i => [i.debt.name, i.payment.amount, i.payment.source])).toEqual([
      ['Credit Card', 20_000, 'bill'], ['Student Loan', 25_000, 'bill'], ['Small Loan', 32_000, 'bill'],
    ])
    // Each payment is one bill: Cards' payments are exactly the linked bills, counted once.
    const linkedBills = billsForMonth(data, OCT).filter(o => o.bill.debtId).map(o => o.amount as number)
    expect(cards.totalPayments).toBe(sumMinor(linkedBills))
    expect(data.debts.some(d => d.monthlyPayment !== undefined)).toBe(false)
  })

  it('updates every total when a balance is edited (3)', () => {
    const data = recordBalance(createAlexDemo(), 'b1', 'small-loan', 330_000, ALEX_DEMO_TODAY)!
    expect(summarizeDebts(data).total).toBe(1_710_000)
    expect(summarizeCards(data, OCT).totalBalance).toBe(1_710_000)
    expect(monthlyOverview(data, OCT).totalDebt).toBe(1_710_000)
    // The old balance stays as history.
    expect(data.balances.filter(b => b.accountId === 'small-loan').map(b => b.amount)).toEqual([360_000, 330_000])
  })

  it('changes one month of Utilities by 50 without touching other months (4)', () => {
    const data = setBillMonthAmount(createAlexDemo(), 'utilities', OCT, 75_000)
    expect(monthlyOverview(data, OCT).monthlyCommitments).toBe(580_000)
    expect(monthlyOverview(data, NOV).monthlyCommitments).toBe(575_000)
    expect(billsByCategory(data, OCT).categories.find(c => c.category === 'Utilities')?.total).toBe(75_000)
    expect(billsByCategory(data, OCT).total).toBe(580_000)
  })

  it('changes the usual amount only from the chosen month on, explicitly', () => {
    const data = setUsualAmountFrom(createAlexDemo(), 'utilities', NOV, 75_000)
    const utilities = data.bills.find(b => b.id === 'utilities')!
    expect(usualAmountFor(utilities, OCT)).toBe(70_000)
    expect(usualAmountFor(utilities, NOV)).toBe(75_000)
    expect(usualAmountFor(utilities, '2027-05')).toBe(75_000)
    expect(monthlyOverview(data, OCT).monthlyCommitments).toBe(575_000)
    // A month with its own amount keeps it.
    const kept = setUsualAmountFrom(setBillMonthAmount(createAlexDemo(), 'utilities', NOV, 80_000), 'utilities', NOV, 75_000)
    expect(billsForMonth(kept, NOV).find(o => o.bill.id === 'utilities')?.amount).toBe(80_000)
  })

  it('marks a bill paid without counting it twice or lowering the loan (5)', () => {
    const before = createAlexDemo()
    const after = setBillPaid(before, 'student-loan-payment', OCT, true, ALEX_DEMO_TODAY)
    expect(monthlyOverview(after, OCT)).toMatchObject({ leftToPay: 0, monthlyCommitments: 575_000 })
    expect(leftToPayStatus(monthlyOverview(after, OCT).bills)).toEqual({ status: 'all-paid' })
    expect(summarizeDebts(after)).toEqual(summarizeDebts(before))
    expect(after.billMonths.find(r => r.billId === 'student-loan-payment')).toEqual({ billId: 'student-loan-payment', month: OCT, paid: true, paidOn: ALEX_DEMO_TODAY })
    const undone = setBillPaid(after, 'student-loan-payment', OCT, false)
    expect(monthlyOverview(undone, OCT).leftToPay).toBe(25_000)
    expect(undone.billMonths.find(r => r.billId === 'student-loan-payment')).toEqual({ billId: 'student-loan-payment', month: OCT, paid: false })
  })

  it('never says all paid while an unpaid amount is unknown (12)', () => {
    let data = createAlexDemo()
    for (const bill of data.bills) data = setBillPaid(data, bill.id, OCT, true)
    data = setBillMonthAmount(data, 'utilities', OCT, null)
    data = setBillPaid(data, 'utilities', OCT, false)
    const bills = monthlyOverview(data, OCT).bills
    expect(bills.leftToPay).toBe(0)
    expect(leftToPayStatus(bills)).toEqual({ status: 'amounts-missing', leftToPay: 0, unknownCount: 1 })
    expect(monthlyOverview(data, OCT).unknownBillCount).toBe(1)
  })

  it('starts Japan at 600 of 10,000: 6% and 9,400 to go (6)', () => {
    const data = createAlexDemo()
    expect(goalProgress(goalOf(data, 'trip-to-japan'), data.goalMovements, ALEX_DEMO_TODAY)).toMatchObject({ saved: 60_000, percent: 6, remaining: 940_000 })
    expect(summarizeGoals(data)).toEqual({ saved: 70_000, target: 1_040_000, activeCount: 2 })
    const christmas = goalProgress(goalOf(data, 'christmas-gift'), data.goalMovements, ALEX_DEMO_TODAY)
    expect(christmas).toMatchObject({ saved: 10_000, remaining: 30_000, percent: 25 })
    expect(christmas.pace).toEqual({ status: 'suggested', weekly: { opportunities: 8, amount: 3_750 }, monthly: { opportunities: 2, amount: 15_000 } })
  })

  it('divides Savings by purpose with no double counting', () => {
    const savings = savingsSummary(createAlexDemo())
    expect(savings.total).toBe(135_000)
    expect(savings.purposes.map(p => [p.goal.name, p.saved])).toEqual([['Trip to Japan', 60_000], ['Christmas Gift', 10_000], ['Emergency Fund', 30_000]])
    expect(savings.assigned).toBe(100_000)
    expect(savings.unassigned).toBe(35_000)
    const money = summarizeMoney(createAlexDemo())
    expect(money.byKind).toEqual([
      { kind: 'daily-spending', total: 82_000 }, { kind: 'investment', total: 50_000 }, { kind: 'savings', total: 135_000 }, { kind: 'other', total: 0 },
    ])
    // My Money adds accounts only: goals are inside Savings, never added again.
    expect(money.total).toBe(82_000 + 50_000 + 135_000)
  })

  it('adds 100 of new savings to Japan once: 700, 7%, and Savings grows by 100 (7)', () => {
    const before = createAlexDemo()
    const after = move(before, { effect: 'new-savings', accountId: 'savings-account' })
    expect(goalProgress(goalOf(after, 'trip-to-japan'), after.goalMovements, ALEX_DEMO_TODAY)).toMatchObject({ saved: 70_000, percent: 7 })
    expect(savingsSummary(after).total).toBe(savingsSummary(before).total! + 10_000)
    expect(savingsSummary(after).unassigned).toBe(savingsSummary(before).unassigned)
    expect(summarizeMoney(after).total).toBe(summarizeMoney(before).total + 10_000)
    expect(after.balances.at(-1)).toEqual({ id: 'm1-balance', accountId: 'savings-account', asOf: ALEX_DEMO_TODAY, amount: 130_000, currency: 'PLN', source: 'goal-movement', movementId: 'm1' })
    // Income and Daily Spending are not touched: the money is not assumed to come from them.
    expect(monthlyOverview(after, OCT)).toEqual(monthlyOverview(before, OCT))
    expect(summarizeMoney(after).byKind[0]).toEqual(summarizeMoney(before).byKind[0])
  })

  it('moves 100 of existing savings to Japan without growing Savings (8)', () => {
    const before = createAlexDemo()
    const after = move(before, { effect: 'assigned' })
    expect(goalProgress(goalOf(after, 'trip-to-japan'), after.goalMovements, ALEX_DEMO_TODAY).saved).toBe(70_000)
    expect(savingsSummary(after).total).toBe(savingsSummary(before).total)
    expect(savingsSummary(after).unassigned).toBe(25_000)
    expect(summarizeMoney(after)).toEqual(summarizeMoney(before))
    expect(after.balances).toEqual(before.balances)
  })

  it('refuses to move more than is unassigned, or take out more than is there', () => {
    const data = createAlexDemo()
    expect(addGoalMovement(data, { id: 'x', goalId: 'trip-to-japan', effect: 'assigned', amount: 35_001, date: ALEX_DEMO_TODAY, note: '' }))
      .toEqual({ status: 'rejected', error: 'more-than-unassigned' })
    expect(addGoalMovement(data, { id: 'x', goalId: 'trip-to-japan', effect: 'taken-out', accountId: 'savings-account', amount: 60_001, date: ALEX_DEMO_TODAY, note: '' }))
      .toEqual({ status: 'rejected', error: 'more-than-saved' })
    expect(addGoalMovement(data, { id: 'x', goalId: 'trip-to-japan', effect: 'new-savings', accountId: 'everyday', amount: 100, date: ALEX_DEMO_TODAY, note: '' }))
      .toEqual({ status: 'rejected', error: 'not-a-savings-account' })
    expect(addGoalMovement(data, { id: 'x', goalId: 'trip-to-japan', effect: 'new-savings', accountId: 'savings-account', amount: 100, date: '2026-10-19', note: '' }))
      .toEqual({ status: 'rejected', error: 'before-balance-date' })
    expect(addGoalMovement(data, { id: 'x', goalId: 'christmas-gift', effect: 'taken-out', accountId: 'piggy-bank', amount: 10_000, date: ALEX_DEMO_TODAY, note: '' }))
      .toMatchObject({ status: 'ok' })
  })

  it('takes money out of a goal and the account together, or back to unassigned', () => {
    const before = createAlexDemo()
    const out = move(before, { effect: 'taken-out', accountId: 'savings-account', amount: 20_000 })
    expect(savingsSummary(out)).toMatchObject({ total: 115_000, assigned: 80_000, unassigned: 35_000 })
    const back = move(before, { effect: 'unassigned', amount: 20_000 })
    expect(savingsSummary(back)).toMatchObject({ total: 135_000, assigned: 80_000, unassigned: 55_000 })
  })

  it('gives a deleted goal’s money back to unassigned savings, with no balance change', () => {
    const after = deleteGoal(createAlexDemo(), 'trip-to-japan')
    expect(savingsSummary(after)).toMatchObject({ total: 135_000, assigned: 40_000, unassigned: 95_000 })
  })

  it('new goals start at 0, so they never change Savings', () => {
    const created = createGoal(createAlexDemo(), 'laptop', { name: 'Laptop', owner: 'alex', target: 300_000, deadline: null }, ALEX_DEMO_TODAY)
    if (created.status !== 'valid') throw new Error('invalid')
    expect(savingsSummary(created.data)).toEqual({ ...savingsSummary(createAlexDemo()), purposes: expect.any(Array) })
  })

  it('deletes a debt and handles its bill as chosen', () => {
    const kept = deleteDebt(createAlexDemo(), 'small-loan', 'keep-bill')
    expect(kept.bills.find(b => b.id === 'small-loan-payment')?.debtId).toBeUndefined()
    expect(monthlyOverview(kept, OCT).monthlyCommitments).toBe(575_000)
    expect(validateFinanceData(kept)).toMatchObject({ status: 'valid' })
    const removed = deleteDebt(createAlexDemo(), 'small-loan', 'delete-bill')
    expect(removed.bills.some(b => b.id === 'small-loan-payment')).toBe(false)
    expect(removed.billMonths.some(r => r.billId === 'small-loan-payment')).toBe(false)
    expect(monthlyOverview(removed, OCT).monthlyCommitments).toBe(543_000)
    expect(summarizeDebts(removed).total).toBe(1_380_000)
    expect(validateFinanceData(removed)).toMatchObject({ status: 'valid' })
  })

  it('refuses data where a debt has a payment of its own and a bill (counted twice)', () => {
    const data = createAlexDemo()
    data.debts[2].monthlyPayment = 32_000
    expect(validateFinanceData(data)).toMatchObject({ status: 'invalid', errors: ['Debt "Small Loan" has a monthly payment and a bill; keep only the bill.'] })
  })
})

describe('saved data from the earlier version (schema 1)', () => {
  it('moves emergency cash into Savings and keeps every amount', () => {
    const v1 = {
      schemaVersion: 1,
      bills: [{ id: 'car-bill', debtId: 'car' }],
      debts: [{ id: 'car', monthlyPayment: 100 }, { id: 'card' }],
      moneyAccounts: [{ id: 'cash', kind: 'emergency', name: 'Emergency Cash' }],
      balances: [{ id: 'b', accountId: 'cash', amount: 300 }],
      goals: [{ id: 'g' }],
      goalMovements: [{ id: 'm', amount: 50 }, { id: 'n', amount: -20 }],
    }
    expect(migrateV1toV2(v1)).toEqual({
      schemaVersion: 1,
      bills: [{ id: 'car-bill', debtId: 'car' }],
      debts: [{ id: 'car' }, { id: 'card' }],
      incomeSources: [],
      moneyAccounts: [{ id: 'cash', kind: 'savings', name: 'Emergency Cash' }],
      balances: [{ id: 'b', accountId: 'cash', amount: 300, source: 'entered' }],
      goals: [{ id: 'g', kind: 'goal' }],
      goalMovements: [{ id: 'm', amount: 50, effect: 'assigned' }, { id: 'n', amount: -20, effect: 'unassigned' }],
    })
  })

  it('loads a version 1 export as valid version 2 data', () => {
    const v2 = createAlexDemo()
    const v1 = JSON.parse(exportFinanceData(v2))
    v1.schemaVersion = 1
    delete v1.incomeSources
    for (const goal of v1.goals) delete goal.kind
    v1.goals = v1.goals.filter((goal: { id: string }) => goal.id !== 'emergency-fund')
    for (const balance of v1.balances) delete balance.source
    for (const entry of v1.income) delete entry.sourceId
    const imported = importFinanceData(JSON.stringify(v1))
    expect(imported).toMatchObject({ status: 'imported', data: { schemaVersion: 2, incomeSources: [] } })
  })
})

/**
 * Many invented examples from a fixed seed (the same every run): random
 * edits of every kind, and after each one the same rules must hold.
 */
describe('invariants over seeded random examples (13)', () => {
  // mulberry32: a tiny seeded random number generator, so a failure can be replayed.
  const random = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function checkInvariants(data: FinanceData) {
    expect(validateFinanceData(data)).toMatchObject({ status: 'valid' })
    for (const month of [OCT, NOV]) {
      const occurrences = billsForMonth(data, month)
      const summary = summarizeBills(occurrences)
      const known = occurrences.flatMap(o => (o.amount === null ? [] : [o.amount]))
      expect(summary.knownTotal).toBe(sumMinor(known))
      expect(billsByCategory(data, month).total).toBe(summary.knownTotal)
      expect(sumMinor(billsByCategory(data, month).categories.map(c => c.total))).toBe(summary.knownTotal)
      expect(summary.leftToPay).toBeLessThanOrEqual(summary.knownTotal)
      expect(summary.leftToPay).toBe(sumMinor(occurrences.filter(o => !o.paid && o.amount !== null).map(o => o.amount as number)))
      if (leftToPayStatus(summary).status === 'all-paid') expect(occurrences.every(o => o.paid)).toBe(true)
      const overview = monthlyOverview(data, month)
      expect(overview.totalDebt).toBe(summarizeCards(data, month).totalBalance)
      // A debt's payment is its bill: never more payments than debts, never counted apart from the bill.
      for (const item of summarizeCards(data, month).items) {
        if (item.payment.source === 'bill') expect(item.debt.monthlyPayment).toBeUndefined()
      }
    }
    const debts = summarizeDebts(data)
    expect(debts.total).toBe(sumMinor(debts.items.flatMap(i => (i.balance === null ? [] : [i.balance]))))
    const savings = savingsSummary(data)
    for (const purpose of savings.purposes) expect(purpose.saved).toBeGreaterThanOrEqual(0)
    if (savings.total !== null) {
      expect(savings.assigned + (savings.unassigned as number)).toBe(savings.total)
      expect(savings.unassigned).toBeGreaterThanOrEqual(0)
    }
    expect(summarizeMoney(data).byKind.find(k => k.kind === 'savings')?.total).toBe(savings.knownTotal)
    for (const goal of data.goals.filter(g => g.target !== null)) {
      const progress = goalProgress(goal, data.goalMovements, ALEX_DEMO_TODAY)
      expect(progress.percent).toBeCloseTo(Math.min(100, (progress.saved / (goal.target as number)) * 100), 10)
    }
    expect(importFinanceData(exportFinanceData(data))).toEqual({ status: 'imported', data })
  }

  it.each([1, 7, 42, 2026, 31337])('seed %i: 60 random edits keep totals equal to their parts', seed => {
    const next = random(seed)
    const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)]
    const amount = (max: number) => Math.round(next() * max)
    let data = createAlexDemo()
    checkInvariants(data)
    for (let step = 0; step < 60; step++) {
      const month = pick([OCT, NOV])
      const bill = pick(data.bills)
      const action = Math.floor(next() * 8)
      if (action === 0 && bill) data = setBillMonthAmount(data, bill.id, month, next() < 0.15 ? null : amount(500_000))
      else if (action === 1 && bill) data = setBillPaid(data, bill.id, month, next() < 0.6, ALEX_DEMO_TODAY)
      else if (action === 2 && bill) data = setUsualAmountFrom(data, bill.id, addMonthsToYearMonth(month, Math.floor(next() * 3)), amount(500_000))
      else if (action === 3) {
        const account = pick([...data.debts.map(d => d.id), ...data.moneyAccounts.map(a => a.id)])
        if (account) data = recordBalance(data, `b${step}`, account, amount(2_000_000), ALEX_DEMO_TODAY) ?? data
      } else if (action === 4 || action === 5) {
        const goal = pick(data.goals)
        const effect = pick(['new-savings', 'assigned', 'unassigned', 'taken-out'] as const)
        if (goal) {
          const result = addGoalMovement(data, {
            id: `m${step}`, goalId: goal.id, effect, amount: 1 + amount(50_000), date: ALEX_DEMO_TODAY, note: '',
            accountId: pick(data.moneyAccounts.filter(a => a.kind === 'savings')).id,
          })
          // A refused movement changes nothing; an accepted one must keep every rule.
          if (result.status === 'ok') data = result.data
        }
      } else if (action === 6) {
        const created = createGoal(data, `g${step}`, { name: `Goal ${step}`, owner: 'alex', target: 1 + amount(1_000_000), deadline: null }, ALEX_DEMO_TODAY)
        if (created.status === 'valid') data = created.data
      } else if (data.debts.length > 1) {
        data = deleteDebt(data, pick(data.debts).id, next() < 0.5 ? 'keep-bill' : 'delete-bill')
      }
      checkInvariants(data)
    }
  })
})
