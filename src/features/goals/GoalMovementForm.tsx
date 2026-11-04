import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { useEditBase, useWriteBlocked } from '../../app/writeStatus'
import { HelpTip } from '../../components/HelpTip'
import type { CalendarDate } from '../../domain/goalTime'
import { addGoalMovement, goalProgress, goalSaved, type MovementError, type MovementKind } from '../../domain/finance/goals'
import { savingsSummary } from '../../domain/finance/savings'
import type { FinanceData, Goal, MovementEffect } from '../../domain/finance/types'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { EFFECT_NAMES } from '../../ui/labels'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { NOTE_MAX_LENGTH, readMovementDraft, type MovementDraft, type MovementDraftErrors } from './goalDraft'

export type GoalMovementHandle = { addContribution: () => void }

type Props = {
  ref?: Ref<GoalMovementHandle>
  data: FinanceData; goal: Goal; today: CalendarDate; newId: () => string
  onChange: (data: FinanceData, base?: number) => Promise<SaveOutcome>
  contributionOnly?: boolean; onSaved?: (amount: number, before: number, after: number) => void
}

/** Same validation, save outcomes and money rules in Home and goal details. */
export function GoalMovementForm({ ref, data, goal, today, newId, onChange, contributionOnly = false, onSaved }: Props) {
  const currency = data.space.currency
  const amounts = useBlockAmounts(contributionOnly ? 'goals' : null, currency)
  const money = (minor: number | null) => minor === null ? (amounts.hidden ? '••••' : 'Not known') : amounts.money(minor)
  const progress = goalProgress(goal, data.goalMovements, today)
  const savings = savingsSummary(data)
  const savingsAccounts = data.moneyAccounts.filter(account => account.kind === 'savings')
  const hasAccounts = savingsAccounts.length > 0
  const defaultEffect = (kind: MovementKind): MovementEffect =>
    kind === 'contribution' ? (hasAccounts ? 'new-savings' : 'assigned') : 'unassigned'
  const emptyMovement = (kind: MovementKind): MovementDraft => ({ kind, amount: '', date: today, note: '' })
  const [movement, setMovement] = useState<MovementDraft>(() => emptyMovement('contribution'))
  const [effect, setEffect] = useState<MovementEffect>(() => defaultEffect('contribution'))
  const [accountId, setAccountId] = useState(savingsAccounts[0]?.id ?? '')
  const [movementErrors, setMovementErrors] = useState<MovementDraftErrors & { saved?: string }>({})
  const [savedResult, setSavedResult] = useState<{ amount: number; after: number; kind: MovementKind; effect: MovementEffect; outcome: SaveOutcome } | null>(null)
  const savedMessage = savedResult ? outcomeText(savedResult.kind === 'contribution'
    ? `Added ${money(savedResult.amount)} to ${goal.name} (${EFFECT_NAMES[savedResult.effect].toLowerCase()}).`
    : `Took out ${money(savedResult.amount)} (${EFFECT_NAMES[savedResult.effect].toLowerCase()}). ${goal.name} now has ${money(savedResult.after)}.`, savedResult.outcome) : ''
  const savingRef = useRef(false)
  const [sending, setSending] = useState(false)
  const blocked = useWriteBlocked()
  const base = useEditBase()
  const typedMovement = movement.amount.trim() !== '' || movement.note.trim() !== ''
  useUnsavedChanges(`Goal movement: ${goal.name}`, typedMovement ? {
    Kind: movement.kind, Amount: movement.amount, Date: movement.date, Note: movement.note,
    Account: savingsAccounts.find(account => account.id === accountId)?.name,
  } : null, { empty: {}, tag: contributionOnly ? 'rings-contribution' : undefined })
  const errorText = (error: MovementError) => {
    const account = savingsAccounts.find(a => a.id === accountId)
    switch (error) {
      case 'more-than-saved': return `You can take out up to ${money(progress.saved)}, what is saved in this goal.`
      case 'more-than-unassigned': return (savings.unassigned ?? 0) <= 0
        ? 'All your savings already have a purpose. Reduce another allocation first, or choose New savings if you’re adding new money.'
        : `Only ${money(savings.unassigned ?? 0)} of your savings has no purpose yet. Move that much or less, or choose New savings if you’re adding new money.`
      case 'account-balance-unknown': return `Enter the balance of ${account?.name ?? 'the savings account'} in Money first.`
      case 'before-balance-date': return `${account?.name ?? 'The account'} has a balance from a later date. Use that date or a later one.`
      case 'more-than-account': return `${account?.name ?? 'The account'} does not hold that much.`
      default: return 'This could not be saved. Check the amount and date.'
    }
  }

  const saveMovement = async () => {
    setSavedResult(null)
    const read = readMovementDraft(movement, today)
    if (read.status === 'invalid') { setMovementErrors(read.errors); return }
    const needsAccount = effect === 'new-savings' || effect === 'taken-out'
    const result = addGoalMovement(data, {
      id: newId(), goalId: goal.id, effect, amount: read.amount, date: read.date, note: read.note,
      ...(needsAccount ? { accountId } : {}),
    })
    if (result.status === 'rejected') { setMovementErrors({ amount: errorText(result.error) }); return }
    if (savingRef.current || blocked) return
    savingRef.current = true
    setSending(true)
    const outcome = await onChange(result.data, base).finally(() => { savingRef.current = false; setSending(false) })
    // The message only says what was confirmed as saved; the bar then moves from the old amount to the new one.
    const after = goalSaved(goal, result.data.goalMovements)
    setSavedResult({ amount: read.amount, after, kind: movement.kind, effect, outcome })
    if (!isKept(outcome)) return
    // Goal reached: once, when this contribution takes it to its target.
    onSaved?.(read.amount, progress.saved, after)
    setMovementErrors({})
    setMovement(emptyMovement(movement.kind))
  }

  const kindButton = (kind: MovementKind, label: string) => (
    <button type="button" aria-pressed={movement.kind === kind} className={movement.kind === kind ? 'is-active' : ''}
      onClick={() => { setMovement({ ...movement, kind }); setEffect(defaultEffect(kind)); setMovementErrors({}); setSavedResult(null) }}>{label}</button>
  )
  const effectOption = (value: MovementEffect, label: string, help: string, disabled = false) => (
    <label className={`effect-option${disabled ? ' is-disabled' : ''}`}>
      <input type="radio" name="movement-effect" value={value} checked={effect === value} disabled={disabled} onChange={() => { setEffect(value); setMovementErrors({}) }} />
      <span><b>{label}</b><small>{help}</small></span>
    </label>
  )
  useImperativeHandle(ref, () => ({ addContribution: () => { setMovement({ ...movement, kind: 'contribution' }); setEffect(defaultEffect('contribution')); setMovementErrors({}) } }))
  const fieldError = (id: string, text?: string) => text && <p id={id} className="field-error">{amounts.hidden && id === 'move-amount-error' ? 'Check the amount and available savings.' : text}</p>
  const unassignedText = savings.unassigned === null ? 'not known' : money(Math.max(savings.unassigned, 0))
  const needsAccount = effect === 'new-savings' || effect === 'taken-out'

  const read = readMovementDraft(movement, today)
  const preview = read.status === 'invalid' ? null : addGoalMovement(data, {
    id: 'preview-only', goalId: goal.id, effect, amount: read.amount, date: read.date, note: read.note,
    ...(needsAccount ? { accountId } : {}),
  })
  const previewSavings = preview?.status === 'ok' ? savingsSummary(preview.data) : null
  return (
      <section className="block" aria-labelledby="goal-move">
        <h2 id="goal-move" className="section-title">{contributionOnly ? 'Contribution' : 'Add or Take Out'}</h2>
        <div className="month-switch" role="group" aria-label="Type of change">
          {kindButton('contribution', 'Add')}
          {!contributionOnly && kindButton('withdrawal', 'Withdraw')}
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
        {movement.kind === 'contribution' && <div className="help-tips"><HelpTip topic="new-savings" label /></div>}
        {!hasAccounts && <p className="field-help">No savings account is entered, so only the goal is recorded. Add your savings account in Money to see your savings divided by purpose.</p>}
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
        {preview?.status === 'ok' && <dl className="fact-rows" aria-label="Effect before saving">
          <div><dt>Goal</dt><dd>{money(progress.saved)} → {money(goalSaved(goal, preview.data.goalMovements))}</dd></div>
          <div><dt>Unassigned savings</dt><dd>{money(savings.unassigned)} → {money(savingsSummary(preview.data).unassigned)}</dd></div>
          {savings.accounts.map(item => {
            const after = previewSavings?.accounts.find(a => a.account.id === item.account.id)?.balance ?? null
            return <div key={item.account.id}><dt>{item.account.name}</dt><dd>{money(item.balance)}{item.balance === after ? ' · no change' : <> → {money(after)}</>}</dd></div>
          })}
        </dl>}
        <button type="button" disabled={sending} className="button-small button-small-primary align-start" aria-disabled={blocked || undefined} onClick={() => void saveMovement()}>
          {sending ? 'Saving…' : `Save ${movement.kind === 'contribution' ? 'Contribution' : 'Withdrawal'}`}
        </button>
        <p className="muted-note" role="status">{savedMessage}</p>
        <p className="muted-note">This records the change. No money is moved between accounts and nothing is paid automatically.</p>
      </section>

  )
}
