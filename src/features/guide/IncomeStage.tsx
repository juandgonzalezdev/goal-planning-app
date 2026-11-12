import { useEffect, useRef, useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { Icon } from '../../components/Icon'
import { yearMonthOf } from '../../domain/calendar'
import { useAllAmounts } from '../../ui/amountVisibility'
import { isKept, outcomeText } from '../../ui/saveOutcome'
import { IncomeSourceForm } from '../money/IncomeSourceForm'
import { incomeFormTitle, incomeTypedFields, newIncomeDraft, prepareIncomeSave, type IncomeSourceDraft } from '../money/incomeDraft'
import { Amount } from './Amount'
import type { StageProps } from './stageProps'

/**
 * Income inside Getting Started (GS-3), with Money's own form (GS-2:
 * `IncomeSourceForm` and `incomeDraft.ts`). This stage is the host: it keeps
 * the draft, registers it, saves it on the revision it was opened on, and
 * stays here after a save so another source can be added. A new source
 * belongs to the person (Individual) or to the first person (Duo), as in
 * Money; choosing the person is D-GS5 (GS-6).
 */
export function IncomeStage({ data, today, owner, newId, onChange }: StageProps) {
  const [draft, setDraft] = useState<IncomeSourceDraft | null>(null)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  const [base, setBase] = useState(revision)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  useUnsavedChanges(incomeFormTitle(draft), incomeTypedFields(draft))
  const focus = useRef<string | null>(null)
  useEffect(() => {
    if (!focus.current) return
    document.getElementById(focus.current)?.focus()
    focus.current = null
  })

  const start = () => {
    setBase(revision)
    setDraft(newIncomeDraft(yearMonthOf(today)))
    setMessage('')
    focus.current = 'income-name'
  }
  const save = async () => {
    if (!draft || sending) return
    const prepared = prepareIncomeSave(data, draft, { owner, newId })
    if ('error' in prepared) { setDraft({ ...draft, error: prepared.error }); return }
    setSending(true)
    const outcome = await onChange(prepared.apply, base).finally(() => setSending(false))
    if (outcome === 'stale') return
    setMessage(outcomeText('Income saved.', outcome))
    if (isKept(outcome)) { setDraft(null); focus.current = 'gs-add-income' }
  }
  const cancel = () => { setDraft(null); focus.current = 'gs-add-income' }
  const sources = data.incomeSources
  // Hide amounts (the header eye) covers these amounts, as in Bills and History.
  const amounts = useAllAmounts(data.space.currency)

  return (
    <div className="gs-records">
      {sources.length === 0
        ? <p className="muted-note">No income yet.</p>
        : <ul className="gs-list" aria-label="Your income">
          {sources.map(source => (
            <li key={source.id}>
              <span><span className="item-name">{source.name}</span><small>Pay day {source.payDay}</small></span>
              <b><Amount text={amounts.money(source.amount)} spoken={amounts.spoken(source.amount)} hidden={amounts.hidden} /> / month</b>
            </li>
          ))}
        </ul>}
      <p className="muted-note" role="status">{message}</p>
      {draft
        ? <IncomeSourceForm draft={draft} onDraftChange={setDraft} currency={data.space.currency} saving={sending} blocked={blocked}
          onSave={() => void save()} onCancel={cancel} />
        : <button id="gs-add-income" type="button" className="button-small align-start" onClick={start}>
          <Icon name="plus" size={16} /> {sources.length === 0 ? 'Add Income' : 'Add Another Income'}
        </button>}
    </div>
  )
}
