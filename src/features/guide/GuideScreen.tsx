import { useEffect, useRef, useState } from 'react'
import { guideKept, type GuideOutcome } from '../../app/useSpace'
import { Icon } from '../../components/Icon'
import {
  canDeclareNone, GUIDE_STEPS, isComplete, nextStep, previousStep, SETUP_STAGES, setupHasRecords, stepReachable, stepStates,
  type GuideProgress, type GuideStep, type NoneStep, type StepState,
} from '../home/gettingStarted'
import { AccountsStage } from './AccountsStage'
import { BillsStage } from './BillsStage'
import { DebtsStage } from './DebtsStage'
import { GoalsStage } from './GoalsStage'
import { FINISH_TEXT, NONE_TEXT, STAGE_TEXT, stageStateWords as stateWords } from './guideText'
import { IncomeStage } from './IncomeStage'
import type { StageProps } from './stageProps'
import type { FinanceData } from '../../domain/finance/types'
import type { SaveOutcome } from '../../ui/saveOutcome'

type Props = StageProps & {
  progress: GuideProgress
  /** The stage on screen. */
  stage: GuideStep
  isDemo: boolean
  /** Another stage: Back, a stage chosen in the list, Continue. The app asks first when a form would close. */
  onStage: (step: GuideStep) => void
  /** Skip for now: the stage is left for later and the next one opens. */
  onSkip: (step: GuideStep) => void
  /** "I don't have regular income" / "I don't have any debts": the stage is complete, nothing is added. */
  onNone: (step: NoneStep) => void
  /**
   * Done on the last stage: the guide ends (GS-1 `finished`); the app shows Home once that is saved (GS-6A.1, GS-6B).
   * The answer says whether it was: until then the button says Finishing… and cannot be pressed again (D-GS6-19).
   */
  onFinish: () => Promise<GuideOutcome>
  /** Why the last Getting Started change was not saved (GS-6A.1). Nothing is shown as done until it is. */
  notice?: string | null
  /** Close: back to where the guide was opened from, with the progress kept. */
  onClose: () => void
  /** Create Emergency Fund from the Goals stage: the same save as the Emergency Fund screen. */
  onSaveEmergency: (data: FinanceData, base: number) => Promise<SaveOutcome>
}

/**
 * Getting Started (GS-3): one screen for the six stages, outside the five
 * tabs. The stage list on top shows where the user is and lets them open
 * any stage already reached (D-GS9, see `stepReachable`). Each stage says
 * what it asks, shows what the space already has and offers Back, Skip for
 * now (or Continue once it is complete). Moving between stages never
 * changes or deletes a record and never marks a stage complete: only the
 * records, a "none" answer or Done on Finish do (GS-1).
 */
export function GuideScreen(props: Props) {
  const { data, progress, stage, isDemo, onStage, onSkip, onNone, onFinish, onClose, notice = null } = props
  const states = stepStates(data, progress)
  const index = GUIDE_STEPS.indexOf(stage)
  const state = states[stage]
  const text = STAGE_TEXT[stage]
  const back = previousStep(stage)
  const next = nextStep(stage)
  const complete = isComplete(state)
  // GS-6B: once Done was saved, the last stage is Review Setup: the same summary, with Close instead of Done.
  const review = stage === 'finish' && progress.finished
  const heading = review ? FINISH_TEXT.reviewTitle : text.title
  // D-GS6-19: Done waits for the store. While it saves it says Finishing… and a second press does nothing; if it was
  // not saved it says Try Again (the reason is the notice), and the screen stays.
  const [finishing, setFinishing] = useState<'idle' | 'saving' | 'failed'>('idle')
  const finishLock = useRef(false)
  const finish = () => {
    if (finishLock.current) return
    finishLock.current = true
    setFinishing('saving')
    const settle = (outcome: GuideOutcome | null) => {
      finishLock.current = false
      setFinishing(outcome && (guideKept(outcome) || outcome === 'stale') ? 'idle' : 'failed')
    }
    onFinish().then(settle, () => settle(null))
  }
  // A new stage puts the keyboard on its title (the app does it when the screen opens).
  const title = useRef<HTMLHeadingElement>(null)
  const shown = useRef(stage)
  useEffect(() => {
    if (shown.current === stage) return
    shown.current = stage
    // A Try Again left on Finish starts as Done again when Finish is opened later (its reason was on the stage left).
    if (!finishLock.current) setFinishing('idle')
    title.current?.focus({ preventScroll: true })
    title.current?.closest('.gs-screen')?.scrollIntoView?.({ block: 'start' })
  }, [stage])

  return (
    <div className="tab-screen gs-screen">
      <div className="gs-top">
        <p className="gs-eyebrow"><Icon name="flag" size={16} /> Getting Started</p>
        <button type="button" className="back-link gs-close" aria-label="Close Getting Started" onClick={onClose}>Close</button>
      </div>
      <nav aria-label="Getting Started stages">
        <ol className="gs-stepper">
          {GUIDE_STEPS.map((step, at) => {
            const current = step === stage
            const reachable = stepReachable(data, progress, step, stage)
            const words = stateWords(states[step], step)
            return (
              <li key={step} className={`is-${isComplete(states[step]) ? 'complete' : states[step]}${current ? ' is-current' : ''}`}>
                <button type="button" aria-current={current ? 'step' : undefined} disabled={!reachable}
                  aria-label={`${STAGE_TEXT[step].short}, step ${at + 1} of ${GUIDE_STEPS.length}: ${words}${current ? ', current' : ''}${reachable ? '' : ', not reached yet'}`}
                  onClick={() => { if (!current) onStage(step) }}>
                  <span className="gs-dot" aria-hidden="true">{isComplete(states[step]) ? <Icon name="check" size={16} /> : at + 1}</span>
                  <span className="gs-step-name" aria-hidden="true">{STAGE_TEXT[step].short}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <section className="block gs-stage" aria-labelledby="gs-stage-title">
        <p className="gs-count">Step {index + 1} of {GUIDE_STEPS.length} <span className={`gs-state is-${isComplete(state) ? 'complete' : state}`}>{stateWords(state, stage)}</span></p>
        <h1 id="gs-stage-title" className="tab-title" tabIndex={-1} ref={title}>{heading}</h1>
        <p className="gs-question">{review ? FINISH_TEXT.reviewQuestion : text.question}</p>
        <p className="field-help">{review ? FINISH_TEXT.reviewText : text.text}</p>
        {isDemo && <p className="field-help">In the demo, Alex’s information is invented.</p>}
        <StageContent {...props} states={states} />
      </section>

      {notice && <p className="field-error" role="alert">{notice}</p>}
      {stage === 'finish' && <p className="visually-hidden" role="status">{finishing === 'saving' ? FINISH_TEXT.finishing : ''}</p>}
      <div className="gs-footer">
        {back && <button type="button" className="button-small gs-back" onClick={() => onStage(back)}><Icon name="arrowLeft" size={16} /> Back</button>}
        <span className="gs-forward">
          {stage === 'finish'
            ? (progress.finished
              ? <button type="button" className="button-small button-small-primary" onClick={onClose}>Close</button>
              : <button type="button" className="button-small button-small-primary" aria-disabled={finishing === 'saving' || undefined} onClick={finish}>
                {finishing === 'saving' ? FINISH_TEXT.finishing : finishing === 'failed' ? FINISH_TEXT.tryAgain : FINISH_TEXT.done}
              </button>)
            : <>
              {!complete && canDeclareNone(stage) && <button type="button" className="button-small" onClick={() => onNone(stage)}>{NONE_TEXT[stage]}</button>}
              {!complete && <button type="button" className={`button-small${canDeclareNone(stage) ? '' : ' button-small-primary'}`} onClick={() => onSkip(stage)}>Skip for now</button>}
              {complete && next && <button type="button" className="button-small button-small-primary" onClick={() => onStage(next)}>Continue <Icon name="arrowRight" size={16} /></button>}
            </>}
        </span>
      </div>
    </div>
  )
}

/** What each stage shows: its records and its form (Accounts, Income, Debts, Bills, Goals), or the summary (Finish). */
function StageContent(props: Props & { states: Record<GuideStep, StepState> }) {
  const { stage, states } = props
  if (stage === 'accounts') return <AccountsStage key="accounts" {...props} />
  if (stage === 'income') return <IncomeStage key="income" {...props} />
  if (stage === 'debts') return <DebtsStage key="debts" {...props} />
  if (stage === 'bills') return <BillsStage key="bills" {...props} />
  if (stage === 'goals') return <GoalsStage key="goals" {...props} />
  // Finish and Review Setup (GS-6B): where each of the five stages stands, in words and never with an amount
  // (D-GS6-20), from the saved records and answers only (D-GS6-21). Each line opens its stage. Nothing here marks a
  // stage complete, and an empty space can still finish (D-GS6-15).
  const { data, progress, onStage } = props
  return (
    <>
      <ul className="gs-list gs-summary" aria-label="Your setup">
        {SETUP_STAGES.map(step => (
          <li key={step} className={`is-${isComplete(states[step]) ? 'complete' : states[step]}`}>
            <button type="button" className="gs-summary-open" aria-label={`${STAGE_TEXT[step].title}: ${stateWords(states[step], step)}. Open this stage`} onClick={() => onStage(step)}>
              <span className="item-name">{STAGE_TEXT[step].title}</span>
              <b>{stateWords(states[step], step)}</b>
            </button>
          </li>
        ))}
      </ul>
      {!setupHasRecords(data) && <p className="field-help">{FINISH_TEXT.empty}</p>}
      {!progress.finished && <p className="field-help">{FINISH_TEXT.ready}</p>}
    </>
  )
}
