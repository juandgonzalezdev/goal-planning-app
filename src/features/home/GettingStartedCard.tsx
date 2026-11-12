import { Icon } from '../../components/Icon'
import type { FinanceData } from '../../domain/finance/types'
import { STAGE_TEXT } from '../guide/guideText'
import { GUIDE_STEPS, guideStarted, isComplete, openingStep, stepStates, type GuideProgress } from './gettingStarted'

type Props = {
  data: FinanceData
  progress: GuideProgress
  isDemo: boolean
  /** Start setup / Continue setup: the stage screen, on the stage to do now. */
  onOpen: () => void
  /** Hide for now: the card leaves Home once that is saved; Settings › Help & Guide brings the guide back. */
  onHide: () => void
  /** Why the last Getting Started change was not saved (GS-6A.1). */
  notice?: string | null
}

/**
 * Getting Started on Home (GS-3): a compact card in place of the earlier
 * panel. It says which step comes next and how many stages are complete, and
 * opens the stage screen. It never adds or completes anything by itself.
 */
export function GettingStartedCard({ data, progress, isDemo, onOpen, onHide, notice = null }: Props) {
  const states = stepStates(data, progress)
  const step = openingStep(data, progress)
  const index = GUIDE_STEPS.indexOf(step)
  const done = GUIDE_STEPS.filter(item => isComplete(states[item])).length
  const started = guideStarted(data, progress)
  return (
    <section className="gs-card" aria-labelledby="gs-card-title">
      <span className="gs-card-icon" aria-hidden="true"><Icon name="flag" size={20} /></span>
      <div className="gs-card-text">
        <h2 id="gs-card-title" className="section-title">Getting Started</h2>
        <p className="gs-card-step">Step {index + 1} of {GUIDE_STEPS.length} · {STAGE_TEXT[step].short}</p>
        <div className="gs-card-bar" aria-hidden="true">
          {GUIDE_STEPS.map(item => <span key={item} className={isComplete(states[item]) ? 'is-complete' : states[item] === 'skipped' ? 'is-skipped' : undefined} />)}
        </div>
        <p className="visually-hidden">{done} of {GUIDE_STEPS.length} stages completed.</p>
        {isDemo && <p className="field-help">In the demo, Alex’s information is invented.</p>}
        {notice && <p className="field-error" role="alert">{notice}</p>}
      </div>
      <div className="gs-card-actions">
        <button type="button" className="button-small button-small-primary" onClick={onOpen}>{started ? 'Continue setup' : 'Start setup'}</button>
        <button type="button" className="text-button" onClick={onHide}>Hide for now</button>
      </div>
    </section>
  )
}
