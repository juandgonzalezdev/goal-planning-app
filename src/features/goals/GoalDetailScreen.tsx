import { useState } from 'react'
import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import { addGoalMovement, deleteGoal, goalMovementsOf, goalProgress, updateGoal, type MovementError, type MovementKind } from '../../domain/finance/goals'
import { savingsSummary } from '../../domain/finance/savings'
import { ownerColor } from '../../domain/finance/space'
import type { FinanceData, Goal, MovementEffect } from '../../domain/finance/types'
import { formatAmount, formatDate } from '../../ui/format'
import { EFFECT_NAMES } from '../../ui/labels'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { useEditBase, useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { GoalFormFields } from './GoalFormFields'
import { draftFromGoal, NOTE_MAX_LENGTH, readGoalDraft, readMovementDraft, type GoalDraft, type GoalDraftErrors, type MovementDraft, type MovementDraftErrors } from './goalDraft'
import { GoalExplore } from './GoalExplore'
import { GoalPace } from './GoalPace'
import { emergencyCover } from '../../domain/finance/emergency'

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
  const currency = data.space.currency
  const money = (minor: number) => formatAmount(minor, currency)
  const progress = goalProgress(goal, data.goalMovements, today)
  const activity = goalMovementsOf(data.goalMovements, goal.id).reverse()
  const savings = savingsSummary(data)
  const savingsAccounts = data.moneyAccounts.filter(account => account.kind === 'savings')
  const hasAccounts = savingsAccounts.length > 0
  const isEmergency = goal.kind === 'emergency'

  const defaultEffect = (kind: MovementKind): MovementEffect =>
    kind === 'contribution' ? (hasAccounts ? 'new-savings' : 'assigned') : 'unassigned'
  const emptyMovement = (kind: MovementKind): MovementDraft => ({ kind, amount: '', date: today, note: '' })
  const [movement, setMovement] = useState<MovementDraft>(() => emptyMovement('contribution'))
  const [effect, setEffect] = useState<MovementEffect>(() => defaultEffect('contribution'))
  const [accountId, setAccountId] = useState(savingsAccounts[0]?.id ?? '')
  const [movementErrors, setMovementErrors] = useState<MovementDraftErrors & { saved?: string }>({})
  const [savedMessage, setSavedMessage] = useState('')
  const [editing, setEditing] = useState<GoalDraft | null>(null)
  const [editErrors, setEditErrors] = useState<GoalDraftErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision this screen (Add or Take Out) and the goal editor were opened on.
  const base = useEditBase()
  const [editBase, setEditBase] = useState(revision)
  const [sending, setSending] = useState<'movement' | 'edit' | 'delete' | null>(null)
  const [refusal, setRefusal] = useState<{ what: 'edit' | 'delete'; text: string } | null>(null)
  /** Saves one change; what was typed stays when it is not kept. */
  const send = async (what: NonNullable<typeof sending>, run: () => Promise<SaveOutcome>) => {
    setSending(what)
    return run().finally(() => setSending(null))
  }

  const errorText = (error: MovementError) => {
    const account = savingsAccounts.find(a => a.id === accountId)
    switch (error) {
      case 'more-than-saved': return `You can take out up to ${money(progress.saved)}, what is saved in this goal.`
      case 'more-than-unassigned': return (savings.unassigned ?? 0) <= 0
        ? 'All your savings already have a purpose. Reduce another allocation first, or choose New savings if you’re adding new money.'
        : `Only ${money(savings.unassigned ?? 0)} of your savings has no purpose yet. Move that much or less, or choose New savings if you’re adding new money.`
      case 'account-balance-unknown': return `Enter the balance of ${account?.name ?? 'the savings account'} in Data first.`
      case 'before-balance-date': return `${account?.name ?? 'The account'} has a balance from a later date. Use that date or a later one.`
      case 'more-than-account': return `${account?.name ?? 'The account'} does not hold that much.`
      default: return 'This could not be saved. Check the amount and date.'
    }
  }

  const saveMovement = async () => {
    setSavedMessage('')
    const read = readMovementDraft(movement, today)
    if (read.status === 'invalid') { setMovementErrors(read.errors); return }
    const needsAccount = effect === 'new-savings' || effect === 'taken-out'
    const result = addGoalMovement(data, {
      id: newId(), goalId: goal.id, effect, amount: read.amount, date: read.date, note: read.note,
      ...(needsAccount ? { accountId } : {}),
    })
    if (result.status === 'rejected') { setMovementErrors({ amount: errorText(result.error) }); return }
    const outcome = await send('movement', () => onChange(result.data, base))
    setSavedMessage(outcomeText(`${movement.kind === 'contribution' ? 'Added' : 'Took out'} ${money(read.amount)} (${EFFECT_NAMES[effect].toLowerCase()}).`, outcome))
    if (!isKept(outcome)) return
    setMovementErrors({})
    setMovement(emptyMovement(movement.kind))
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

  const kindButton = (kind: MovementKind, label: string) => (
    <button type="button" aria-pressed={movement.kind === kind} className={movement.kind === kind ? 'is-active' : ''}
      onClick={() => { setMovement({ ...movement, kind }); setEffect(defaultEffect(kind)); setMovementErrors({}); setSavedMessage('') }}>{label}</button>
  )
  const effectOption = (value: MovementEffect, label: string, help: string, disabled = false) => (
    <label className={`effect-option${disabled ? ' is-disabled' : ''}`}>
      <input type="radio" name="movement-effect" value={value} checked={effect === value} disabled={disabled} onChange={() => { setEffect(value); setMovementErrors({}) }} />
      <span><b>{label}</b><small>{help}</small></span>
    </label>
  )
  const fieldError = (id: string, text?: string) => text && <p id={id} className="field-error">{text}</p>
  const unassignedText = savings.unassigned === null ? 'not known' : money(Math.max(savings.unassigned, 0))
  const needsAccount = effect === 'new-savings' || effect === 'taken-out'

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> {isEmergency ? 'Back' : 'All Goals'}</button>
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
          </>
          : <span>Saved · no target set</span>}
      </section>

      {isEmergency ? <EmergencyCoverNote data={data} onReview={onReviewEmergency} /> : <>
        <GoalPace progress={progress} currency={currency} />
        <GoalExplore data={data} goal={goal} progress={progress} today={today} isDemo={isDemo} onChange={onChange} />
      </>}

      <section className="block" aria-labelledby="goal-move">
        <h2 id="goal-move" className="section-title">Add or Take Out</h2>
        <div className="month-switch" role="group" aria-label="Type of change">
          {kindButton('contribution', 'Add')}
          {kindButton('withdrawal', 'Withdraw')}
        </div>
        <fieldset className="effect-list">
          <legend>{movement.kind === 'contribution' ? 'Where is the money from?' : 'Where does the money go?'}</legend>
          {movement.kind === 'contribution' ? <>
            {effectOption('new-savings', 'New savings', 'Money you saved now. It adds to your Savings once.', !hasAccounts)}
            {effectOption('assigned', 'Savings I already have', `Gives a purpose to unassigned savings (${unassignedText}). Savings stay the same.`)}
          </> : <>
            {effectOption('unassigned', 'Back to unassigned savings', 'The money stays in Savings, with no purpose. Savings stay the same.')}
            {effectOption('taken-out', 'Out of my savings', 'You spent it or moved it out of Savings. Savings go down.', !hasAccounts)}
          </>}
        </fieldset>
        {!hasAccounts && <p className="field-help">No savings account is entered, so only the goal is recorded. Add your savings account in Data to see your savings divided by purpose.</p>}
        <div className="form-stack">
          {needsAccount && savingsAccounts.length > 1 && (
            <div className="form-field">
              <label htmlFor="move-account">Savings Account</label>
              <select id="move-account" value={accountId} onChange={e => setAccountId(e.target.value)}>
                {savingsAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
          )}
          {needsAccount && savingsAccounts.length === 1 && <p className="field-help">Savings account: {savingsAccounts[0].name}</p>}
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
        <button type="button" className="button-small button-small-primary align-start" aria-disabled={blocked || undefined} onClick={() => void saveMovement()}>
          {sending === 'movement' ? 'Saving…' : `Save ${movement.kind === 'contribution' ? 'Contribution' : 'Withdrawal'}`}
        </button>
        <p className="muted-note" role="status">{savedMessage}</p>
        <p className="muted-note">This records the change. No money is moved between accounts and nothing is paid automatically.</p>
      </section>

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
              <li key={item.id} className="line">
                <span>{formatDate(item.date)}{item.note ? ` · ${item.note}` : ''}<small>{EFFECT_NAMES[item.effect]}</small></span>
                <b className={item.amount >= 0 ? 'amount-in' : ''}>{item.amount >= 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b>
              </li>
            ))}
            {goal.openingBalance > 0 && (
              <li className="line"><span>{formatDate(goal.createdOn)}<small>Already saved when it was added</small></span><b>{money(goal.openingBalance)}</b></li>
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
