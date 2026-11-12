import { useEffect, useRef } from 'react'
import { Icon } from '../../components/Icon'
import type { FinanceData } from '../../domain/finance/types'
import { canDeclareNone, currentStep, GUIDE_STEPS, isComplete, stepStates, type GuideProgress, type GuideStep, type NoneStep, type StepState } from './gettingStarted'

/** What each step says and offers (Rumbo de diseño §8, tutorial script), in the v1.0 order (GS-1). Labels change with the stage screens (GS-3). */
const STEP_TEXT: Record<GuideStep, { name: string; question: string; text: string; action: string; skip: string; extraSkip?: string }> = {
  accounts: {
    name: 'Accounts, cash and savings', question: 'Where is your money now?',
    text: 'Add the account you spend from, any cash and your savings. Enter today’s balance from your bank app. If you don’t know it, leave it empty. It will show as “Not entered”, not as 0.',
    action: 'Add Account', skip: 'Skip for now',
  },
  income: {
    name: 'Income', question: 'What money comes in?',
    text: 'Add what you usually receive each month, such as a salary. Later, you’ll record what actually arrives.',
    action: 'Add Income', skip: 'Skip for now',
  },
  debts: {
    name: 'Cards and loans', question: 'Do you owe anything?',
    text: 'Add each card or loan with its Remaining Balance. If you add its monthly Payment here, it is added to your bills too. You won’t need to add it again.',
    action: 'Add Card or Loan', skip: 'Skip for now', extraSkip: 'I Have None',
  },
  bills: {
    name: 'Bills and subscriptions', question: 'What do you pay regularly?',
    text: 'Add rent, phone, insurance and subscriptions. If you don’t know this month’s amount, leave it as unknown.',
    action: 'Add Bill', skip: 'Skip for now',
  },
  goals: {
    name: 'Goals (optional)', question: 'Want to give part of your savings a purpose?',
    text: 'A goal doesn’t add money. It sets aside part of the savings you already have, or new money you save later. A target amount and a date are optional.',
    action: 'Add a Goal', skip: 'Not Now',
  },
  finish: {
    name: 'Day to day', question: 'You’re set up',
    text: 'When you spend, pay a bill or receive income, record it with + Add at the top. Once a month, update your balances. Home shows how your month is going.',
    action: 'Show Me Add', skip: 'Done',
  },
}

/** What a screen reader hears for each step's state. */
const STATE_TEXT: Record<StepState, (now: boolean) => string> = {
  done: () => 'done', none: () => 'none', skipped: () => 'skipped', 'to-do': now => (now ? 'now' : 'to do'),
}

type Props = {
  data: FinanceData
  progress: GuideProgress
  isDemo: boolean
  onAction: (step: GuideStep) => void
  onSkip: (step: GuideStep) => void
  /** "I Have None" on Debts: the stage is complete, nothing is added (GS-1). */
  onNone: (step: NoneStep) => void
  onHide: () => void
}

/**
 * Getting Started on Home: the step to do now, what to do and how to skip
 * it, with every step listed and its state. It never adds anything by
 * itself: each action opens the form that already exists. After a skip,
 * the keyboard goes to the next step's question.
 */
export function GettingStarted({ data, progress, isDemo, onAction, onSkip, onNone, onHide }: Props) {
  const step = currentStep(data, progress)
  const states = stepStates(data, progress)
  const questionRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (moved.current) questionRef.current?.focus()
    moved.current = false
  }, [step])
  if (!step) return null
  const text = STEP_TEXT[step]
  const index = GUIDE_STEPS.indexOf(step)
  // The payments cards and loans added: listed so they aren't added again as bills.
  const linked = step === 'bills' ? data.bills.filter(bill => bill.debtId) : []
  const skip = (chosen: GuideStep) => { moved.current = true; onSkip(chosen) }
  const none = (chosen: GuideStep) => { moved.current = true; if (canDeclareNone(chosen)) onNone(chosen); else onSkip(chosen) }
  return (
    <section className="getting-started" aria-labelledby="getting-started-title">
      <div className="getting-started-head">
        <h2 id="getting-started-title" className="section-title">Getting Started</h2>
        <small>Step {index + 1} of {GUIDE_STEPS.length}</small>
      </div>
      <ol className="guide-steps" aria-label="Steps">
        {GUIDE_STEPS.map(item => (
          <li key={item} className={`is-${states[item]}${item === step ? ' is-current' : ''}`} aria-current={item === step ? 'step' : undefined}>
            <span aria-hidden="true">{isComplete(states[item]) ? <Icon name="check" size={14} /> : GUIDE_STEPS.indexOf(item) + 1}</span>
            <span className="visually-hidden">{STEP_TEXT[item].name}: {STATE_TEXT[states[item]](item === step)}</span>
          </li>
        ))}
      </ol>
      <h3 className="getting-started-question" tabIndex={-1} ref={questionRef}>{text.question}</h3>
      <p>{text.text}</p>
      {linked.length > 0 && <p className="field-help">Already in your bills: {linked.map(bill => bill.name).join(', ')}.</p>}
      {isDemo && <p className="field-help">In the demo, Alex’s information is invented.</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" onClick={() => onAction(step)}>{text.action}</button>
        {text.extraSkip && <button type="button" className="button-small" onClick={() => none(step)}>{text.extraSkip}</button>}
        <button type="button" className="button-small" onClick={() => skip(step)}>{text.skip}</button>
      </div>
      <button type="button" className="text-button" onClick={onHide}>Hide this guide</button>
    </section>
  )
}
