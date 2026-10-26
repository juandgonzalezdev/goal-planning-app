import { describe, expect, it } from 'vitest'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../../data/fixtures/demoAlex'
import { exportFinanceData, importFinanceData } from '../../data/exchange'
import { migrateToCurrent, migrateV1toV2 } from '../../data/migrations'
import { validateFinanceData } from '../../data/validate'
import { monthsOfYear } from '../calendar'
import { sumMinor } from '../money'
import { billsForMonth, setBillMonthAmount, setBillPaid } from './bills'
import { recordBalance, summarizeCards, summarizeDebts } from './debts'
import {
  confirmedEssentials, coverMonths, createEmergencyFundFromDraft, emergencyCover, emergencyTarget, estimateEssentials, reviewEmergencyFund,
} from './emergency'
import { accountFlows, monthFunding, reconcileAccount } from './flows'
import { addGoalMovement, createGoal, goalProgress } from './goals'
import { activityLog, filterActivity, NO_FILTER } from './history'
import { housingShare } from './indicators'
import { summarizeMoney } from './moneyAccounts'
import { deleteExpense, saveExpense, saveTransfer, updateIncomeEntry } from './records'
import { savingsSummary } from './savings'
import { monthResult, monthSpending } from './spending'
import { applyCancel, applyPause, largestDeficit, opportunities, simulateSubscription } from './subscriptions'
import type { FinanceData } from './types'
import { yearSummary } from './year'

const YEAR = monthsOfYear(2026)
const TODAY = ALEX_DEMO_TODAY
const ALL_ACCOUNTS = (data: FinanceData) => [...data.moneyAccounts.map(a => a.id), ...data.debts.map(d => d.id)]

/**
 * The year as documented in docs/demo-alex-year.md (grosze). Savings is
 * the Savings Account plus the Piggy Bank (150, untouched all year), as
 * known at the end of each month.
 */
const DOCUMENTED = [
  { month: '2026-01', income: 465_000, spending: 376_593, result: 88_407, everyday: 199_238, savings: 350_000, card: 91_850 },
  { month: '2026-02', income: 420_000, spending: 456_015, result: -36_015, everyday: 205_471, savings: 370_000, card: 200_347 },
  { month: '2026-03', income: 490_000, spending: 352_401, result: 137_599, everyday: 219_680, savings: 405_000, card: 158_436 },
  { month: '2026-04', income: 450_000, spending: 354_043, result: 95_957, everyday: 221_653, savings: 435_000, card: 141_162 },
  { month: '2026-05', income: 533_800, spending: 339_128, result: 194_672, everyday: 161_556, savings: 525_000, card: 23_338 },
  { month: '2026-06', income: 470_000, spending: 342_503, result: 127_497, everyday: 193_536, savings: 550_000, card: 0 },
  { month: '2026-07', income: 90_000, spending: 346_492, result: -256_492, everyday: 137_449, savings: 400_000, card: 97_822 },
  { month: '2026-08', income: 65_000, spending: 368_786, result: -303_786, everyday: 21_392, savings: 250_000, card: 183_206 },
  { month: '2026-09', income: 561_000, spending: 436_362, result: 124_638, everyday: 281_935, savings: 170_000, card: 287_007 },
  { month: '2026-10', income: 685_000, spending: 488_860, result: 196_140, everyday: 370_763, savings: 200_000, card: 257_833 },
  { month: '2026-11', income: 650_000, spending: 507_196, result: 142_804, everyday: 389_061, savings: 245_000, card: 226_708 },
  { month: '2026-12', income: 720_000, spending: 509_735, result: 210_265, everyday: 278_991, savings: 290_000, card: 0 },
]

describe('Alex year: the records', () => {
  it('is valid, invented data for one person, from 1 Jan to 31 Dec 2026', () => {
    const data = createAlexDemo()
    expect(validateFinanceData(data)).toMatchObject({ status: 'valid' })
    expect(data.space).toMatchObject({ mode: 'individual', members: [{ name: 'Alex' }] })
    expect(TODAY).toBe('2026-12-31')
    const dates = [...data.income.map(i => i.receivedOn), ...data.expenses.map(e => e.date), ...data.transfers.map(t => t.date),
      ...data.goalMovements.map(m => m.date), ...data.billMonths.flatMap(r => (r.paidOn ? [r.paidOn] : [])), ...data.balances.map(b => b.asOf)]
    // Nothing recorded as received or paid after the demo date; opening balances on 31 Dec 2025.
    expect(dates.every(date => date >= '2025-12-31' && date <= TODAY)).toBe(true)
    expect(data.balances.filter(b => b.asOf === '2025-12-31').map(b => b.accountId).sort()).toEqual(ALL_ACCOUNTS(data).sort())
    // No real people from the project.
    expect(JSON.stringify(data)).not.toMatch(/Juan|Kamila/i)
  })

  it('is the same every time it is created (reproducible)', () => {
    expect(createAlexDemo()).toEqual(createAlexDemo())
    const first = createAlexDemo()
    first.expenses[0].amount = 1
    expect(createAlexDemo().expenses[0].amount).not.toBe(1)
  })

  it('tells the story the year needs', () => {
    const data = createAlexDemo()
    const summary = yearSummary(data, 2026, TODAY)
    expect(summary.months.filter(row => row.result > 0)).toHaveLength(9)
    expect(summary.deficitMonths).toEqual(['2026-02', '2026-07', '2026-08'])
    // Very low income in July and August, an extraordinary income in May.
    expect(summary.months.filter(row => row.income < 100_000).map(row => row.month)).toEqual(['2026-07', '2026-08'])
    expect(data.income.filter(i => i.extraordinary)).toMatchObject([{ month: '2026-05', amount: 113_800, note: 'Tax refund for 2025' }])
    // High or unexpected one-off costs.
    expect(data.expenses.filter(e => e.nature === 'exceptional').map(e => e.description)).toEqual(expect.arrayContaining(['Laptop screen repair', 'Emergency dental treatment']))
    // A subscription review with a real reduction from a concrete month.
    const music = data.bills.find(b => b.id === 'music')!
    expect(music.amountChanges).toEqual([{ from: '2026-10', amount: 1_699 }])
    expect(data.bills.find(b => b.id === 'video')?.endMonth).toBe('2026-09')
    // Paid, late and pending payments.
    const states = YEAR.flatMap(month => billsForMonth(data, month).map(o => ({ o, record: data.billMonths.find(r => r.billId === o.bill.id && r.month === month) })))
    expect(states.filter(({ o, record }) => record?.paidOn && record.paidOn > o.dueDate).map(({ o }) => `${o.bill.id}:${o.month}`))
      .toEqual(expect.arrayContaining(['utilities:2026-08', 'student-loan-payment:2026-09']))
    expect(monthResult(data, '2026-12', TODAY).pending.map(p => [p.occurrence.bill.id, p.state])).toEqual([['phone', 'due']])
  })
})

describe('Alex year: acceptance', () => {
  it('(1) the 12 months and the year summary match their records and the documented table', () => {
    const data = createAlexDemo()
    const summary = yearSummary(data, 2026, TODAY)
    for (const [index, row] of summary.months.entries()) {
      const month = row.month
      expect(row.income).toBe(sumMinor(data.income.filter(i => i.month === month).map(i => i.amount)))
      expect(row.spending).toBe(sumMinor(monthSpending(data, month).items.map(item => item.amount)))
      expect(row.result).toBe(row.income - row.spending)
      expect({ month, income: row.income, spending: row.spending, result: row.result }).toEqual({
        month: DOCUMENTED[index].month, income: DOCUMENTED[index].income, spending: DOCUMENTED[index].spending, result: DOCUMENTED[index].result,
      })
      expect(row.savingsAtEnd).toBe(DOCUMENTED[index].savings)
    }
    expect(summary).toMatchObject({ income: 5_599_800, spending: 4_878_114, result: 721_686, extraordinaryIncome: 113_800 })
    expect(summary.income).toBe(sumMinor(summary.months.map(m => m.income)))
    expect(summary.spending).toBe(sumMinor(summary.months.map(m => m.spending)))
  })

  it('(2) every deficit has an identified source of funding', () => {
    const data = createAlexDemo()
    for (const month of yearSummary(data, 2026, TODAY).deficitMonths) {
      const funding = monthFunding(data, month, TODAY)
      expect(funding.notExplained).toBe(0)
      expect(funding.everydayChange + funding.savingsChange + funding.investmentChange - funding.debtChange).toBe(funding.result)
    }
    // July and August were covered by Savings (the emergency fund) and the card.
    expect(monthFunding(data, '2026-07', TODAY)).toMatchObject({ savingsChange: -150_000, debtChange: 50_405 })
    expect(monthFunding(data, '2026-08', TODAY)).toMatchObject({ savingsChange: -150_000, debtChange: 37_729 })
    expect(data.transfers.filter(t => t.fromAccountId === 'savings-account' && t.toAccountId === 'everyday').map(t => [t.date, t.amount]))
      .toEqual(expect.arrayContaining([['2026-07-03', 150_000], ['2026-08-04', 150_000], ['2026-09-02', 80_000]]))
  })

  it('(3) balances and movements reconcile, month by month, for every account', () => {
    const data = createAlexDemo()
    for (const month of YEAR) {
      for (const id of ALL_ACCOUNTS(data)) {
        const check = reconcileAccount(data, id, month)
        // The Piggy Bank and the investments were only read at the start and the end of the year: December checks the whole year.
        const yearly = id === 'piggy-bank' || id === 'investments'
        expect([id, month, check.status, check.difference]).toEqual([id, month, yearly && month !== '2026-12' ? 'no-balances' : 'checked', 0])
      }
      expect(monthFunding(data, month, TODAY).notExplained).toBe(0)
    }
    const end = DOCUMENTED.at(-1)!
    expect(summarizeMoney(data).items.find(i => i.account.id === 'everyday')?.balance).toBe(end.everyday)
    expect(summarizeDebts(data).items.find(i => i.debt.id === 'credit-card')?.balance).toBe(end.card)
  })

  it('(4) editing one month changes that month only', () => {
    const before = createAlexDemo()
    const edited = saveExpense(before, 'new-coffee', { date: '2026-03-10', amount: 2_500, category: 'Eating Out', description: 'Coffee', accountId: 'everyday', nature: 'regular' }, TODAY)
    if (edited.status !== 'ok') throw new Error('invalid')
    const changedUtilities = setBillMonthAmount(before, 'utilities', '2026-05', 20_000)
    for (const month of YEAR) {
      const was = monthResult(before, month, TODAY)
      expect(monthResult(edited.data, month, TODAY).spending.total).toBe(was.spending.total + (month === '2026-03' ? 2_500 : 0))
      expect(monthResult(changedUtilities, month, TODAY).planned.knownTotal).toBe(was.planned.knownTotal + (month === '2026-05' ? 3_000 : 0))
    }
    // Received income: one record changes, it still counts for its month.
    const income = updateIncomeEntry(before, 'freelance-2026-07', 100_000, '2026-07-20', TODAY)
    if (income.status !== 'ok') throw new Error('invalid')
    expect(monthResult(income.data, '2026-07', TODAY).income.total).toBe(100_000)
    expect(monthResult(income.data, '2026-08', TODAY).income.total).toBe(65_000)
    // Deleting it again gives back exactly the same year.
    expect(yearSummary(deleteExpense(edited.data, 'new-coffee'), 2026, TODAY)).toEqual(yearSummary(before, 2026, TODAY))
  })

  it('(5) bills, payments, card purchases and transfers are never counted twice', () => {
    const data = createAlexDemo()
    for (const month of YEAR) {
      const spending = monthSpending(data, month)
      const expected = sumMinor([
        ...billsForMonth(data, month).filter(o => o.paid && !o.bill.debtId && o.amount !== null).map(o => o.amount as number),
        ...data.billMonths.filter(r => r.month === month && r.paid && r.interest !== undefined).map(r => r.interest as number),
        ...data.expenses.filter(e => e.date.startsWith(month)).map(e => e.amount),
      ])
      expect(spending.total).toBe(expected)
      // Card payments and loan principal pay debt back: never spending.
      expect(spending.items.some(item => item.billId === 'card-payment')).toBe(false)
      expect(spending.items.filter(item => item.source === 'loan-interest').every(item => item.label.endsWith('interest'))).toBe(true)
    }
    // Marking a bill paid does not change spending twice, nor a debt balance.
    const paid = setBillPaid(data, 'phone', '2026-12', true, TODAY)
    expect(monthResult(paid, '2026-12', TODAY).spending.total).toBe(monthResult(data, '2026-12', TODAY).spending.total + 6_999)
    expect(summarizeDebts(paid)).toEqual(summarizeDebts(data))
    // A transfer between own accounts is neither income nor spending.
    const moved = saveTransfer(data, 't-test', { date: '2026-12-30', amount: 10_000, fromAccountId: 'everyday', toAccountId: 'savings-account', note: '' }, TODAY)
    if (moved.status !== 'ok') throw new Error('invalid')
    expect(monthResult(moved.data, '2026-12', TODAY).result).toBe(monthResult(data, '2026-12', TODAY).result)
    // A card purchase is spending when made; it adds to the card, not to the everyday account.
    const flows = accountFlows(data, ['2026-02'])
    const repair = data.expenses.find(e => e.description === 'Laptop screen repair')!
    expect(repair.accountId).toBe('credit-card')
    expect(flows.some(f => f.accountId === 'credit-card' && f.amount > 0)).toBe(true)
  })

  it('(6) Savings and goals keep their rules at the end of every month', () => {
    const data = createAlexDemo()
    for (const month of YEAR) {
      const savings = savingsSummary(data, `${month}-31` > TODAY ? TODAY : monthEndOf(month))
      expect(savings.total).not.toBeNull()
      expect(savings.assigned + (savings.unassigned as number)).toBe(savings.total)
      expect(savings.unassigned).toBeGreaterThanOrEqual(0)
      for (const purpose of savings.purposes) expect(purpose.saved).toBeGreaterThanOrEqual(0)
    }
    const end = savingsSummary(data)
    expect(end).toMatchObject({ total: 290_000, assigned: 290_000, unassigned: 0 })
    expect(end.purposes.map(p => [p.goal.id, p.saved])).toEqual([['trip-to-japan', 180_000], ['bike', 20_000], ['emergency-fund', 90_000]])
    // A goal with no target counts what it holds, with no percentage.
    expect(goalProgress(data.goals.find(g => g.id === 'bike')!, data.goalMovements, TODAY)).toMatchObject({ saved: 20_000, hasTarget: false, percent: 0 })
  })

  it('(7, 8, 9) the emergency estimate creates nothing, uses confirmed costs, never makes a second fund', () => {
    const data = createAlexDemo()
    const copy = structuredClone(data)
    const estimate = estimateEssentials(data, TODAY)
    expect(data).toEqual(copy)
    expect(estimate.throughMonth).toBe('2026-12')
    expect(estimate.averageMonths).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])
    // One-off costs are listed apart, never in the usual month.
    expect(estimate.exceptional.map(item => item.label)).toEqual(expect.arrayContaining(['Emergency dental treatment', 'Moving van']))
    expect(estimate.lines.find(l => l.key === 'bill:rent-studio')).toMatchObject({ monthly: 260_000, essentialByDefault: true })
    expect(estimate.lines.find(l => l.key === 'bill:gym')).toMatchObject({ essentialByDefault: false })
    expect(estimate.lines.find(l => l.key === 'debt:small-loan')).toMatchObject({ monthly: 27_660, essentialByDefault: true })
    // Savings for goals are never a line.
    expect(estimate.lines.some(l => /japan|bike|saving/i.test(l.label))).toBe(false)

    const confirmed = estimate.lines.map(l => ({ key: l.key, essential: l.essentialByDefault, monthly: l.monthly }))
    const total = confirmedEssentials(confirmed)
    expect(total).toEqual({ status: 'complete', monthly: 441_542 })
    expect(emergencyTarget(441_542, 3)).toBe(1_324_626)
    // Unticking a line takes it out; an essential line with no amount makes it incomplete.
    expect(confirmedEssentials(confirmed.map(l => (l.key === 'bill:phone' ? { ...l, essential: false } : l)))).toEqual({ status: 'complete', monthly: 434_543 })
    expect(confirmedEssentials(confirmed.map(l => (l.key === 'variable:Groceries' ? { ...l, monthly: null } : l))))
      .toMatchObject({ status: 'incomplete', missing: ['variable:Groceries'] })

    // Alex has a fund already: no second one.
    expect(createEmergencyFundFromDraft(data, { goalId: 'x', movementId: 'y' }, 'alex', TODAY, { target: 100_000, alreadySetAside: 0 }))
      .toEqual({ status: 'rejected', error: 'fund-exists' })
    // Reviewing sets the target and basis only; what it holds stays.
    const reviewed = reviewEmergencyFund(data, 'emergency-fund', 441_542, { months: 1, monthlyEssentials: 441_542, reviewedOn: TODAY })!
    expect(emergencyCover(reviewed)).toMatchObject({ saved: 90_000, monthlyEssentials: 441_542, months: 0.2 })
    expect(savingsSummary(reviewed)).toMatchObject({ total: 290_000, assigned: 290_000, unassigned: 0 })
    expect(coverMonths(90_000, null)).toBeNull()
  })

  it('(7, 8) a new space gets its fund only when confirmed, from unassigned savings, once', () => {
    const data = createAlexDemo()
    const noFund = { ...data, goals: data.goals.filter(g => g.kind !== 'emergency'), goalMovements: data.goalMovements.filter(m => m.goalId !== 'emergency-fund') }
    expect(savingsSummary(noFund).unassigned).toBe(90_000)
    const created = createEmergencyFundFromDraft(noFund, { goalId: 'ef', movementId: 'ef-1' }, 'alex', TODAY, { target: null, alreadySetAside: 40_000 })
    if (created.status !== 'ok') throw new Error(created.error)
    expect(savingsSummary(created.data)).toMatchObject({ total: 290_000, unassigned: 50_000 })
    expect(validateFinanceData(created.data)).toMatchObject({ status: 'valid' })
    expect(createEmergencyFundFromDraft(noFund, { goalId: 'ef', movementId: 'ef-1' }, 'alex', TODAY, { target: null, alreadySetAside: 90_001 }))
      .toEqual({ status: 'rejected', error: 'more-than-unassigned' })
    expect(createEmergencyFundFromDraft(created.data, { goalId: 'ef2', movementId: 'm' }, 'alex', TODAY, { target: null, alreadySetAside: 0 }))
      .toEqual({ status: 'rejected', error: 'fund-exists' })
  })

  it('(10) a simulation changes nothing; applying it changes future months only', () => {
    const data = createAlexDemo()
    const copy = structuredClone(data)
    const pause = simulateSubscription(data, 'gym', 'pause', TODAY)!
    expect(pause).toMatchObject({ reduction: 38_700, restartFee: 0, unknownCount: 0, allowed: true })
    expect(pause.charges.map(c => c.month)).toEqual(['2027-01', '2027-02', '2027-03'])
    expect(data).toEqual(copy)
    const paused = applyPause(data, pause)
    expect(yearSummary(paused, 2026, TODAY)).toEqual(yearSummary(data, 2026, TODAY))
    expect(billsForMonth(paused, '2027-02').some(o => o.bill.id === 'gym')).toBe(false)
    // Money not spent is not added to Savings.
    expect(savingsSummary(paused)).toEqual(savingsSummary(data))
    const cancel = simulateSubscription(data, 'news', 'cancel', TODAY)!
    const cancelled = applyCancel(data, cancel)
    expect(cancelled.bills.find(b => b.id === 'news')?.endMonth).toBe('2026-12')
    expect(cancelled.billMonths).toEqual(data.billMonths)
    // Ideas are ranked by yearly effect and ease, and measured against the largest deficit.
    expect(opportunities(data, TODAY).map(o => o.key)).toEqual(['subscription:gym', 'flexible:Shopping', 'flexible:Eating Out', 'flexible:Leisure', 'subscription:news'])
    expect(largestDeficit(data, 2026, TODAY)).toEqual({ month: '2026-08', amount: 303_786 })
  })

  it('(13) the JSON backup restores exactly, and an edited year survives it', () => {
    const data = setBillPaid(createAlexDemo(), 'phone', '2026-12', true, TODAY)
    expect(importFinanceData(exportFinanceData(data))).toEqual({ status: 'imported', data })
  })

  it('(14) schema 2 data moves to schema 3 keeping everything', () => {
    const v3 = createAlexDemo()
    const v2 = JSON.parse(exportFinanceData(v3))
    v2.schemaVersion = 2
    delete v2.expenses
    delete v2.transfers
    const migrated = migrateToCurrent(v2)
    expect(migrated).toMatchObject({ status: 'migrated', fromVersion: 2 })
    if (migrated.status !== 'migrated') return
    expect(migrated.data).toEqual({ ...v2, schemaVersion: 3, expenses: [], transfers: [] })
    expect(validateFinanceData(migrated.data)).toMatchObject({ status: 'valid' })
    expect(importFinanceData(JSON.stringify(v2))).toMatchObject({ status: 'imported', data: { schemaVersion: 3, income: v3.income, goals: v3.goals } })
  })

  it('shows every record once in History, each with its own type', () => {
    const data = createAlexDemo()
    const log = activityLog(data)
    expect(log.filter(e => e.type === 'spending')).toHaveLength(data.expenses.length)
    expect(log.filter(e => e.type === 'transfer')).toHaveLength(data.transfers.length)
    expect(log.filter(e => e.type === 'income')).toHaveLength(data.income.length)
    expect(log.filter(e => e.type === 'balance')).toHaveLength(data.balances.length)
    const july = filterActivity(log, { ...NO_FILTER, period: { kind: 'month', month: '2026-07' }, type: 'spending', category: 'Health' })
    expect(july.map(e => e.label)).toContain('Emergency dental treatment')
    expect(july.every(e => e.type === 'spending' && e.category === 'Health' && e.month === '2026-07')).toBe(true)
    const studentLoan = log.find(e => e.key === 'bill:student-loan-payment:2026-03')!
    expect(studentLoan.split!.principal + studentLoan.split!.interest).toBe(25_000)
  })

  it('keeps Cards and Home on the same debt totals, from the balances by each month end', () => {
    const data = createAlexDemo()
    for (const month of YEAR) {
      const end = monthEndOf(month)
      expect(summarizeCards(data, month, end).totalBalance).toBe(summarizeDebts(data, end).total)
    }
    expect(summarizeDebts(data, '2026-08-31').items.find(i => i.debt.id === 'credit-card')).toMatchObject({ balance: 183_206, asOf: '2026-08-31' })
    // A new balance is history: the earlier ones stay, earlier months do not change.
    const updated = recordBalance(data, 'b-new', 'small-loan', 250_000, TODAY)!
    expect(summarizeDebts(updated, '2026-11-30')).toEqual(summarizeDebts(data, '2026-11-30'))
  })

  it('explains the housing share without a misleading percentage', () => {
    const data = createAlexDemo()
    expect(housingShare(data, YEAR, TODAY)).toMatchObject({ status: 'ok', percent: 49.3 })
    const noIncome = { ...data, income: [] }
    expect(housingShare(noIncome, YEAR, TODAY).status).toBe('no-income')
    const unknownRent = setBillMonthAmount(data, 'rent-studio', '2026-11', null)
    expect(housingShare(unknownRent, YEAR, TODAY).status).toBe('incomplete')
  })
})

const monthEndOf = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

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
})

/**
 * Many invented examples from a fixed seed (the same every run): random
 * edits of every kind, and after each one the same rules must hold.
 */
describe('invariants over seeded random examples', () => {
  // mulberry32: a tiny seeded random number generator, so a failure can be replayed.
  const random = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function checkInvariants(data: FinanceData) {
    expect(validateFinanceData(data)).toMatchObject({ status: 'valid' })
    const summary = yearSummary(data, 2026, TODAY)
    expect(summary.result).toBe(summary.income - summary.spending)
    for (const row of summary.months) {
      const spending = monthSpending(data, row.month)
      expect(spending.total).toBe(sumMinor(spending.byCategory.map(c => c.total)))
      expect(monthFunding(data, row.month, TODAY).result).toBe(row.result)
    }
    const savings = savingsSummary(data)
    for (const purpose of savings.purposes) expect(purpose.saved).toBeGreaterThanOrEqual(0)
    if (savings.total !== null) expect(savings.assigned + (savings.unassigned as number)).toBe(savings.total)
    const debts = summarizeDebts(data)
    expect(debts.total).toBe(sumMinor(debts.items.flatMap(i => (i.balance === null ? [] : [i.balance]))))
    expect(importFinanceData(exportFinanceData(data))).toEqual({ status: 'imported', data })
  }

  it.each([1, 42, 2026, 31337])('seed %i: 40 random edits keep totals equal to their parts', seed => {
    const next = random(seed)
    const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)]
    const amount = (max: number) => 1 + Math.round(next() * max)
    const day = () => `${pick(YEAR)}-${String(1 + Math.floor(next() * 28)).padStart(2, '0')}`
    let data = createAlexDemo()
    checkInvariants(data)
    for (let step = 0; step < 40; step++) {
      const action = Math.floor(next() * 7)
      if (action === 0) {
        const result = saveExpense(data, `e${step}`, { date: day(), amount: amount(50_000), category: 'Groceries', description: '', accountId: pick(['everyday', 'credit-card']), nature: 'regular' }, TODAY)
        if (result.status === 'ok') data = result.data
      } else if (action === 1) {
        const result = saveTransfer(data, `t${step}`, { date: day(), amount: amount(50_000), fromAccountId: 'everyday', toAccountId: 'savings-account', note: '' }, TODAY)
        if (result.status === 'ok') data = result.data
      } else if (action === 2) {
        const bill = pick(data.bills)
        data = setBillPaid(data, bill.id, pick(YEAR), next() < 0.7, TODAY)
      } else if (action === 3) {
        data = setBillMonthAmount(data, pick(data.bills).id, pick(YEAR), next() < 0.15 ? null : amount(300_000))
      } else if (action === 4) {
        const goal = pick(data.goals.filter(g => g.status === 'active'))
        const result = addGoalMovement(data, { id: `m${step}`, goalId: goal.id, effect: pick(['assigned', 'unassigned'] as const), amount: amount(30_000), date: TODAY, note: '' })
        if (result.status === 'ok') data = result.data
      } else if (action === 5) {
        const created = createGoal(data, `g${step}`, { name: `Goal ${step}`, owner: 'alex', target: next() < 0.5 ? null : amount(500_000), deadline: null }, TODAY)
        if (created.status === 'valid') data = created.data
      } else if (data.expenses.length > 0) {
        data = deleteExpense(data, pick(data.expenses).id)
      }
      checkInvariants(data)
    }
  })
})
