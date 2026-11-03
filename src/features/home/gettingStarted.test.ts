import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import type { FinanceData } from '../../domain/finance/types'
import { currentStep, guideShown, NEW_PROGRESS, readProgress, resumeGuide, skipStep, stepDone } from './gettingStarted'

// Getting Started: the order, what makes a step done, skipping, and reading a saved value safely.
const alex = createAlexDemo()
const empty: FinanceData = { ...alex, incomeSources: [], income: [], moneyAccounts: [], balances: [], debts: [], bills: [], billMonths: [], goals: [], goalMovements: [] }

describe('Getting Started', () => {
  it('goes Income, Accounts, Cards & Loans, Bills, Goals, then day to day', () => {
    let progress = NEW_PROGRESS
    const seen = []
    for (let step = currentStep(empty, progress); step; step = currentStep(empty, progress)) {
      seen.push(step)
      progress = skipStep(progress, step)
    }
    expect(seen).toEqual(['income', 'accounts', 'debts', 'bills', 'goals', 'day-to-day'])
    expect(progress.finished).toBe(true)
    expect(guideShown(empty, progress)).toBe(false)
  })

  it('a step is done when the space has it; a card or loan payment is not a bill of step 4', () => {
    expect(['income', 'accounts', 'debts', 'bills', 'goals'].every(step => stepDone(alex, step as never))).toBe(true)
    expect(stepDone(alex, 'day-to-day')).toBe(false)
    const onlyLinked = { ...empty, bills: alex.bills.filter(bill => bill.debtId) }
    expect(onlyLinked.bills.length).toBeGreaterThan(0)
    expect(stepDone(onlyLinked, 'bills')).toBe(false)
    // The Emergency Fund alone is not a goal of step 5.
    expect(stepDone({ ...empty, goals: alex.goals.filter(goal => goal.kind === 'emergency') }, 'goals')).toBe(false)
  })

  it('resuming brings skipped steps back; Hide keeps the place', () => {
    const skipped = skipStep(skipStep(NEW_PROGRESS, 'income'), 'accounts')
    expect(currentStep(empty, skipped)).toBe('debts')
    expect(guideShown(empty, { ...skipped, hidden: true })).toBe(false)
    expect(currentStep(empty, { ...skipped, hidden: true })).toBe('debts')
    expect(currentStep(empty, resumeGuide())).toBe('income')
  })

  it('reads a broken or unknown saved value as a new guide, never hiding it for good', () => {
    expect(readProgress(null)).toEqual(NEW_PROGRESS)
    expect(readProgress('yes')).toEqual(NEW_PROGRESS)
    expect(readProgress({ hidden: 'yes', skipped: ['income', 'nope', 'income'], finished: 1 })).toEqual({ hidden: false, skipped: ['income'], finished: false })
  })
})
