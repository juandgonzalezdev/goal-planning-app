import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { Icon } from '../../components/Icon'
import { activeGoals, emergencyFund, goalProgress } from '../../domain/finance/goals'
import type { FinanceData, Goal } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { useAllAmounts } from '../../ui/amountVisibility'
import { formatDate } from '../../ui/format'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { EmergencyScreen } from '../goals/EmergencyScreen'
import { EMPTY_NEW_GOAL, saveNewGoal, typedGoalDraft, type NewGoalState } from '../goals/goalDraft'
import { NewGoalScreen } from '../goals/NewGoalScreen'
import { Amount } from './Amount'
import type { StageProps } from './stageProps'

type Props = StageProps & {
  /** Create Emergency Fund: the same save as the Emergency Fund screen (App's `saveEmergency`). */
  onSaveEmergency: (data: FinanceData, base: number) => Promise<SaveOutcome>
}

/**
 * Goals inside Getting Started (GS-5). The forms are the app's own: New
 * Goal (`NewGoalScreen`, `goalDraft.ts`, `saveNewGoal`) and the Emergency
 * Fund draft (`EmergencyScreen`), shown `inline`. The same fields, checks,
 * confirmation and save; a goal with no date keeps `deadline: null`. This
 * stage only hosts them: after a save the user stays here, sees the goal in
 * the list and can add another; Cancel closes the form without saving.
 * The Emergency Fund is one record (`kind: 'emergency'`), listed once, and
 * it completes this stage on its own (D-GS2, `stepDone`).
 */
export function GoalsStage({ data, today, owner, newId, onChange, onSaveEmergency }: Props) {
  const [form, setForm] = useState<'goal' | 'emergency' | null>(null)
  const [newGoal, setNewGoal] = useState<NewGoalState>(EMPTY_NEW_GOAL)
  const [message, setMessage] = useState('')
  const focus = useRef<string | null>(null)
  useEffect(() => {
    if (!focus.current) return
    document.getElementById(focus.current)?.focus()
    focus.current = null
  })
  // The New Goal draft is this stage's (as Money keeps its forms' drafts): leaving with something typed asks first.
  useUnsavedChanges('New Goal', form === 'goal' ? typedGoalDraft(newGoal.draft) : null)
  const fund = emergencyFund(data.goals)
  const goals = activeGoals(data.goals)
  // Hide amounts (the header eye) covers what is saved, the targets and what is left, as in the other stages.
  const amounts = useAllAmounts(data.space.currency)
  const amount = (minor: number) => <Amount text={amounts.money(minor)} spoken={amounts.spoken(minor)} hidden={amounts.hidden} />

  const open = (which: 'goal' | 'emergency') => {
    setForm(which)
    setMessage('')
    focus.current = which === 'goal' ? 'new-goal-name' : 'gs-form-title'
  }
  const close = (done: string, back = form === 'emergency' && !done ? 'gs-start-emergency' : 'gs-add-goal') => {
    setForm(null)
    setNewGoal(EMPTY_NEW_GOAL)
    setMessage(done)
    // After an Emergency Fund is saved its button is gone: the keyboard goes to Add a Goal.
    focus.current = back
  }
  // Review Goal / Edit: the keyboard follows the step (the confirmation's title, or the name to change).
  const changeGoal = (next: NewGoalState) => {
    if (next.step !== newGoal.step) focus.current = next.step === 'confirm' ? 'gs-form-title' : 'new-goal-name'
    setNewGoal(next)
  }
  const createGoal = async (fields: Parameters<typeof saveNewGoal>[3], base: number) => {
    const outcome = await saveNewGoal(onChange, data, newId(), fields, today, base)
    // Not kept: the confirmation stays as it was, with the reason (the form's own).
    if (isKept(outcome)) close(outcomeText('Goal added.', outcome), 'gs-add-goal')
    return outcome
  }

  const items = [...(fund ? [fund] : []), ...goals]
  return (
    <div className="gs-records">
      {items.length === 0
        ? <p className="muted-note">No goals yet.</p>
        : <ul className="gs-list" aria-label="Your goals">
          {items.map(goal => <GoalLine key={goal.id} goal={goal} data={data} today={today} amount={amount} />)}
        </ul>}
      {!fund && <p className="field-help">No Emergency Fund yet. It keeps part of your savings for unexpected costs.</p>}
      <p className="muted-note" role="status">{message}</p>
      {form === 'goal' && (
        <NewGoalScreen inline data={data} today={today} owner={owner} state={newGoal} onStateChange={changeGoal}
          onCancel={() => close('')} onCreate={createGoal} />
      )}
      {form === 'emergency' && (
        <EmergencyScreen inline data={data} today={today} owner={owner} newId={newId} onSave={onSaveEmergency}
          onBack={() => close('')} onCancel={() => close('')} onOpenGoal={() => close('')}
          onSaved={(_, done) => close(done, 'gs-add-goal')} />
      )}
      {form === null && (
        <div className="inline-actions">
          <button id="gs-add-goal" type="button" className="button-small align-start" onClick={() => open('goal')}>
            <Icon name="plus" size={16} /> {goals.length === 0 ? 'Add a Goal' : 'Add Another Goal'}
          </button>
          {!fund && (
            <button id="gs-start-emergency" type="button" className="button-small align-start" onClick={() => open('emergency')}>
              Start an Emergency Fund
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** One goal in the list: its name, its kind and date (or No deadline), what it holds and its target, hidden with Hide amounts. */
function GoalLine({ goal, data, today, amount }: { goal: Goal; data: FinanceData; today: CalendarDate; amount: (minor: number) => ReactNode }) {
  const progress = goalProgress(goal, data.goalMovements, today)
  const when = goal.kind === 'emergency' ? 'For unexpected costs · No deadline' : goal.deadline ? `With Date · ${formatDate(goal.deadline)}` : 'Flexible · No deadline'
  return (
    <li>
      <span>
        <span className="item-name">{goal.name}</span>
        <small>{when}</small>
        <small>{goal.target === null
          ? 'No target'
          : <>Target {amount(goal.target)}{progress.remaining > 0 ? <> · {amount(progress.remaining)} to go</> : ' · Reached'}</>}</small>
      </span>
      <b>{amount(progress.saved)} <small>saved</small></b>
    </li>
  )
}
