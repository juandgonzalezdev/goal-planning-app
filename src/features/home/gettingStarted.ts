import type { FinanceData } from '../../domain/finance/types'

/**
 * Getting Started (Rumbo de diseño §8): six steps on Home after Create My
 * Space, in this order. Cards and loans come before bills, because a card
 * or loan with its monthly payment adds that payment to the bills. Each
 * step can be skipped and comes back when the guide is resumed. A step is
 * done when the space has what it asks for; nothing is filled in by the
 * app. Progress is kept per device and per space (the demo: while it is
 * open), never in the space's data or its backup.
 */
export const GUIDE_STEPS = ['income', 'accounts', 'debts', 'bills', 'goals', 'day-to-day'] as const
export type GuideStep = (typeof GUIDE_STEPS)[number]

export interface GuideProgress {
  /** Hide this guide: it stays off Home until it is shown again from Help & Guide. */
  hidden: boolean
  /** Steps left with Skip for now (or I have none / Not now). */
  skipped: GuideStep[]
  /** Done was chosen on the last step. */
  finished: boolean
}

export const NEW_PROGRESS: GuideProgress = { hidden: false, skipped: [], finished: false }
/** The demo starts with the guide off Home (Alex's space is already set up); Help & Guide shows it. */
export const DEMO_PROGRESS: GuideProgress = { hidden: true, skipped: [], finished: false }

/** Whether the space already has what a step asks for. The last step is done only with Done. */
export function stepDone(data: FinanceData, step: GuideStep): boolean {
  switch (step) {
    case 'income': return data.incomeSources.length > 0
    case 'accounts': return data.moneyAccounts.length > 0
    case 'debts': return data.debts.length > 0
    // A payment a card or loan added doesn't count: the step is about the other bills.
    case 'bills': return data.bills.some(bill => !bill.debtId)
    case 'goals': return data.goals.some(goal => goal.kind === 'goal')
    case 'day-to-day': return false
  }
}

export type StepState = 'done' | 'skipped' | 'to-do'

export function stepStates(data: FinanceData, progress: GuideProgress): Record<GuideStep, StepState> {
  const states = {} as Record<GuideStep, StepState>
  for (const step of GUIDE_STEPS) {
    states[step] = stepDone(data, step) || (step === 'day-to-day' && progress.finished) ? 'done' : progress.skipped.includes(step) ? 'skipped' : 'to-do'
  }
  return states
}

/** The step shown now: the first neither done nor skipped, or null when the guide is over. */
export function currentStep(data: FinanceData, progress: GuideProgress): GuideStep | null {
  if (progress.finished) return null
  const states = stepStates(data, progress)
  return GUIDE_STEPS.find(step => states[step] === 'to-do') ?? null
}

/** Whether Home shows the guide. */
export const guideShown = (data: FinanceData, progress: GuideProgress) => !progress.hidden && currentStep(data, progress) !== null

export const skipStep = (progress: GuideProgress, step: GuideStep): GuideProgress =>
  step === 'day-to-day' ? { ...progress, finished: true } : { ...progress, skipped: [...new Set([...progress.skipped, step])] }

/** Show Getting Started on Home: skipped steps come back, and a finished guide starts again where something is left. */
export const resumeGuide = (): GuideProgress => ({ hidden: false, skipped: [], finished: false })

/** Reads saved progress; anything unexpected is a new guide, so a broken value never hides it for good. */
export function readProgress(value: unknown): GuideProgress {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
  if (!record) return NEW_PROGRESS
  const skipped = Array.isArray(record.skipped) ? record.skipped.filter((step): step is GuideStep => (GUIDE_STEPS as readonly unknown[]).includes(step)) : []
  return { hidden: record.hidden === true, skipped: [...new Set(skipped)], finished: record.finished === true }
}
