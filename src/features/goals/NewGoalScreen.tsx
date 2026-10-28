import { useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import { goalProgress, type GoalFields } from '../../domain/finance/goals'
import type { FinanceData, Owner } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'
import { GoalFormFields } from './GoalFormFields'
import { EMPTY_NEW_GOAL, readGoalDraft, type GoalDraft, type GoalDraftErrors, type NewGoalState } from './goalDraft'
import { GoalPace } from './GoalPace'
import { useEditBase, useSaver } from '../../app/writeStatus'
import type { SaveOutcome } from '../../ui/saveOutcome'

type Props = {
  data: FinanceData
  today: CalendarDate
  owner: Owner
  state: NewGoalState
  onStateChange: (state: NewGoalState) => void
  onCancel: () => void
  /** Creates the goal; `base` is the revision the form was opened on. Says what happened. */
  onCreate: (fields: GoalFields, base: number) => Promise<SaveOutcome>
}

/**
 * Create a Goal (I5): the short v5.9 form, then a short confirmation.
 * Nothing is saved until Create Goal is pressed, and the goal starts at 0.
 */
const typedGoal = (draft: GoalDraft) => ({ 'Name': draft.name, 'Target': draft.target, 'Has a date': draft.dated, 'Date': draft.dated ? draft.deadline : '' })

export function NewGoalScreen({ data, today, owner, state, onStateChange, onCancel, onCreate }: Props) {
  const [errors, setErrors] = useState<GoalDraftErrors>({})
  const read = readGoalDraft(state.draft, { today, owner })
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const base = useEditBase()
  const saver = useSaver()
  // The draft stays while the user looks elsewhere: it counts as long as it is not empty.
  useUnsavedChanges('New Goal', typedGoal(state.draft), typedGoal(EMPTY_NEW_GOAL.draft))

  if (state.step === 'confirm' && read.status === 'valid') {
    const { fields } = read
    // A preview only: the same progress the new, empty goal will have.
    const preview = goalProgress({ id: 'preview', kind: 'goal', ...fields, currency: data.space.currency, openingBalance: 0, createdOn: today, status: 'active' }, [], today)
    return (
      <div className="tab-screen">
        <button type="button" className="back-link" onClick={() => onStateChange({ ...state, step: 'form' })}><Icon name="arrowLeft" size={18} /> Edit</button>
        <h1 className="tab-title">Check Your Goal</h1>
        <section className="block">
          <dl className="fact-rows">
            <div><dt>Goal</dt><dd>{fields.name}</dd></div>
            <div><dt>Type</dt><dd>{fields.deadline ? 'With Date' : 'Flexible'}</dd></div>
            <div><dt>Target</dt><dd>{fields.target === null ? 'No target' : money(fields.target)}</dd></div>
            <div><dt>Deadline</dt><dd>{fields.deadline ? formatDate(fields.deadline) : 'No deadline (Flexible)'}</dd></div>
            <div><dt>Saved so far</dt><dd>{money(0)}</dd></div>
          </dl>
        </section>
        <GoalPace progress={preview} currency={data.space.currency} />
        <p className="muted-note">This creates a goal that starts at 0. To count money you already saved, add it to the goal afterwards as savings you already have. You never have to commit a monthly amount. No money is moved and nothing is paid automatically.</p>
        {saver.refusal && <p className="field-error" role="alert">{saver.refusal}</p>}
        <div className="inline-actions">
          <button type="button" className="button-small button-small-primary" aria-disabled={saver.blocked || undefined}
            onClick={() => void saver.save(() => onCreate(fields, base))}>{saver.sending ? 'Saving…' : 'Create Goal'}</button>
          <button type="button" className="button-small" onClick={() => onStateChange({ ...state, step: 'form' })}>Edit</button>
        </div>
      </div>
    )
  }

  const next = () => {
    if (read.status === 'invalid') { setErrors(read.errors); return }
    setErrors({})
    onStateChange({ ...state, step: 'confirm' })
  }

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onCancel}><Icon name="arrowLeft" size={18} /> All Goals</button>
      <h1 className="tab-title">Create a Goal</h1>
      <section className="block">
        <GoalFormFields idPrefix="new-goal" draft={state.draft} errors={errors} currency={data.space.currency}
          onChange={draft => onStateChange({ ...state, draft })} />
      </section>
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" onClick={next}>Review Goal</button>
        <button type="button" className="button-small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
