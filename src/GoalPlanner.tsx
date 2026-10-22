import { useEffect, useState, type FormEvent } from 'react'
import { evaluateGoalPlan, type GoalPlanInput, type GoalPlanResult } from './domain/evaluateGoalPlan'
import { exploreAlternatives, type AlternativeKind } from './domain/exploreAlternatives'
import {
  characterCount, confirmGoal, evaluateConfirmedGoal, GOAL_DESCRIPTION_MAX_LENGTH, GOAL_NAME_MAX_LENGTH,
  isConfirmable, validateGoalDetails, type ConfirmedGoal,
} from './domain/goal'
import type { CalendarDate } from './domain/goalTime'
import { addMonthsToDate } from './domain/monthlyPlan'
import { ExploreAlternatives } from './ExploreAlternatives'
import { GoalOverview } from './GoalOverview'
import { GoalReview } from './GoalReview'
import { formatDate, formatMoney as money } from './ui/format'
import { fieldsToInput, fromGrosze, sameFields, todayString, type Fields } from './ui/planFields'
import { progressPercent, STATUS_LABELS } from './ui/planStatus'
import './App.css'

type Evaluation = { input: GoalPlanInput; result: GoalPlanResult }

/** The goal's name and description exactly as typed; kept apart from the four plan fields. */
type DetailFields = { name: string; description: string }

type View = 'plan' | 'review' | 'overview'

/** A confirmed alternative, kept so the plan before it can be restored exactly. */
type AppliedChange = {
  previousFields: Fields
  previousEvaluation: Evaluation
  /** The form values the change produced; restoring is only offered while the form still matches them. */
  appliedFields: Fields
  summary: string
}

const makePresets = (today: CalendarDate): Record<string, Fields> => ({
  'Home deposit': { targetAmount: '25000', alreadySaved: '5700', targetDate: addMonthsToDate(today, 60), comfortableContribution: '310' },
  'Short deadline': { targetAmount: '300', alreadySaved: '0', targetDate: addMonthsToDate(today, 0), comfortableContribution: '300' },
  'Already funded': { targetAmount: '5000', alreadySaved: '5000', targetDate: addMonthsToDate(today, 6), comfortableContribution: '200' },
})

function ResultView({ result, target, exploring, onToggleExplore }: { result: GoalPlanResult; target: number; exploring: boolean; onToggleExplore: () => void }) {
  const explanations: Record<GoalPlanResult['status'], string> = {
    funded: 'Your recorded savings already meet this target. You can choose what to do next.',
    'invalid-target-date': 'The date is today or in the past, and there is still an amount remaining.',
    'not-applicable': 'There are no complete monthly contribution opportunities before this deadline. Consider reviewing the timeline.',
    supported: 'Your chosen monthly contribution is at least the calculated requirement.',
    'needs-adjustment': 'Your chosen monthly contribution is below the calculated requirement. You can explore another amount or date.',
  }
  const isMonthly = result.status === 'supported' || result.status === 'needs-adjustment'
  const ratio = progressPercent(target, result.remainingAmount)
  return (
    <section className="panel result-panel" aria-live="polite">
      <div className="eyebrow">YOUR PLAN ANALYSIS</div>
      <h2 className={`result-title status-${result.status}`}>{STATUS_LABELS[result.status]}</h2>
      <p className="result-description">{explanations[result.status]}</p>
      <div className="metrics">
        <div className="metric"><span>Remaining amount</span><strong>{money(result.remainingAmount)}</strong></div>
        <div className="metric"><span>Days remaining</span><strong>{result.status === 'funded' ? '—' : result.daysRemaining}</strong></div>
        <div className="metric"><span>Monthly opportunities</span><strong>{'monthlyOpportunities' in result ? result.monthlyOpportunities : '—'}</strong></div>
        <div className="metric"><span>Required monthly</span><strong>{isMonthly ? money(result.requiredMonthlyContribution) : '—'}</strong></div>
      </div>
      {result.status === 'needs-adjustment' && <div className="detail warning">Monthly shortfall <strong>{money(result.monthlyShortfall)}</strong></div>}
      {result.status === 'supported' && <div className="detail positive">Monthly surplus <strong>{money(result.monthlySurplus)}</strong></div>}
      {result.status === 'needs-adjustment' && <button type="button" className="explore-button" aria-expanded={exploring} aria-controls="alternatives-panel" onClick={onToggleExplore}>{exploring ? 'Hide alternatives' : 'Explore alternatives'}</button>}
      <div className="progress-head"><span>Goal progress</span><span>{ratio.toFixed(1)}%</span></div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio} aria-label="Goal progress"><div style={{ width: `${ratio}%` }}/></div>
      <p className="disclaimer">Based only on the amounts and dates you entered. This is not an assessment of your full financial situation. You decide what to do next.</p>
    </section>
  )
}

type GoalPlannerProps = {
  /** Injectable so tests can fix the date. */
  getToday?: () => CalendarDate
  /** Told whenever the confirmed goal changes, so My Space can show it. */
  onConfirmedGoalChange?: (goal: ConfirmedGoal | null) => void
}

export function GoalPlanner({ getToday = todayString, onConfirmedGoalChange }: GoalPlannerProps) {
  const [fields, setFields] = useState<Fields>(() => ({ targetAmount: '30000', alreadySaved: '24200', targetDate: addMonthsToDate(getToday(), 4), comfortableContribution: '800' }))
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [exploring, setExploring] = useState(false)
  const [pending, setPending] = useState<AlternativeKind | null>(null)
  const [applied, setApplied] = useState<AppliedChange | null>(null)
  const [restorePending, setRestorePending] = useState(false)
  const [notice, setNotice] = useState('')
  const [details, setDetails] = useState<DetailFields>({ name: '', description: '' })
  const [view, setView] = useState<View>('plan')
  // Kept in memory only: it is lost when the page is refreshed or closed.
  const [confirmedGoal, setConfirmedGoal] = useState<ConfirmedGoal | null>(null)
  useEffect(() => { onConfirmedGoalChange?.(confirmedGoal) }, [confirmedGoal, onConfirmedGoalChange])

  const canRestore = applied !== null && sameFields(fields, applied.appliedFields)
  const closeAlternatives = () => { setExploring(false); setPending(null) }
  const changeFields = (next: Fields) => { setFields(next); setDirty(true); setNotice('') }
  const setField = (name: keyof Fields, value: string) => changeFields({ ...fields, [name]: value })
  // Name and description never touch `dirty`: they do not change the financial evaluation.
  const setDetail = (name: keyof DetailFields, value: string) => setDetails({ ...details, [name]: value })

  const detailsCheck = validateGoalDetails(details.name, details.description)
  const reviewBlockers = [
    ...(detailsCheck.status === 'invalid' ? detailsCheck.errors.map(error => ({
      'name-required': 'Add a goal name.',
      'name-too-long': `Shorten the goal name to ${GOAL_NAME_MAX_LENGTH} characters or fewer.`,
      'description-too-long': `Shorten the description to ${GOAL_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    })[error]) : []),
    ...(!evaluation ? ['Evaluate the plan.']
      : dirty ? ['Evaluate your changed inputs.']
      : !isConfirmable(evaluation.result) ? [evaluation.result.status === 'invalid-target-date'
        ? 'Choose a target date after today.'
        : 'Choose a target date at least one full month away.']
      : []),
  ]
  const canReview = reviewBlockers.length === 0
  const editing = confirmedGoal !== null

  function onEvaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    closeAlternatives()
    setNotice('')
    setDirty(false)
    const input = fieldsToInput(fields, getToday())
    if (input === null) {
      setError('Enter a positive target, non-negative amounts with up to two decimals, and a valid date.')
      setEvaluation(null)
      return
    }
    setError('')
    setEvaluation({ input, result: evaluateGoalPlan(input) })
    // Re-evaluating different inputs replaces the plan a restore would return from.
    if (applied && !sameFields(fields, applied.appliedFields)) {
      setApplied(null)
      setRestorePending(false)
    }
  }

  function onConfirmAlternative(kind: AlternativeKind) {
    // Applies only the alternative built from the evaluation on screen, and
    // never over inputs edited since then.
    if (!evaluation || dirty) return
    const alternatives = exploreAlternatives(evaluation.input)
    if (alternatives.status !== 'available') return
    const alternative = kind === 'increase-contribution' ? alternatives.increaseContribution : alternatives.extendDate
    if (alternative.status !== 'available') return

    const { proposedInput } = alternative
    const nextFields = kind === 'increase-contribution'
      ? { ...fields, comfortableContribution: fromGrosze(proposedInput.comfortableContribution) }
      : { ...fields, targetDate: proposedInput.targetDate }
    const summary = kind === 'increase-contribution'
      ? `Monthly contribution changed from ${money(evaluation.input.comfortableContribution)} to ${money(proposedInput.comfortableContribution)}.`
      : `Target date changed from ${formatDate(evaluation.input.targetDate)} to ${formatDate(proposedInput.targetDate)}.`

    setApplied({ previousFields: fields, previousEvaluation: evaluation, appliedFields: nextFields, summary })
    setFields(nextFields)
    setEvaluation({ input: proposedInput, result: alternative.result })
    setDirty(false)
    setRestorePending(false)
    setNotice('')
    closeAlternatives()
  }

  function onConfirmRestore() {
    if (!applied || !canRestore) return
    setFields(applied.previousFields)
    setEvaluation(applied.previousEvaluation)
    setApplied(null)
    setRestorePending(false)
    setDirty(false)
    setError('')
    setNotice('Previous plan restored.')
    closeAlternatives()
  }

  /** Clears everything that belongs to a draft: alternatives, restore and messages. */
  function resetDraftExtras() {
    closeAlternatives()
    setApplied(null)
    setRestorePending(false)
    setNotice('')
    setError('')
  }

  function onOpenReview() {
    if (!canReview) return
    // A half-finished alternative confirmation is closed, never applied.
    closeAlternatives()
    setView('review')
  }

  function onConfirmGoal() {
    if (!evaluation || dirty) return
    const outcome = confirmGoal(details.name, details.description, evaluation.input, getToday())
    if (outcome.status !== 'confirmed') return
    setConfirmedGoal(outcome.goal)
    resetDraftExtras()
    setView('overview')
  }

  function onEditGoal() {
    if (!confirmedGoal) return
    // The draft starts from the confirmed goal; the goal itself is not touched while editing.
    const { input } = confirmedGoal
    const today = getToday()
    setFields({
      targetAmount: fromGrosze(input.targetAmount),
      alreadySaved: fromGrosze(input.alreadySaved),
      targetDate: input.targetDate,
      comfortableContribution: fromGrosze(input.comfortableContribution),
    })
    setDetails({ ...confirmedGoal.details })
    setEvaluation({ input: { ...input, today }, result: evaluateConfirmedGoal(confirmedGoal, today) })
    setDirty(false)
    resetDraftExtras()
    setView('plan')
  }

  function onCancelEditing() {
    // Discards the whole draft, including any alternative applied during the edit.
    resetDraftExtras()
    setView('overview')
  }

  if (view === 'review' && evaluation && detailsCheck.status === 'valid') {
    return <GoalReview details={detailsCheck.details} input={evaluation.input} result={evaluation.result} replacing={confirmedGoal} onBack={() => setView('plan')} onConfirm={onConfirmGoal} />
  }

  if (view === 'overview' && confirmedGoal) {
    return <GoalOverview goal={confirmedGoal} today={getToday()} onEdit={onEditGoal} />
  }

  return (
    <>
      <div className="intro"><span className="eyebrow">MAKE YOUR NEXT MOVE WITH CLARITY</span><h1>Plan with clearer numbers.</h1><p>Set a goal, choose your monthly contribution and explore what the numbers say.<br/>Calculations run entirely on this device.</p></div>
      <div className="workspace">
        <section className="panel input-panel">
          <h2>{editing ? 'Edit your personal goal' : 'Create a personal goal'}</h2>
          <p className="section-subtitle">Name your goal and enter four planning inputs. Nothing is saved or shared.</p>
          {editing && (
            <div className="editing-banner" role="region" aria-label="Editing confirmed goal">
              <p>You are editing “{confirmedGoal.details.name}”. Changes apply only when you review and confirm again. Until then, your confirmed goal stays as it is.</p>
              <button type="button" className="secondary-button" onClick={onCancelEditing}>Cancel editing</button>
            </div>
          )}
          <form onSubmit={onEvaluate} noValidate>
            <label htmlFor="goal-name">Goal name</label>
            <input id="goal-name" value={details.name} aria-describedby="goal-name-count" onChange={e => setDetail('name', e.target.value)} />
            <span id="goal-name-count" className="char-count">{characterCount(details.name.trim())}/{GOAL_NAME_MAX_LENGTH}</span>
            <label htmlFor="goal-description">Description (optional)</label>
            <textarea id="goal-description" rows={2} value={details.description} aria-describedby="goal-description-count" onChange={e => setDetail('description', e.target.value)} />
            <span id="goal-description-count" className="char-count">{characterCount(details.description.trim())}/{GOAL_DESCRIPTION_MAX_LENGTH}</span>
            <label htmlFor="target">Target amount (PLN)</label><input id="target" inputMode="decimal" value={fields.targetAmount} onChange={e => setField('targetAmount', e.target.value)} />
            <label htmlFor="saved">Already saved (PLN)</label><input id="saved" inputMode="decimal" value={fields.alreadySaved} onChange={e => setField('alreadySaved', e.target.value)} />
            <label htmlFor="date">Target date</label><input id="date" type="date" value={fields.targetDate} onChange={e => setField('targetDate', e.target.value)} />
            <label htmlFor="monthly">Comfortable monthly contribution (PLN)</label><input id="monthly" inputMode="decimal" value={fields.comfortableContribution} onChange={e => setField('comfortableContribution', e.target.value)} />
            <div className="scenario-label">Try a scenario</div>
            <div className="scenario-row">{Object.entries(makePresets(getToday())).map(([name, preset]) => <button type="button" className="scenario-button" key={name} onClick={() => { changeFields(preset); setError('') }}>{name}</button>)}</div>
            {error && <p className="input-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button">Evaluate goal <span aria-hidden="true">→</span></button>
          </form>
          {applied && (
            <div className="restore-box" role="region" aria-label="Applied alternative">
              <p role="status">Alternative applied. {applied.summary}</p>
              {!canRestore && <p className="restore-note">You have edited the inputs since this change, so the previous plan cannot be restored automatically.</p>}
              {restorePending && canRestore ? (
                <div className="confirm-box" role="group" aria-label="Confirm restore">
                  <p>Restore the inputs you had before this change? Your current inputs will be replaced.</p>
                  <div className="confirm-actions">
                    <button type="button" className="confirm-button" onClick={onConfirmRestore}>Confirm restore</button>
                    <button type="button" className="secondary-button" onClick={() => setRestorePending(false)}>Cancel</button>
                  </div>
                </div>
              ) : <button type="button" className="secondary-button" disabled={!canRestore} onClick={() => setRestorePending(true)}>Restore previous plan</button>}
            </div>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="review-box">
            <button type="button" className="primary-button review-button" disabled={!canReview} aria-describedby={canReview ? undefined : 'review-blockers'} onClick={onOpenReview}>{editing ? 'Review changes' : 'Review goal'}</button>
            {!canReview && (
              <div id="review-blockers" className="review-blockers">
                <p>Before reviewing:</p>
                <ul>{reviewBlockers.map(text => <li key={text}>{text}</li>)}</ul>
              </div>
            )}
          </div>
        </section>
        {evaluation ? <div className="result-wrapper">{dirty && <div className="stale-note">Inputs changed. Select “Evaluate goal” to refresh your analysis.</div>}<ResultView result={evaluation.result} target={evaluation.input.targetAmount} exploring={exploring} onToggleExplore={() => exploring ? closeAlternatives() : setExploring(true)}/></div> : <section className="panel empty-panel"><div className="empty-mark">↗</div><h2>Your plan analysis</h2><p>Complete the four fields and select “Evaluate goal” to see your result.</p></section>}
      </div>
      {evaluation && exploring && (
        <div id="alternatives-panel">
          <ExploreAlternatives input={evaluation.input} canApply={!dirty} pending={pending} onSelect={setPending} onCancel={() => setPending(null)} onConfirm={onConfirmAlternative} onClose={closeAlternatives} />
        </div>
      )}
    </>
  )
}
