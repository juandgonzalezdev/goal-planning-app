import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import { addGoalMovement, deleteGoal, goalMovementsOf, goalProgress, updateGoal, type MovementKind } from '../../domain/finance/goals'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Goal } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'
import { GoalFormFields } from './GoalFormFields'
import { draftFromGoal, NOTE_MAX_LENGTH, readGoalDraft, readMovementDraft, type GoalDraft, type GoalDraftErrors, type MovementDraft, type MovementDraftErrors } from './goalDraft'
import { GoalPace } from './GoalPace'

type Props = {
  data: FinanceData
  goal: Goal
  today: CalendarDate
  newId: () => string
  onBack: () => void
  onChange: (data: FinanceData) => void
  onDeleted: (data: FinanceData) => void
}

function daysLeftText(days: number | null) {
  if (days === null) return 'No deadline'
  if (days > 1) return `${days} days left`
  if (days === 1) return '1 day left'
  if (days === 0) return 'The target date is today'
  return 'The target date has passed'
}

/** One goal: progress, suggested pace, contributions and withdrawals, editing and its activity. */
export function GoalDetailScreen({ data, goal, today, newId, onBack, onChange, onDeleted }: Props) {
  const currency = data.space.currency
  const money = (minor: number) => formatAmount(minor, currency)
  const progress = goalProgress(goal, data.goalMovements, today)
  const activity = goalMovementsOf(data.goalMovements, goal.id).reverse()

  const emptyMovement = (kind: MovementKind): MovementDraft => ({ kind, amount: '', date: today, note: '' })
  const [movement, setMovement] = useState<MovementDraft>(() => emptyMovement('contribution'))
  const [movementErrors, setMovementErrors] = useState<MovementDraftErrors & { saved?: string }>({})
  const [savedMessage, setSavedMessage] = useState('')
  const [editing, setEditing] = useState<GoalDraft | null>(null)
  const [editErrors, setEditErrors] = useState<GoalDraftErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveMovement = () => {
    setSavedMessage('')
    const read = readMovementDraft(movement, today)
    if (read.status === 'invalid') { setMovementErrors(read.errors); return }
    const result = addGoalMovement(data, { id: newId(), goalId: goal.id, kind: movement.kind, amount: read.amount, date: read.date, note: read.note })
    if (result.status === 'rejected') {
      setMovementErrors(result.error === 'more-than-saved'
        ? { amount: `You can withdraw up to ${money(progress.saved)}, what is saved in this goal.` }
        : { amount: 'This could not be saved. Check the amount and date.' })
      return
    }
    onChange(result.data)
    setMovementErrors({})
    setMovement(emptyMovement(movement.kind))
    setSavedMessage(`${movement.kind === 'contribution' ? 'Contribution' : 'Withdrawal'} of ${money(read.amount)} saved.`)
  }

  const saveEdit = () => {
    if (!editing) return
    const read = readGoalDraft(editing, { today, owner: goal.owner, currentDeadline: goal.deadline })
    if (read.status === 'invalid') { setEditErrors(read.errors); return }
    const result = updateGoal(data, goal.id, read.fields)
    if (result.status !== 'valid') return
    onChange(result.data)
    setEditing(null)
    setEditErrors({})
  }

  const kindButton = (kind: MovementKind, label: string) => (
    <button type="button" aria-pressed={movement.kind === kind} className={movement.kind === kind ? 'is-active' : ''}
      onClick={() => { setMovement({ ...movement, kind }); setMovementErrors({}); setSavedMessage('') }}>{label}</button>
  )
  const fieldError = (id: string, text?: string) => text && <p id={id} className="field-error">{text}</p>

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> All Goals</button>
      <div>
        <h1 className="tab-title">{goal.name}</h1>
        <p className="muted-note">{goal.deadline ? `Target date: ${formatDate(goal.deadline)} · ${daysLeftText(progress.daysToDeadline)}` : 'No deadline · Flexible'}</p>
      </div>

      <section className="goal-hero" aria-label="Progress">
        <b className="goal-hero-saved">{money(progress.saved)}</b>
        <span>of {money(goal.target)} · {progress.percent.toFixed(1)}%</span>
        <div className="bar" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}>
          <div style={{ width: `${progress.percent}%`, background: ownerColor(data.space, goal.owner) }} />
        </div>
        <span>{progress.remaining > 0 ? `${money(progress.remaining)} still needed` : 'Goal reached'}</span>
      </section>

      <GoalPace progress={progress} currency={currency} />

      <section className="block" aria-labelledby="goal-move">
        <h2 id="goal-move" className="section-title">Add or Withdraw</h2>
        <div className="month-switch" role="group" aria-label="Type of change">
          {kindButton('contribution', 'Add')}
          {kindButton('withdrawal', 'Withdraw')}
        </div>
        <div className="form-stack">
          <div className="form-field">
            <label htmlFor="move-amount">Amount ({currency})</label>
            <input id="move-amount" inputMode="decimal" value={movement.amount} aria-invalid={!!movementErrors.amount} aria-describedby={movementErrors.amount ? 'move-amount-error' : undefined}
              onChange={e => setMovement({ ...movement, amount: e.target.value })} />
            {fieldError('move-amount-error', movementErrors.amount)}
          </div>
          <div className="form-field">
            <label htmlFor="move-date">Date</label>
            <input id="move-date" type="date" value={movement.date} max={today} aria-invalid={!!movementErrors.date} aria-describedby={movementErrors.date ? 'move-date-error' : undefined}
              onChange={e => setMovement({ ...movement, date: e.target.value })} />
            {fieldError('move-date-error', movementErrors.date)}
          </div>
          <div className="form-field">
            <label htmlFor="move-note">Note (optional)</label>
            <input id="move-note" value={movement.note} maxLength={NOTE_MAX_LENGTH} aria-invalid={!!movementErrors.note} aria-describedby={movementErrors.note ? 'move-note-error' : undefined}
              onChange={e => setMovement({ ...movement, note: e.target.value })} />
            {fieldError('move-note-error', movementErrors.note)}
          </div>
        </div>
        <button type="button" className="button-small button-small-primary align-start" onClick={saveMovement}>
          Save {movement.kind === 'contribution' ? 'Contribution' : 'Withdrawal'}
        </button>
        <p className="muted-note" role="status">{savedMessage}</p>
        <p className="muted-note">This only records the change in your goal. No money is moved between accounts.</p>
      </section>

      <section className="block" aria-labelledby="goal-edit">
        <h2 id="goal-edit" className="section-title">Edit Goal</h2>
        {editing
          ? <>
            <GoalFormFields idPrefix="edit-goal" draft={editing} errors={editErrors} currency={currency} onChange={setEditing} />
            <div className="inline-actions">
              <button type="button" className="button-small button-small-primary" onClick={saveEdit}>Save Changes</button>
              <button type="button" className="button-small" onClick={() => { setEditing(null); setEditErrors({}) }}>Cancel</button>
            </div>
          </>
          : <div className="inline-actions">
            <button type="button" className="button-small" onClick={() => { setEditing(draftFromGoal(goal)); setConfirmDelete(false) }}>Change Name, Target or Date</button>
            {!confirmDelete && <button type="button" className="button-small" onClick={() => setConfirmDelete(true)}>Delete Goal</button>}
          </div>}
        {confirmDelete && !editing && (
          <div className="callout callout-warning" role="alert">
            <p>Delete “{goal.name}”{activity.length > 0 && ` and its ${activity.length} ${activity.length === 1 ? 'entry' : 'entries'}`}? This cannot be undone. No other information changes.</p>
            <div className="inline-actions">
              <button type="button" className="button-small button-small-danger" onClick={() => onDeleted(deleteGoal(data, goal.id))}>Delete Goal</button>
              <button type="button" className="button-small" onClick={() => setConfirmDelete(false)}>Keep Goal</button>
            </div>
          </div>
        )}
      </section>

      <section className="block" aria-labelledby="goal-activity">
        <h2 id="goal-activity" className="section-title">Savings Activity</h2>
        {activity.length === 0
          ? <p className="muted-note">No contributions yet.</p>
          : <ul className="line-list">
            {activity.map(item => (
              <li key={item.id} className="line">
                <span>{formatDate(item.date)}{item.note ? ` · ${item.note}` : ''}</span>
                <b className={item.amount >= 0 ? 'amount-in' : ''}>{item.amount >= 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b>
              </li>
            ))}
          </ul>}
      </section>
    </div>
  )
}
