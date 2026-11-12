import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import type { FinanceData } from '../../domain/finance/types'
import {
  clearNone, currentStep, declareNone, DEMO_PROGRESS, finishGuide, guideShown, NEW_PROGRESS, readProgress, resumeGuide, resumeStep,
  skipStep, stepDone, stepStates, visitStep, type GuideProgress,
} from './gettingStarted'

// Getting Started (GS-1): the order, what makes a stage done, none and skipped, the saved progress (v2) and reading older values safely.
const alex = createAlexDemo()
const empty: FinanceData = { ...alex, incomeSources: [], income: [], moneyAccounts: [], balances: [], debts: [], bills: [], billMonths: [], goals: [], goalMovements: [] }
const emergencyOnly: FinanceData = { ...empty, goals: alex.goals.filter(goal => goal.kind === 'emergency') }

describe('Getting Started: order and done', () => {
  it('goes Accounts, Income, Debts, Bills, Goals, then Finish', () => {
    let progress = NEW_PROGRESS
    const seen = []
    for (let step = currentStep(empty, progress); step; step = currentStep(empty, progress)) {
      seen.push(step)
      progress = skipStep(progress, step)
    }
    expect(seen).toEqual(['accounts', 'income', 'debts', 'bills', 'goals', 'finish'])
    expect(progress.finished).toBe(true)
    expect(guideShown(empty, progress)).toBe(false)
  })

  it('a stage is done when the space has it; a debt payment is not a bill of Bills', () => {
    expect(['accounts', 'income', 'debts', 'bills', 'goals'].every(step => stepDone(alex, step as never))).toBe(true)
    expect(stepDone(alex, 'finish')).toBe(false)
    const onlyLinked = { ...empty, bills: alex.bills.filter(bill => bill.debtId) }
    expect(onlyLinked.bills.length).toBeGreaterThan(0)
    expect(stepDone(onlyLinked, 'bills')).toBe(false)
    expect(stepDone({ ...onlyLinked, bills: alex.bills }, 'bills')).toBe(true)
  })

  it('the Emergency Fund completes Goals, as a goal does, without being changed or counted twice', () => {
    expect(emergencyOnly.goals).toHaveLength(1)
    expect(stepDone(emergencyOnly, 'goals')).toBe(true)
    expect(stepDone({ ...empty, goals: alex.goals.filter(goal => goal.kind === 'goal') }, 'goals')).toBe(true)
    expect(stepDone(empty, 'goals')).toBe(false)
    // Reading the state changes nothing in the space.
    const before = JSON.stringify(emergencyOnly)
    stepStates(emergencyOnly, NEW_PROGRESS)
    expect(JSON.stringify(emergencyOnly)).toBe(before)
  })

  it('Finish is done only when the guide is finished', () => {
    expect(stepStates(alex, NEW_PROGRESS).finish).toBe('to-do')
    expect(currentStep(alex, NEW_PROGRESS)).toBe('finish')
    expect(stepStates(alex, finishGuide(NEW_PROGRESS)).finish).toBe('done')
    expect(currentStep(alex, finishGuide(NEW_PROGRESS))).toBeNull()
    // finished is respected even with stages still waiting.
    expect(currentStep(empty, finishGuide(NEW_PROGRESS))).toBeNull()
    expect(guideShown(empty, finishGuide(NEW_PROGRESS))).toBe(false)
  })
})

describe('Getting Started: none and skipped', () => {
  it('none completes Income or Debts without adding anything; skipped stays waiting', () => {
    const before = JSON.stringify(empty)
    const progress = declareNone(declareNone(NEW_PROGRESS, 'income'), 'debts')
    expect(JSON.stringify(empty)).toBe(before)
    const states = stepStates(empty, progress)
    expect(states.income).toBe('none')
    expect(states.debts).toBe('none')
    expect(stepDone(empty, 'income')).toBe(false)
    const skipped = skipStep(skipStep(NEW_PROGRESS, 'income'), 'debts')
    expect(stepStates(empty, skipped).income).toBe('skipped')
    // Resume brings skipped stages back, never a none.
    const resumed = resumeGuide(skipStep(progress, 'accounts'))
    expect(resumed.none).toEqual(['income', 'debts'])
    expect(resumed.skipped).toEqual([])
    expect(currentStep(empty, resumed)).toBe('accounts')
    expect(currentStep({ ...empty, moneyAccounts: alex.moneyAccounts }, resumed)).toBe('bills')
    expect(stepStates(empty, resumeGuide(skipped)).income).toBe('to-do')
  })

  it('none and skipped replace each other; none can be taken back', () => {
    const none = declareNone(skipStep(NEW_PROGRESS, 'debts'), 'debts')
    expect(none).toMatchObject({ none: ['debts'], skipped: [] })
    const skipped = skipStep(none, 'debts')
    expect(skipped).toMatchObject({ none: [], skipped: ['debts'] })
    expect(stepStates(empty, clearNone(none, 'debts')).debts).toBe('to-do')
    expect(declareNone(none, 'debts').none).toEqual(['debts'])
  })

  it('real records come first: a stage with data is done, whatever was said', () => {
    const progress = skipStep(declareNone(NEW_PROGRESS, 'income'), 'accounts')
    const withData = { ...empty, incomeSources: alex.incomeSources, moneyAccounts: alex.moneyAccounts }
    expect(stepStates(withData, progress)).toMatchObject({ income: 'done', accounts: 'done' })
    // Without data, a skipped stage never becomes complete by itself.
    expect(stepStates(empty, progress).accounts).toBe('skipped')
  })
})

describe('Getting Started: resuming from the last stage', () => {
  it('opens the last stage visited while it is waiting, else the stage shown now', () => {
    const visited = visitStep(NEW_PROGRESS, 'bills')
    expect(visited.last).toBe('bills')
    expect(resumeStep(empty, visited)).toBe('bills')
    expect(currentStep(empty, visited)).toBe('accounts')
    // Still waiting when skipped.
    expect(resumeStep(empty, skipStep(visited, 'bills'))).toBe('bills')
    // Complete (data or none): the stage shown now.
    expect(resumeStep({ ...empty, bills: alex.bills }, visited)).toBe('accounts')
    expect(resumeStep(empty, declareNone(visitStep(NEW_PROGRESS, 'debts'), 'debts'))).toBe('accounts')
    // Finished: nothing to resume. No last: the stage shown now.
    expect(resumeStep(empty, finishGuide(visited))).toBeNull()
    expect(resumeStep(empty, NEW_PROGRESS)).toBe('accounts')
    // The same stage again changes nothing, so nothing is written again.
    expect(visitStep(visited, 'bills')).toBe(visited)
  })
})

describe('Getting Started: saved progress', () => {
  it('reads its own v2 value back as it was', () => {
    const progress: GuideProgress = { version: 2, hidden: true, skipped: ['bills'], none: ['income'], finished: false, last: 'bills' }
    expect(readProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress)
    expect(NEW_PROGRESS).toEqual({ version: 2, hidden: false, skipped: [], none: [], finished: false, last: null })
    expect(DEMO_PROGRESS).toEqual({ ...NEW_PROGRESS, hidden: true })
  })

  it('reads progress saved before v1.0 without losing anything', () => {
    // As the old guide saved it: skipped Income and Accounts, and Debts with "I Have None" (saved as skipped).
    expect(readProgress({ hidden: false, skipped: ['income', 'accounts', 'debts'], finished: false }))
      .toEqual({ version: 2, hidden: false, skipped: ['income', 'accounts', 'debts'], none: [], finished: false, last: null })
    // Hidden and finished are respected.
    expect(readProgress({ hidden: true, skipped: [], finished: true })).toMatchObject({ hidden: true, finished: true })
    // day-to-day is now finish; it never stays skipped.
    expect(readProgress({ hidden: false, skipped: ['day-to-day', 'goals'], finished: false }).skipped).toEqual(['goals'])
    // An old value never says none, even when it has the field.
    expect(readProgress({ skipped: ['debts'], none: ['debts'], finished: false })).toMatchObject({ skipped: ['debts'], none: [] })
    // The old stage the guide was on is shown, in the new order.
    expect(currentStep(empty, readProgress({ hidden: false, skipped: ['income'], finished: false }))).toBe('accounts')
  })

  it('reads a broken or unknown value as a new guide, never hiding it for good', () => {
    for (const value of [null, undefined, 'yes', 42, [], ['income']]) expect(readProgress(value)).toEqual(NEW_PROGRESS)
    expect(readProgress({ hidden: 'yes', skipped: ['income', 'nope', 'income'], finished: 1 }))
      .toEqual({ ...NEW_PROGRESS, skipped: ['income'] })
    // none only for Income and Debts; unknown ids and a bad last are dropped; none wins over skipped.
    expect(readProgress({ version: 2, skipped: ['debts', 'goals'], none: ['debts', 'bills', 'x'], last: 'nowhere' }))
      .toEqual({ ...NEW_PROGRESS, skipped: ['goals'], none: ['debts'] })
    expect(readProgress({ version: 2, skipped: 'all', none: {}, last: 3 })).toEqual(NEW_PROGRESS)
  })

  it('reads a newer version by the fields it knows', () => {
    expect(readProgress({ version: 7, hidden: false, skipped: ['bills'], none: ['income'], finished: false, last: 'bills', later: { anything: true } }))
      .toEqual({ version: 2, hidden: false, skipped: ['bills'], none: ['income'], finished: false, last: 'bills' })
  })
})
