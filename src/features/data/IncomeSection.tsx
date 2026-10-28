import { useContext, useEffect, useRef, useState } from 'react'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { yearMonthOf, type YearMonth } from '../../domain/calendar'
import { deleteIncomeSource, isSourceActiveIn, monthIncome, recordIncomeReceived, saveIncomeSource } from '../../domain/finance/income'
import type { FinanceData, Id, IncomeSource } from '../../domain/finance/types'
import { countByValidity, matchesValidity, usableFilter, validityOn } from '../../domain/finance/validity'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'
import { DataBlockFrame } from './DataBlockFrame'
import { DataBlocksContext, setBlockOpen } from './dataBlocks'
import type { SectionProps } from './DataScreen'
import { ValidityFilterBar, ValidityTag } from './ValidityFilterBar'
import { useWriteBlocked, useWriteStatus } from '../../app/writeStatus'
import { isKept, type SaveOutcome } from '../../ui/saveOutcome'

type SourceForm = { id: Id | null; name: string; amount: string; payDay: string; startMonth: string; endMonth: string; error?: string }
type ReceivedForm = { sourceId: Id; month: YearMonth; amount: string; date: string; error?: string }

/**
 * Income and pay days. A compact list of sources first (usual amount,
 * pay day, months and status); opening one shows its months, with what
 * was expected and what really arrived, and its actions.
 */
export function IncomeSection({ data, months, today, isDemo, owner, newId, onChange, say }: SectionProps) {
  const { view, onViewChange } = useContext(DataBlocksContext)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const [editing, setEditing] = useState<SourceForm | null>(null)
  const [receiving, setReceiving] = useState<ReceivedForm | null>(null)
  const { revision } = useWriteStatus()
  const blocked = useWriteBlocked()
  // The revision each form was opened on, and which change is being saved.
  const [editBase, setEditBase] = useState(revision)
  const [receivingBase, setReceivingBase] = useState(revision)
  const [sending, setSending] = useState<'source' | 'received' | null>(null)
  /** Saves one change and says what happened. */
  const save = async (done: string, change: (data: FinanceData) => FinanceData, base?: number, what: typeof sending = null): Promise<SaveOutcome> => {
    setSending(what)
    const outcome = await onChange(change, base).finally(() => setSending(null))
    say(done, outcome)
    return outcome
  }
  /** Opens (or changes) the Record Received form; opening it on another month starts a new edit. */
  const changeReceiving = (form: ReceivedForm | null) => {
    if (form && (form.sourceId !== receiving?.sourceId || form.month !== receiving?.month)) setReceivingBase(revision)
    setReceiving(form)
  }
  const focusField = useRef<string | null>(null)
  // Status always uses today's month (the demo's date in the demo), never a month chosen to look at a payment.
  const reference = yearMonthOf(today)
  const counts = countByValidity(data.incomeSources, reference)
  const filter = usableFilter(view.incomeFilter, counts)
  const shown = data.incomeSources.filter(source => matchesValidity(source, reference, filter))
  const sourceCount = data.incomeSources.length

  useEffect(() => {
    if (!focusField.current) return
    document.getElementById(focusField.current)?.focus()
    focusField.current = null
  })

  const startNew = () => {
    onViewChange(setBlockOpen(view, 'income', true))
    setEditBase(revision)
    setEditing({ id: null, name: '', amount: '', payDay: '', startMonth: reference, endMonth: '' })
    focusField.current = 'income-name'
  }

  const saveSource = async () => {
    if (!editing) return
    const amount = parseMoneyInput(editing.amount)
    const payDay = /^\d{1,2}$/.test(editing.payDay.trim()) ? Number(editing.payDay) : NaN
    if (amount === null) { setEditing({ ...editing, error: 'Enter the usual net amount, such as 6500.' }); return }
    const id = editing.id ?? newId()
    const memberId = data.incomeSources.find(s => s.id === id)?.memberId ?? (owner === 'shared' ? data.space.members[0].id : owner)
    const fields = { name: editing.name, amount, payDay, startMonth: editing.startMonth, endMonth: editing.endMonth || null }
    if (saveIncomeSource(data, id, memberId, fields).status !== 'ok') { setEditing({ ...editing, error: 'Check the name, the pay day (1 to 31) and the months.' }); return }
    const outcome = await save('Income saved.', current => {
      const result = saveIncomeSource(current, id, memberId, fields)
      return result.status === 'ok' ? result.data : current
    }, editBase, 'source')
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

  const form = editing && (
    <div className="form-stack edit-box">
      <Field id="income-name" label="Name" value={editing.name} onChange={name => setEditing({ ...editing, name, error: undefined })} maxLength={60} />
      <Field id="income-amount" label={`Usual Net Amount per Month (${data.space.currency})`} inputMode="decimal" value={editing.amount} onChange={amount => setEditing({ ...editing, amount, error: undefined })} />
      <Field id="income-day" label="Pay Day" inputMode="numeric" value={editing.payDay} onChange={payDay => setEditing({ ...editing, payDay, error: undefined })} help="Day of the month it usually arrives." />
      <Field id="income-start" label="First Month" type="month" value={editing.startMonth} onChange={startMonth => setEditing({ ...editing, startMonth })} />
      <Field id="income-end" label="Last Month (optional)" type="month" value={editing.endMonth} onChange={endMonth => setEditing({ ...editing, endMonth })} />
      {editing.error && <p className="field-error" role="alert">{editing.error}</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" aria-disabled={blocked || undefined} onClick={() => void saveSource()}>{sending === 'source' ? 'Saving…' : 'Save Income'}</button>
        <button type="button" className="button-small" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </div>
  )

  const summary = sourceCount === 0 ? 'No income entered yet'
    : [`${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`, `${counts.active} active`, ...(counts.upcoming > 0 ? [`${counts.upcoming} upcoming`] : [])].join(' · ')

  return (
    <DataBlockFrame block="income" summary={summary}
      actions={<button type="button" className="button-small" onClick={startNew}><Icon name="plus" size={16} /> Add Income</button>}>
      <p className="field-help">Expected income is a plan. Home shows it as expected until you record what arrived.</p>
      {editing?.id === null && form}
      {sourceCount === 0 && !editing && (
        <div className="empty-state">
          <p className="muted-note">No income entered yet. Add what you usually receive each month, such as a salary.</p>
          <button type="button" className="button-small align-start" onClick={startNew}><Icon name="plus" size={16} /> Add Your First Income</button>
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
                    <SourcePayments data={data} source={source} months={months} reference={reference} today={today} money={money}
                      receiving={receiving} onReceivingChange={changeReceiving} onSaveReceived={() => void saveReceived(source)} saving={sending === 'received'}
                      onNotReceived={m => void save(`${formatYearMonth(m)} is expected again.`, current => recordIncomeReceived(current, source, m, null) ?? current)} />
                    {editing?.id === source.id ? form : (
                      <div className="inline-actions">
                        <button type="button" className="button-small" onClick={() => {
                          setEditBase(revision)
                          setEditing({ id: source.id, name: source.name, amount: amountText(source.amount), payDay: String(source.payDay), startMonth: source.startMonth, endMonth: source.endMonth ?? '' })
                          focusField.current = 'income-name'
                        }}>Edit {source.name}</button>
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
    </DataBlockFrame>
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
}

/**
 * The months of one source in a chosen period: the expected amount and
 * pay date, and what really arrived and when. Months go up to the last
 * month the app plans (or the source's first month, if it starts later).
 */
function SourcePayments({ data, source, months, reference, today, money, receiving, onReceivingChange, onSaveReceived, onNotReceived, saving }: PaymentsProps) {
  const blocked = useWriteBlocked()
  const lastPlanned = months[months.length - 1] ?? reference
  const last = source.endMonth !== null && source.endMonth < lastPlanned ? source.endMonth
    : lastPlanned < source.startMonth ? source.startMonth : lastPlanned
  const firstYear = Number(source.startMonth.slice(0, 4))
  const lastYear = Number(last.slice(0, 4))
  const years = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => String(firstYear + index))
  const referenceYear = reference.slice(0, 4)
  const [period, setPeriod] = useState(years.includes(referenceYear) ? referenceYear : years[years.length - 1])
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
          <li key={month}>
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
