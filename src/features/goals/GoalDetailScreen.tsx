import { useEffect, useRef, useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import { deleteGoal, goalMovementsOf, goalProgress, updateGoal } from '../../domain/finance/goals'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Goal } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'
import { EFFECT_NAMES } from '../../ui/labels'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { useEditBase, useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { GoalMovementForm, type GoalMovementHandle } from './GoalMovementForm'
import { GoalFormFields } from './GoalFormFields'
import { draftFromGoal, readGoalDraft, type GoalDraft, type GoalDraftErrors } from './goalDraft'
import { GoalExplore } from './GoalExplore'
import { GoalPace } from './GoalPace'
import { emergencyCover } from '../../domain/finance/emergency'
import { GoalSavedOverTime } from '../charts/TimeCharts'

type Props = {
  data: FinanceData
  goal: Goal
  today: CalendarDate
  /** The demo works from its own fixed date, so day counts say which date they start from. */
  isDemo: boolean
  newId: () => string
  onBack: () => void
  /** Saves the changed records; `base` is the revision the edit started on. */
  onChange: (data: FinanceData, base?: number) => Promise<SaveOutcome>
  onDeleted: (data: FinanceData, base?: number) => Promise<SaveOutcome>
  onReviewEmergency: () => void
}

function daysLeftText(days: number | null, today: CalendarDate, isDemo: boolean) {
  if (days === null) return 'No deadline'
  const from = isDemo ? ` from ${formatDate(today)}, the demo’s date` : ''
  if (days > 1) return `${days} days left${from}`
  if (days === 1) return `1 day left${from}`
  if (days === 0) return isDemo ? 'The target date is the demo’s date' : 'The target date is today'
  return isDemo ? `The target date was before ${formatDate(today)}, the demo’s date` : 'The target date has passed'
}

/**
 * One goal (or the emergency fund): progress, suggested pace, money in
 * and out, editing and its activity. Each movement says what it does to
 * Savings, so new money is counted once and moving existing savings
 * between purposes never makes Savings grow.
 */
export function GoalDetailScreen({ data, goal, today, isDemo, newId, onBack, onChange, onDeleted, onReviewEmergency }: Props) {
  const movementRef = useRef<GoalMovementHandle>(null)
  const currency = data.space.currency
  const money = (minor: number) => formatAmount(minor, currency)
  const progress = goalProgress(goal, data.goalMovements, today)
  const activity = goalMovementsOf(data.goalMovements, goal.id).reverse()
  const isEmergency = goal.kind === 'emergency'

  const [reachedNow, setReachedNow] = useState(false)
  const [editing, setEditing] = useState<GoalDraft | null>(null)
  const [editErrors, setEditErrors] = useState<GoalDraftErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision used when deleting this goal; the editor records its own base.
  const base = useEditBase()
  const [editBase, setEditBase] = useState(revision)
  const [sending, setSending] = useState<'edit' | 'delete' | null>(null)
  const [refusal, setRefusal] = useState<{ what: 'edit' | 'delete'; text: string } | null>(null)
  // The record chosen on the chart, shown in Savings Activity ('opening' for what was already saved).
  const [shownRecord, setShownRecord] = useState<{ key: string } | null>(null)
  useEffect(() => {
    if (!shownRecord) return
    const row = document.getElementById(`goal-record-${shownRecord.key}`)
    row?.focus({ preventScroll: true })
    row?.scrollIntoView?.({ block: 'center' })
  }, [shownRecord])
  // The goal editor counts as modified once it differs from the goal.
  useUnsavedChanges(`Edit goal: ${goal.name}`, editing ? { 'Name': editing.name, 'Target': editing.target, 'Has a date': editing.dated, 'Date': editing.dated ? editing.deadline : '' } : null)
  /** Saves one change; what was typed stays when it is not kept. */
  const send = async (what: NonNullable<typeof sending>, run: () => Promise<SaveOutcome>) => {
    setSending(what)
    return run().finally(() => setSending(null))
  }

  const saveEdit = async () => {
    if (!editing) return
    const read = readGoalDraft(editing, { today, owner: goal.owner, currentDeadline: goal.deadline })
    if (read.status === 'invalid') { setEditErrors(read.errors); return }
    const result = updateGoal(data, goal.id, read.fields)
    if (result.status !== 'valid') return
    setRefusal(null)
    const outcome = await send('edit', () => onChange(result.data, editBase))
    if (!isKept(outcome)) { setRefusal({ what: 'edit', text: outcomeText('', outcome) }); return }
    setEditing(null)
    setEditErrors({})
  }
  const remove = async () => {
    setRefusal(null)
    const outcome = await send('delete', () => onDeleted(deleteGoal(data, goal.id), base))
    if (!isKept(outcome)) setRefusal({ what: 'delete', text: outcomeText('', outcome) })
  }

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <div>
        <h1 className="tab-title">{goal.name}</h1>
        <p className="muted-note">
          {isEmergency ? 'Part of your Savings, for the unexpected' : goal.deadline ? `With Date · Target date: ${formatDate(goal.deadline)} · ${daysLeftText(progress.daysToDeadline, today, isDemo)}` : 'No deadline · Flexible'}
        </p>
      </div>

      <section className="goal-hero" aria-label="Progress">
        <b className="goal-hero-saved">{money(progress.saved)}</b>
        {progress.hasTarget && goal.target !== null
          ? <>
            <span>of {money(goal.target)} · {progress.percent.toFixed(1)}%</span>
            <div className="bar" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}>
              <div style={{ width: `${progress.percent}%`, background: ownerColor(data.space, goal.owner) }} />
            </div>
            <span>{progress.remaining > 0 ? `${money(progress.remaining)} still needed` : 'Goal reached'}</span>
            {reachedNow && <span className="goal-reached-badge" role="status"><Icon name="check" size={16} /> Goal reached</span>}
          </>
          : <span>Saved · no target set</span>}
      </section>

      {isEmergency ? <EmergencyCoverNote data={data} onReview={onReviewEmergency} /> : <>
        <GoalPace progress={progress} currency={currency} />
        <GoalExplore data={data} goal={goal} progress={progress} today={today} isDemo={isDemo} onChange={onChange} />
      </>}

      <GoalSavedOverTime data={data} goal={goal} today={today} money={money} onShowRecord={key => setShownRecord({ key })}
        onAddContribution={() => {
          movementRef.current?.addContribution()
          const input = document.getElementById('move-amount')
          input?.focus({ preventScroll: true }); input?.scrollIntoView?.({ block: 'center' })
        }} />

      <GoalMovementForm ref={movementRef} data={data} goal={goal} today={today} newId={newId} onChange={onChange}
        onSaved={(_amount, before, after) => setReachedNow(goal.target !== null && before < goal.target && after >= goal.target)} />

      <section className="block" aria-labelledby="goal-edit">
        <h2 id="goal-edit" className="section-title">{isEmergency ? 'Remove' : 'Edit Goal'}</h2>
        {editing
          ? <>
            <GoalFormFields idPrefix="edit-goal" draft={editing} errors={editErrors} currency={currency} onChange={setEditing} />
            {refusal?.what === 'edit' && <p className="field-error" role="alert">{refusal.text}</p>}
            <div className="inline-actions">
              <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => void saveEdit()}>{sending === 'edit' ? 'Saving…' : 'Save Changes'}</button>
              <button type="button" className="button-small" onClick={() => { setEditing(null); setEditErrors({}) }}>Cancel</button>
            </div>
          </>
          : <div className="inline-actions">
            {!isEmergency && <button type="button" className="button-small" onClick={() => { setEditBase(revision); setRefusal(null); setEditing(draftFromGoal(goal)); setConfirmDelete(false) }}>Change Name, Target or Date</button>}
            {!confirmDelete && <button type="button" className="button-small" onClick={() => setConfirmDelete(true)}>Delete {isEmergency ? 'Emergency Fund' : 'Goal'}</button>}
          </div>}
        {confirmDelete && !editing && (
          <div className="callout callout-warning" role="alert">
            <p>Delete “{goal.name}”{activity.length > 0 && ` and its ${activity.length} ${activity.length === 1 ? 'entry' : 'entries'}`}? This cannot be undone.
              {progress.saved > 0 ? ` Its ${money(progress.saved)} go back to unassigned savings; no balance changes.` : ' No other information changes.'}</p>
            <div className="inline-actions">
              <button type="button" className="button-small button-small-danger" aria-disabled={blocked || undefined} onClick={() => void remove()}>{sending === 'delete' ? 'Saving…' : `Delete ${isEmergency ? 'Emergency Fund' : 'Goal'}`}</button>
              <button type="button" className="button-small" onClick={() => setConfirmDelete(false)}>Keep {isEmergency ? 'It' : 'Goal'}</button>
            </div>
            {refusal?.what === 'delete' && <p className="field-error" role="alert">{refusal.text}</p>}
          </div>
        )}
      </section>

      <section className="block" aria-labelledby="goal-activity">
        <h2 id="goal-activity" className="section-title">Savings Activity</h2>
        {activity.length === 0 && goal.openingBalance === 0
          ? <p className="muted-note">No contributions yet.</p>
          : <ul className="line-list">
            {activity.map(item => (
              <li key={item.id} id={`goal-record-${item.id}`} tabIndex={-1} className={`line${shownRecord?.key === item.id ? ' is-target' : ''}`}>
                <span>{formatDate(item.date)}{item.note ? ` · ${item.note}` : ''}<small>{EFFECT_NAMES[item.effect]}</small></span>
                <b className={item.amount >= 0 ? 'amount-in' : ''}>{item.amount >= 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b>
              </li>
            ))}
            {goal.openingBalance > 0 && (
              <li id="goal-record-opening" tabIndex={-1} className={`line${shownRecord?.key === 'opening' ? ' is-target' : ''}`}><span>{formatDate(goal.createdOn)}<small>Already saved when it was added</small></span><b>{money(goal.openingBalance)}</b></li>
            )}
          </ul>}
      </section>
    </div>
  )
}

/** What the emergency fund covers, from its last review. Only what it holds counts. */
function EmergencyCoverNote({ data, onReview }: { data: FinanceData; onReview: () => void }) {
  const cover = emergencyCover(data)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const basis = cover.fund?.emergencyBasis
  return (
    <section className="block" aria-labelledby="emergency-cover">
      <h2 id="emergency-cover" className="section-title">Cover</h2>
      {basis && cover.months !== null
        ? <p>{money(cover.saved)} covers about {cover.months.toLocaleString('en-GB')} {cover.months === 1 ? 'month' : 'months'} of essential costs ({money(basis.monthlyEssentials)} a month, reviewed on {formatDate(basis.reviewedOn)}).</p>
        : <p>Review your essential costs to see how many months this fund covers.</p>}
      <p className="field-help">Only what this fund holds counts. Your other goals and investments are not included.</p>
      <button type="button" className="button-small align-start" onClick={onReview}>Review My Emergency Fund</button>
    </section>
  )
}
