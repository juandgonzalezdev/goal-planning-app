import { useState } from 'react'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import type { YearMonth } from '../../domain/calendar'
import { deleteIncomeSource, monthIncome, recordIncomeReceived, saveIncomeSource } from '../../domain/finance/income'
import type { Id, IncomeSource } from '../../domain/finance/types'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'
import type { SectionProps } from './DataScreen'

/** Income and pay days: the usual amount of each source, and what actually arrived each month. */
export function IncomeSection({ data, months, today, owner, newId, onChange, say }: SectionProps) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const [editing, setEditing] = useState<{ id: Id | null; name: string; amount: string; payDay: string; startMonth: string; endMonth: string; error?: string } | null>(null)
  const [receiving, setReceiving] = useState<{ sourceId: Id; month: YearMonth; amount: string; date: string; error?: string } | null>(null)

  const saveSource = () => {
    if (!editing) return
    const amount = parseMoneyInput(editing.amount)
    const payDay = /^\d{1,2}$/.test(editing.payDay.trim()) ? Number(editing.payDay) : NaN
    if (amount === null) { setEditing({ ...editing, error: 'Enter the usual net amount, such as 6500.' }); return }
    const id = editing.id ?? newId()
    const memberId = data.incomeSources.find(s => s.id === id)?.memberId ?? (owner === 'shared' ? data.space.members[0].id : owner)
    let ok = false
    const outcome = onChange(current => {
      const result = saveIncomeSource(current, id, memberId, { name: editing.name, amount, payDay, startMonth: editing.startMonth, endMonth: editing.endMonth || null })
      ok = result.status === 'ok'
      return result.status === 'ok' ? result.data : current
    })
    if (!ok) { setEditing({ ...editing, error: 'Check the name, the pay day (1 to 31) and the months.' }); return }
    setEditing(null)
    say('Income saved.', outcome)
  }

  const saveReceived = (source: IncomeSource) => {
    if (!receiving) return
    const amount = parseMoneyInput(receiving.amount)
    if (amount === null) { setReceiving({ ...receiving, error: 'Enter the amount that arrived.' }); return }
    if (!receiving.date || receiving.date > today) { setReceiving({ ...receiving, error: 'Choose a date that is not after today.' }); return }
    const id = newId()
    const outcome = onChange(current => recordIncomeReceived(current, source, receiving.month, { id, amount, receivedOn: receiving.date }) ?? current)
    setReceiving(null)
    say(`Income for ${formatYearMonth(receiving.month)} recorded.`, outcome)
  }

  return (
    <section className="block" aria-labelledby="data-income">
      <div className="section-head">
        <h2 id="data-income" className="section-title">Income</h2>
        <button type="button" className="button-small" onClick={() => setEditing({ id: null, name: '', amount: '', payDay: '', startMonth: months[0], endMonth: '' })}><Icon name="plus" size={16} /> Add Income</button>
      </div>
      <p className="field-help">Expected income is a plan. Home shows it as expected until you record what arrived.</p>
      {data.incomeSources.length === 0 && !editing && <p className="muted-note">No income entered yet.</p>}
      {editing && (
        <div className="form-stack edit-box">
          <Field id="income-name" label="Name" value={editing.name} onChange={name => setEditing({ ...editing, name, error: undefined })} maxLength={60} />
          <Field id="income-amount" label={`Usual Net Amount per Month (${data.space.currency})`} inputMode="decimal" value={editing.amount} onChange={amount => setEditing({ ...editing, amount, error: undefined })} />
          <Field id="income-day" label="Pay Day" inputMode="numeric" value={editing.payDay} onChange={payDay => setEditing({ ...editing, payDay, error: undefined })} help="Day of the month it usually arrives." />
          <Field id="income-start" label="First Month" type="month" value={editing.startMonth} onChange={startMonth => setEditing({ ...editing, startMonth })} />
          <Field id="income-end" label="Last Month (optional)" type="month" value={editing.endMonth} onChange={endMonth => setEditing({ ...editing, endMonth })} />
          {editing.error && <p className="field-error" role="alert">{editing.error}</p>}
          <div className="inline-actions">
            <button type="button" className="button-small button-small-primary" onClick={saveSource}>Save Income</button>
            <button type="button" className="button-small" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
      {data.incomeSources.map(source => (
        <div key={source.id} className="record">
          <div className="bill-line"><b>{source.name}</b><b>{money(source.amount)}</b></div>
          <small className="muted-note">Pay day {source.payDay} · from {formatYearMonth(source.startMonth)}{source.endMonth ? ` to ${formatYearMonth(source.endMonth)}` : ''}</small>
          <ul className="line-list">
            {months.map(m => {
              const line = monthIncome(data, m).lines.find(l => l.source?.id === source.id)
              if (!line) return null
              const isOpen = receiving?.sourceId === source.id && receiving.month === m
              return (
                <li key={m}>
                  <div className="line">
                    <span>{formatYearMonth(m)}<small>{line.received ? `Received on ${formatDate(line.received.receivedOn)}` : `Expected on ${formatDate(line.payDate!)}`}</small></span>
                    <b>{line.received ? money(line.received.amount) : `${money(line.expected ?? 0)} expected`}</b>
                  </div>
                  {!isOpen
                    ? <div className="inline-actions">
                      <button type="button" className="text-button" aria-label={`Record ${source.name} received in ${formatYearMonth(m)}`}
                        onClick={() => setReceiving({ sourceId: source.id, month: m, amount: amountText(line.received?.amount ?? source.amount), date: line.received?.receivedOn ?? (line.payDate! <= today ? line.payDate! : today) })}>
                        {line.received ? 'Change' : 'Record Received'}
                      </button>
                      {line.received && <button type="button" className="text-button" onClick={() => say(`${formatYearMonth(m)} is expected again.`, onChange(current => recordIncomeReceived(current, source, m, null) ?? current))}>Not Received</button>}
                    </div>
                    : <div className="form-stack edit-box">
                      <Field id="received-amount" label={`Amount Received (${data.space.currency})`} inputMode="decimal" value={receiving.amount} onChange={amount => setReceiving({ ...receiving, amount, error: undefined })} error={receiving.error} />
                      <Field id="received-date" label="Date Received" type="date" max={today} value={receiving.date} onChange={date => setReceiving({ ...receiving, date, error: undefined })} />
                      <div className="inline-actions">
                        <button type="button" className="button-small button-small-primary" onClick={() => saveReceived(source)}>Save</button>
                        <button type="button" className="button-small" onClick={() => setReceiving(null)}>Cancel</button>
                      </div>
                    </div>}
                </li>
              )
            })}
          </ul>
          <div className="inline-actions">
            <button type="button" className="text-button" onClick={() => setEditing({ id: source.id, name: source.name, amount: amountText(source.amount), payDay: String(source.payDay), startMonth: source.startMonth, endMonth: source.endMonth ?? '' })}>Edit {source.name}</button>
            <button type="button" className="text-button" onClick={() => say(`${source.name} removed. Income already received stays.`, onChange(current => deleteIncomeSource(current, source.id)))}>Remove</button>
          </div>
        </div>
      ))}
    </section>
  )
}
