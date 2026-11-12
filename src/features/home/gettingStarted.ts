import { activeGoals, emergencyFund } from '../../domain/finance/goals'
import type { FinanceData } from '../../domain/finance/types'

/**
 * Getting Started (v1.0, GS-1): six stages after Create My Space, in this
 * order. Accounts come first: they are the savings goals and the emergency
 * fund use. Debts come before bills, because a debt with its monthly payment
 * adds that payment to the bills. Each stage can be skipped and comes back
 * when the guide is resumed; Income and Debts can also be answered with
 * "none". A stage is done when the space has what it asks for; nothing is
 * filled in by the app. Progress is kept per device and per space (the demo:
 * in memory while it is open), never in the space's data. From GS-6A.1 it is
 * saved in the browser's database with its own revision, and the backup file
 * holds it apart from the records (`data/guideProgress.ts`).
 */
export const GUIDE_STEPS = ['accounts', 'income', 'debts', 'bills', 'goals', 'finish'] as const
export type GuideStep = (typeof GUIDE_STEPS)[number]
/** The name used in the v1.0 plan for a stage. */
export type StageId = GuideStep

/** The only stages that can be answered with "I don't have any". */
export const NONE_STEPS = ['income', 'debts'] as const satisfies readonly GuideStep[]
export type NoneStep = (typeof NONE_STEPS)[number]
export const canDeclareNone = (step: GuideStep): step is NoneStep => (NONE_STEPS as readonly GuideStep[]).includes(step)

/** The version of the saved progress written by this code. */
export const PROGRESS_VERSION = 2

export interface GuideProgress {
  version: typeof PROGRESS_VERSION
  /** Hide this guide: it stays off Home until it is shown again from Help & Guide. */
  hidden: boolean
  /** Stages left for later (Skip for now, Not Now). They come back when the guide is resumed. */
  skipped: GuideStep[]
  /** Stages the user said they have none of (Income, Debts). They count as complete and stay so when resumed. */
  none: NoneStep[]
  /** Finish was chosen on the last stage. */
  finished: boolean
  /** The last stage the user visited, to open the guide there again. Never decides whether a stage is done. */
  last: GuideStep | null
}

export const NEW_PROGRESS: GuideProgress = { version: PROGRESS_VERSION, hidden: false, skipped: [], none: [], finished: false, last: null }
/** The demo starts with the guide off Home (Alex's space is already set up); Help & Guide shows it. */
export const DEMO_PROGRESS: GuideProgress = { ...NEW_PROGRESS, hidden: true }

/**
 * Whether the space already has what a stage asks for. Only real records
 * count: a payment a debt added is not a bill of the Bills stage, and the
 * Emergency Fund counts for Goals as a goal does (it is one record, never
 * counted twice). An archived goal or fund does not count (D-GS6-10, GS-6B).
 * The last stage is done only with Finish. Always the saved records: a
 * draft that was not saved never completes a stage (D-GS6-21).
 */
export function stepDone(data: FinanceData, step: GuideStep): boolean {
  switch (step) {
    case 'accounts': return data.moneyAccounts.length > 0
    case 'income': return data.incomeSources.length > 0
    case 'debts': return data.debts.length > 0
    case 'bills': return data.bills.some(bill => !bill.debtId)
    case 'goals': return activeGoals(data.goals).length > 0 || emergencyFund(data.goals) !== null
    case 'finish': return false
  }
}

/** The five stages before Finish, the ones its summary lists. */
export const SETUP_STAGES = GUIDE_STEPS.filter(step => step !== 'finish')

/**
 * Whether the space has any saved record of the kinds the five stages ask for: accounts, income sources, debts, bills
 * and goals (D-GS6-15; GS-6B.1, D4). It is about records existing, not about stages being complete (`stepDone`): an
 * archived goal does not complete Goals, but it is a record, so Finish does not say that nothing is added. Each
 * kind is counted whatever its state (archived, ended, linked to a debt). Finish says so, without blocking, when none.
 */
export const setupHasRecords = (data: FinanceData) =>
  data.moneyAccounts.length > 0 || data.incomeSources.length > 0 || data.debts.length > 0 || data.bills.length > 0 || data.goals.length > 0

/** done: the space has it (or Finish was chosen). none: the user has none. skipped: left for later. to-do: not yet. */
export type StepState = 'done' | 'none' | 'skipped' | 'to-do'

/** Whether a state counts as complete: the guide moves past it and Resume does not bring it back. */
export const isComplete = (state: StepState) => state === 'done' || state === 'none'

export function stepStates(data: FinanceData, progress: GuideProgress): Record<GuideStep, StepState> {
  const states = {} as Record<GuideStep, StepState>
  for (const step of GUIDE_STEPS) {
    // Real records come first: once something is added, the stage is done, whatever was said before.
    if (stepDone(data, step) || (step === 'finish' && progress.finished)) states[step] = 'done'
    else if (canDeclareNone(step) && progress.none.includes(step)) states[step] = 'none'
    else if (progress.skipped.includes(step)) states[step] = 'skipped'
    else states[step] = 'to-do'
  }
  return states
}

/** The stage shown now: the first neither complete nor skipped, or null when the guide is over. */
export function currentStep(data: FinanceData, progress: GuideProgress): GuideStep | null {
  if (progress.finished) return null
  const states = stepStates(data, progress)
  return GUIDE_STEPS.find(step => states[step] === 'to-do') ?? null
}

/**
 * The stage to open when the user comes back: the last one visited if it is
 * still waiting (to do or skipped), otherwise the stage shown now. The
 * stage screens (GS-3) open there; Home's card says which step it is.
 */
export function resumeStep(data: FinanceData, progress: GuideProgress): GuideStep | null {
  if (progress.finished) return null
  const states = stepStates(data, progress)
  if (progress.last && progress.last !== 'finish' && !isComplete(states[progress.last])) return progress.last
  return currentStep(data, progress)
}

/**
 * The stage the guide screen opens on (GS-3): where the user left off
 * (`resumeStep`), or, once the guide is over, the first stage that is still
 * waiting, else the first one. Opening it never changes the progress.
 */
export function openingStep(data: FinanceData, progress: GuideProgress): GuideStep {
  const resume = resumeStep(data, progress)
  if (resume) return resume
  const states = stepStates(data, progress)
  return GUIDE_STEPS.find(step => !isComplete(states[step])) ?? GUIDE_STEPS[0]
}

/** Whether the guide was started: something is complete or skipped, or a stage was visited. */
export function guideStarted(data: FinanceData, progress: GuideProgress): boolean {
  if (progress.last !== null || progress.finished) return true
  const states = stepStates(data, progress)
  return GUIDE_STEPS.some(step => states[step] !== 'to-do')
}

/**
 * D-GS9 (GS-3): which stages can be opened directly from the stage list.
 * Every stage already reached: one that is complete or skipped, the first
 * one still waiting (`currentStep`), and every stage up to the one on
 * screen. A later stage that was never reached opens with Continue or Skip
 * for now, in order. Once the guide is over, every stage can be opened.
 * Derived from the records and the saved progress only: nothing new is saved.
 */
export function stepReachable(data: FinanceData, progress: GuideProgress, step: GuideStep, shown: GuideStep): boolean {
  if (progress.finished) return true
  const states = stepStates(data, progress)
  if (states[step] !== 'to-do') return true
  if (step === currentStep(data, progress)) return true
  return GUIDE_STEPS.indexOf(step) <= GUIDE_STEPS.indexOf(shown)
}

/** The stage before and after `step` in the fixed order (null at either end). */
export const previousStep = (step: GuideStep): GuideStep | null => GUIDE_STEPS[GUIDE_STEPS.indexOf(step) - 1] ?? null
export const nextStep = (step: GuideStep): GuideStep | null => GUIDE_STEPS[GUIDE_STEPS.indexOf(step) + 1] ?? null

/** Whether Home shows the guide. */
export const guideShown = (data: FinanceData, progress: GuideProgress) => !progress.hidden && currentStep(data, progress) !== null

/** Leaves a stage for later; on the last stage, ends the guide. A "none" said before is taken back. */
export const skipStep = (progress: GuideProgress, step: GuideStep): GuideProgress =>
  step === 'finish' ? { ...progress, finished: true }
    : { ...progress, skipped: unique([...progress.skipped, step]), none: progress.none.filter(item => item !== step) }

/** "I don't have regular income" / "I don't have any debts": the stage is complete, and nothing is added to the space. */
export const declareNone = (progress: GuideProgress, step: NoneStep): GuideProgress =>
  ({ ...progress, none: unique([...progress.none, step]), skipped: progress.skipped.filter(item => item !== step) })

/** Takes back a "none" (the stage is waiting again unless the space has it). */
export const clearNone = (progress: GuideProgress, step: NoneStep): GuideProgress =>
  ({ ...progress, none: progress.none.filter(item => item !== step) })

/** Remembers the stage being visited; the same object when nothing changes, so nothing is written again. */
export const visitStep = (progress: GuideProgress, step: GuideStep): GuideProgress =>
  (progress.last === step ? progress : { ...progress, last: step })

/** Ends the guide (Finish Setup). */
export const finishGuide = (progress: GuideProgress): GuideProgress => ({ ...progress, finished: true })

/**
 * Shows Getting Started on Home again: skipped stages come back. A "none"
 * stays: it was an answer, not something left for later. A finished guide
 * stays finished (D-GS6-24, GS-6B): nothing starts it again, and once
 * finished Help & Guide offers Review Setup instead.
 */
export const resumeGuide = (progress: GuideProgress = NEW_PROGRESS): GuideProgress =>
  (progress.finished ? progress : { ...progress, hidden: false, skipped: [] })

/** Ids of the guide before v1.0 that mean something else now. */
const OLD_STEP_IDS: Record<string, GuideStep> = { 'day-to-day': 'finish' }

const knownStep = (value: unknown): GuideStep | null => {
  if (typeof value !== 'string') return null
  const step = OLD_STEP_IDS[value] ?? value
  return (GUIDE_STEPS as readonly string[]).includes(step) ? step as GuideStep : null
}

const unique = <T,>(items: T[]) => [...new Set(items)]

/**
 * Reads saved progress, from this version or an earlier one. Anything
 * unexpected is a new guide, so a broken value never hides it for good, and
 * reading never writes anything back.
 * - Before v1.0 (no `version`): the same ids, in another order; `day-to-day`
 *   is `finish`. An old "I Have None" was saved as skipped and stays skipped:
 *   there is no way to know it meant none.
 * - A newer version: the fields this version knows are read the same way;
 *   others are ignored (and kept in storage until the user changes something).
 */
export function readProgress(value: unknown): GuideProgress {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
  if (!record) return NEW_PROGRESS
  const list = (field: unknown) => (Array.isArray(field) ? field.map(knownStep).filter((step): step is GuideStep => step !== null) : [])
  // Only a v2 (or newer) value can say "none"; the old guide never saved it.
  const versioned = typeof record.version === 'number' && record.version >= PROGRESS_VERSION
  const none = versioned ? unique(list(record.none).filter(canDeclareNone)) : []
  // The last stage is never "skipped": the old guide ended it with finished.
  const skipped = unique(list(record.skipped)).filter(step => step !== 'finish' && !(none as GuideStep[]).includes(step))
  const last = versioned ? knownStep(record.last) : null
  return { version: PROGRESS_VERSION, hidden: record.hidden === true, skipped, none, finished: record.finished === true, last }
}
