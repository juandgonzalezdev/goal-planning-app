import { HelpTip } from '../../components/HelpTip'
import { useContext, useEffect, useRef, useState } from 'react'
import { useLeaveGuard, useUnsavedChanges } from '../../app/unsavedChanges'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { yearMonthOf, type YearMonth } from '../../domain/calendar'
import { deleteIncomeSource, isSourceActiveIn, monthIncome, recordIncomeReceived } from '../../domain/finance/income'
import type { FinanceData, Id, IncomeSource } from '../../domain/finance/types'
import { countByValidity, matchesValidity, usableFilter, validityOn } from '../../domain/finance/validity'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'
import { MoneyBlockFrame } from './MoneyBlockFrame'
import { IncomeSourceForm } from './IncomeSourceForm'
import { editIncomeDraft, incomeFormTitle, incomeTypedFields, newIncomeDraft, prepareIncomeSave, type IncomeSourceDraft } from './incomeDraft'
import { MoneyBlocksContext, setBlockOpen } from './moneyBlocks'
import type { SectionProps } from './MoneyScreen'
import { ValidityFilterBar, ValidityTag } from '../../components/ValidityFilterBar'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { isKept, type SaveOutcome } from '../../ui/saveOutcome'

/** `fromHome`: opened by + Add on Home, so Cancel goes back there. */
type SourceForm = IncomeSourceDraft & { fromHome?: boolean }
type ReceivedForm = { sourceId: Id; month: YearMonth; amount: string; date: string; error?: string }

/**
 * Income and pay days. A compact list of sources first (usual amount,
 * pay day, months and status); opening one shows its months, with what
 * was expected and what really arrived, and its actions.
 */
export function IncomeSection({ data, months, today, isDemo, owner, newId, onChange, say, startAdding, onStartedAdding, onCancelAdding }: SectionProps) {
  const { view, onViewChange } = useContext(MoneyBlocksContext)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  // + Add Income on Home: a new income form, open from the start (the request is used once, below).
  const [editing, setEditing] = useState<SourceForm | null>(() => (startAdding
    ? { ...newIncomeDraft(yearMonthOf(today)), fromHome: true } : null))
  const [receiving, setReceiving] = useState<ReceivedForm | null>(null)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision each form was opened on, and which change is being saved.
  const [editBase, setEditBase] = useState(revision)
  const [receivingBase, setReceivingBase] = useState(revision)
  const [sending, setSending] = useState<'source' | 'received' | null>(null)
  const sourceForm = useUnsavedChanges(incomeFormTitle(editing), incomeTypedFields(editing))
  const receivedForm = useUnsavedChanges(`Income received: ${data.incomeSources.find(source => source.id === receiving?.sourceId)?.name ?? ''}`,
    receiving ? { 'Month': receiving.month, 'Amount': receiving.amount, 'Date': receiving.date } : null)
  /** Saves one change and says what happened. */
  const save = async (done: string, change: (data: FinanceData) => FinanceData, base?: number, what: typeof sending = null): Promise<SaveOutcome> => {
    setSending(what)
    const outcome = await onChange(change, base).finally(() => setSending(null))
    say(done, outcome)
    return outcome
  }
  /** Opens (or changes) the Record Received form; opening it on another month starts a new edit. */
  const changeReceiving = (form: ReceivedForm | null) => {
    const another = !!form && (form.sourceId !== receiving?.sourceId || form.month !== receiving?.month)
    // Another month or source takes the place of the one being recorded: the app asks first.
    guard(f => another && f.id === receivedForm.id, () => {
      if (another) setReceivingBase(revision)
      setReceiving(form)
    })
  }
  // The income form for another source (or a new one) takes the place of the one open: the app asks first.
  const guard = useLeaveGuard()
  const openSource = (next: SourceForm) => guard(f => f.id === sourceForm.id, () => {
    setEditBase(revision)
    setEditing(next)
    focusField.current = 'income-name'
  })
  const focusField = useRef<string | null>(null)
  // Status always uses today's month (the demo's date in the demo), never a month chosen to look at a payment.
  const reference = yearMonthOf(today)
  const counts = countByValidity(data.incomeSources, reference)
  const filter = usableFilter(view.incomeFilter, counts)
  const shown = data.incomeSources.filter(source => matchesValidity(source, reference, filter))
  const sourceCount = data.incomeSources.length

  // Income on Home opened this block for one month: which sources that month has, without choosing one for you.
  const contextMonth = view.incomeMonth
  const contextLines = contextMonth ? monthIncome(data, contextMonth).lines : []
  const contextSources = contextLines.flatMap(line => (line.source ? [line.source] : []))
  const unnamed = contextLines.filter(line => !line.source).length
  const showSource = (source: IncomeSource) => {
    onViewChange({ ...setBlockOpen(view, 'income', true), incomeSource: source.id, incomeFilter: matchesValidity(source, reference, view.incomeFilter) ? view.incomeFilter : 'all' })
    focusField.current = `[data-income-row="${source.id}:${contextMonth}"] button`
  }
  const context = contextMonth && (
    <div id="income-context" className="callout income-context" tabIndex={-1} role="group" aria-label={`Income on Home for ${formatYearMonth(contextMonth)}`}>
      <p><b>Income on Home for {formatYearMonth(contextMonth)}</b></p>
      {contextSources.length === 0 && unnamed === 0 && <p>No income is expected or recorded for that month. Add Income, or record what arrived in a source.</p>}
      {contextSources.length === 1 && <p>It comes from {contextSources[0].name}.</p>}
      {contextSources.length > 1 && <p>It comes from {contextSources.length} sources. Open one to see that month.</p>}
      {unnamed > 0 && <p>{unnamed === 1 ? 'One amount was' : `${unnamed} amounts were`} recorded without a source. It is in History.</p>}
      <div className="inline-actions">
        {contextSources.length > 1 && contextSources.map(source => (
          <button key={source.id} type="button" className="button-small" aria-pressed={view.incomeSource === source.id} onClick={() => showSource(source)}>{source.name}</button>
        ))}
        <button type="button" className="button-small" onClick={() => onViewChange({ ...view, incomeMonth: null })}>Close</button>
      </div>
    </div>
  )

  useEffect(() => {
    if (!focusField.current) return
    const target = focusField.current
    ;(target.startsWith('[') ? document.querySelector<HTMLElement>(target) : document.getElementById(target))?.focus()
    focusField.current = null
  })

  useEffect(() => { if (startAdding) onStartedAdding?.() }, [startAdding, onStartedAdding])
  /** Cancel closes the form; opened from + Add on Home, it also goes back there. */
  const cancelSource = () => {
    const fromHome = editing?.fromHome
    setEditing(null)
    if (fromHome) onCancelAdding?.()
  }

  const startNew = () => {
    onViewChange(setBlockOpen(view, 'income', true))
    openSource(newIncomeDraft(reference))
  }

  const saveSource = async () => {
    if (!editing) return
    const prepared = prepareIncomeSave(data, editing, { owner, newId })
    if ('error' in prepared) { setEditing({ ...editing, error: prepared.error }); return }
    const outcome = await save('Income saved.', prepared.apply, editBase, 'source')
    // Not kept: the form stays as typed; the message says why.
    if (isKept(outcome)) setEditing(null)
  }

  const saveReceived = async (source: IncomeSource) => {
    if (!receiving) return
    const amount = parseMoneyInput(receiving.amount)
    if (amount === null) { setReceiving({ ...receiving, error: 'Enter the amount that arrived.' }); return }
    if (!receiving.date || receiving.date > today) { setReceiving({ ...receiving, error: 'Choose a date that is not after today.' }); return }
    const id = newId()
    const { month, date } = receiving
    const outcome = await save(`Income for ${formatYearMonth(month)} recorded.`,
      current => recordIncomeReceived(current, source, month, { id, amount, receivedOn: date }) ?? current, receivingBase, 'received')
    if (isKept(outcome)) setReceiving(null)
  }

  // `fromHome` (Cancel goes back to Home) stays with the draft while the form changes it.
  const form = editing && (
    <IncomeSourceForm draft={editing} onDraftChange={draft => setEditing({ ...editing, ...draft })} currency={data.space.currency}
      saving={sending === 'source'} blocked={blocked} onSave={() => void saveSource()} onCancel={cancelSource} />
  )

  const summary = sourceCount === 0 ? 'No income yet'
    : [`${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`, `${counts.active} active`, ...(counts.upcoming > 0 ? [`${counts.upcoming} upcoming`] : [])].join(' · ')

  return (
    <MoneyBlockFrame block="income" summary={summary}
      actions={<button type="button" className="button-small" onClick={startNew}><Icon name="plus" size={16} /> Add Income</button>}>
      <div className="help-tips"><HelpTip topic="money-income" label /></div>
      {context}
      {editing?.id === null && form}
      {sourceCount === 0 && !editing && (
        <div className="empty-state">
          <p className="muted-note">No income yet.</p>
        </div>
      )}
      {sourceCount > 0 && <>
        <ValidityFilterBar label="Income sources" value={filter} counts={counts} today={today} isDemo={isDemo}
          onChange={incomeFilter => onViewChange({ ...view, incomeFilter })} />
        {shown.length === 0 && <p className="muted-note">No {filter} income sources. Choose All to see every source.</p>}
        <ul className="line-list compact-list">
          {shown.map(source => {
            const open = view.incomeSource === source.id
            const detailId = `income-source-${source.id}`
            return (
              <li key={source.id} className={`compact-item${open ? ' is-open' : ''}`}>
                <button type="button" className="line line-button" aria-expanded={open} aria-controls={open ? detailId : undefined}
                  onClick={() => onViewChange({ ...view, incomeSource: open ? null : source.id })}>
                  <span>
                    <span className="item-name">{source.name} <ValidityTag validity={validityOn(source, reference)} /></span>
                    <small>{money(source.amount)} expected each month · Pay day {source.payDay}</small>
                    <small>{source.endMonth ? `${formatYearMonth(source.startMonth)} to ${formatYearMonth(source.endMonth)}` : `From ${formatYearMonth(source.startMonth)} · no end month`}</small>
                  </span>
                  <span className="item-chevron"><Icon name="chevronDown" size={16} /></span>
                </button>
                {open && (
                  <div id={detailId} className="item-detail">
                    <SourcePayments key={`${source.id}:${view.incomeMonth ?? ''}`} focusMonth={view.incomeMonth} data={data} source={source} months={months} reference={reference} today={today} money={money}
                      receiving={receiving} onReceivingChange={changeReceiving} onSaveReceived={() => void saveReceived(source)} saving={sending === 'received'}
                      onNotReceived={m => void save(`${formatYearMonth(m)} is expected again.`, current => recordIncomeReceived(current, source, m, null) ?? current)} />
                    {editing?.id === source.id ? form : (
                      <div className="inline-actions">
                        <button type="button" className="button-small" onClick={() => openSource(editIncomeDraft(source))}>Edit {source.name}</button>
                        <button type="button" className="button-small" aria-label={`Remove ${source.name}`}
                          aria-disabled={blocked || undefined} onClick={() => void save(`${source.name} removed. Income already received stays.`, current => deleteIncomeSource(current, source.id))}>Remove</button>
                      </div>
                    )}
                    <p className="field-help">Remove takes away the expected income. What already arrived stays in History.</p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </>}
    </MoneyBlockFrame>
  )
}

type PaymentsProps = {
  data: FinanceData
  source: IncomeSource
  months: YearMonth[]
  reference: YearMonth
  today: string
  money: (minor: number) => string
  receiving: ReceivedForm | null
  onReceivingChange: (form: ReceivedForm | null) => void
  onSaveReceived: () => void
  onNotReceived: (month: YearMonth) => void
  /** The Record Received form is being saved. */
  saving: boolean
  /** A month opened from Home: the period starts on its year. */
  focusMonth: YearMonth | null
}

/**
 * The months of one source in a chosen period: the expected amount and
 * pay date, and what really arrived and when. Months go up to the last
 * month the app plans (or the source's first month, if it starts later).
 */
function SourcePayments({ data, source, months, reference, today, money, receiving, onReceivingChange, onSaveReceived, onNotReceived, saving, focusMonth }: PaymentsProps) {
  const blocked = useWriteBlocked()
  const lastPlanned = months[months.length - 1] ?? reference
  const last = source.endMonth !== null && source.endMonth < lastPlanned ? source.endMonth
    : lastPlanned < source.startMonth ? source.startMonth : lastPlanned
  const firstYear = Number(source.startMonth.slice(0, 4))
  const lastYear = Number(last.slice(0, 4))
  const years = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => String(firstYear + index))
  const referenceYear = reference.slice(0, 4)
  const focusYear = focusMonth?.slice(0, 4)
  const [period, setPeriod] = useState(focusYear && years.includes(focusYear) ? focusYear : years.includes(referenceYear) ? referenceYear : years[years.length - 1])
  const usedPeriod = period === 'all' || years.includes(period) ? period : years[years.length - 1]
  const shownYears = usedPeriod === 'all' ? years : [usedPeriod]
  const rows = shownYears.flatMap(year => Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`))
    .filter(month => isSourceActiveIn(source, month) && month <= last)
  const selectId = `income-period-${source.id}`

  return <>
    <div className="form-field period-field">
      <label htmlFor={selectId}>Payments of {source.name}</label>
      <select id={selectId} value={usedPeriod} onChange={event => setPeriod(event.target.value)}>
        {years.map(year => <option key={year} value={year}>{year}</option>)}
        {years.length > 1 && <option value="all">All years</option>}
      </select>
    </div>
    {rows.length === 0 && <p className="muted-note">No payments are expected in this period.</p>}
    <ul className="line-list payment-list">
      {rows.map(month => {
        const line = monthIncome(data, month).lines.find(item => item.source?.id === source.id)
        if (!line) return null
        const isOpen = receiving?.sourceId === source.id && receiving.month === month
        return (
          <li key={month} data-income-row={`${source.id}:${month}`} className={month === focusMonth ? 'is-target' : undefined}>
            <div className="line">
              <span>{formatYearMonth(month)}
                <small>Expected: {money(source.amount)} on {formatDate(line.payDate!)}</small>
                <small>{line.received ? `Received: ${money(line.received.amount)} on ${formatDate(line.received.receivedOn)}` : 'Received: not recorded yet'}</small>
              </span>
              <b className={`payment-state${line.received ? ' is-received' : ''}`}>{line.received ? 'Received' : 'Expected'}</b>
            </div>
            {!isOpen
              ? <div className="inline-actions">
                <button type="button" className="text-button" aria-label={`${line.received ? 'Change' : 'Record Received'}: ${source.name}, ${formatYearMonth(month)}`}
                  onClick={() => onReceivingChange({ sourceId: source.id, month, amount: amountText(line.received?.amount ?? source.amount), date: line.received?.receivedOn ?? (line.payDate! <= today ? line.payDate! : today) })}>
                  {line.received ? 'Change' : 'Record Received'}
                </button>
                {line.received && <button type="button" className="text-button" aria-label={`Not Received: ${source.name}, ${formatYearMonth(month)}`} aria-disabled={blocked || undefined} onClick={() => onNotReceived(month)}>Not Received</button>}
              </div>
              : <div className="form-stack edit-box">
                <Field id="received-amount" label={`Amount Received (${data.space.currency})`} inputMode="decimal" value={receiving.amount} onChange={amount => onReceivingChange({ ...receiving, amount, error: undefined })} error={receiving.error} />
                <Field id="received-date" label="Date Received" type="date" max={today} value={receiving.date} onChange={date => onReceivingChange({ ...receiving, date, error: undefined })} />
                <div className="inline-actions">
                  <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={onSaveReceived}>{saving ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="button-small" onClick={() => onReceivingChange(null)}>Cancel</button>
                </div>
              </div>}
          </li>
        )
      })}
    </ul>
  </>
}
