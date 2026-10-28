import { useState } from 'react'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { useEditBase, useSaver } from '../../app/writeStatus'
import { isKept, type SaveOutcome } from '../../ui/saveOutcome'
import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../domain/goalTime'
import {
  AVERAGE_MONTHS, COVER_OPTIONS, confirmedEssentials, coverMonths, createEmergencyFundFromDraft, emergencyTarget, estimateEssentials,
  reviewEmergencyFund, type EssentialLine,
} from '../../domain/finance/emergency'
import { emergencyFund, goalSaved } from '../../domain/finance/goals'
import { savingsSummary } from '../../domain/finance/savings'
import type { FinanceData, Id, Owner } from '../../domain/finance/types'
import { formatAmount, formatDate, formatYearMonth } from '../../ui/format'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'

type Props = {
  data: FinanceData
  today: CalendarDate
  owner: Owner
  newId: () => string
  onBack: () => void
  /** Saves the fund; `base` is the revision the draft was opened on. Says what happened. */
  onSave: (data: FinanceData, base: number) => Promise<SaveOutcome>
  onOpenGoal: (id: Id) => void
}

type LineState = { essential: boolean; text: string }

const SOURCES = [
  { name: 'FINRA, “How to avoid bad financial luck” (13 Mar 2026)', note: 'Says a fund could eventually reach about three to six months of living expenses.' },
  { name: 'CFPB, “Start Small, Save Up” (15 Apr 2019)', note: 'Suggests starting small and building the habit, with no fixed number of months.' },
]

/**
 * The emergency fund draft (or the review of the fund that exists):
 *
 *   target = confirmed essential costs per month × months of cover
 *
 * The app proposes the lines from the records; the user decides which are
 * essential and can change any amount. Nothing is created, changed or
 * assigned until Create Emergency Fund (or Save Review) is pressed.
 * Savings for other goals and investments are never counted in it.
 */
export function EmergencyScreen({ data, today, owner, newId, onBack, onSave, onOpenGoal }: Props) {
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const fund = emergencyFund(data.goals)
  const estimate = estimateEssentials(data, today)
  const savings = savingsSummary(data)
  const available = Math.max(0, savings.unassigned ?? 0)
  const basis = fund?.emergencyBasis

  const [lines, setLines] = useState<Record<string, LineState>>(() => Object.fromEntries(estimate.lines.map(line => [line.key, {
    essential: line.essentialByDefault, text: amountText(line.monthly),
  }])))
  const [months, setMonths] = useState<string>(() => String(basis?.months ?? 3))
  const [setAside, setSetAside] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<Id | null>(null)
  const base = useEditBase()
  const saver = useSaver()
  const [sendingWith, setSendingWith] = useState<boolean | null>(null)
  useUnsavedChanges('Emergency Fund', done ? null : {
    ...Object.fromEntries(estimate.lines.map(line => [line.label, `${lines[line.key]?.text ?? ''}${lines[line.key]?.essential ? '' : ' (not essential)'}`])),
    'Months': months, 'Set aside now': setAside,
  })
  /** The fund shows as saved only once it is kept; otherwise the draft stays, with the reason. */
  const send = async (next: FinanceData, id: Id, withTarget: boolean) => {
    setSendingWith(withTarget)
    const outcome = await saver.save(() => onSave(next, base)).finally(() => setSendingWith(null))
    if (isKept(outcome)) setDone(id)
  }

  const confirmed = estimate.lines.map(line => ({ key: line.key, essential: lines[line.key].essential, monthly: parseMoneyInput(lines[line.key].text) }))
  const total = confirmedEssentials(confirmed)
  const monthCount = Number(months.replace(',', '.'))
  const validMonths = Number.isFinite(monthCount) && monthCount > 0 && monthCount <= 24
  const target = total.status === 'complete' && total.monthly > 0 && validMonths ? emergencyTarget(total.monthly, monthCount) : null
  const missingNames = total.status === 'incomplete' ? total.missing.map(key => estimate.lines.find(line => line.key === key)!.label) : []
  const held = fund ? goalSaved(fund, data.goalMovements) : 0

  if (done) {
    return (
      <div className="tab-screen">
        <h1 className="tab-title">Emergency Fund</h1>
        <p className="callout" role="status">Your Emergency Fund is saved.</p>
        <div className="inline-actions">
          <button type="button" className="button-small button-small-primary" onClick={() => onOpenGoal(done)}>Open Emergency Fund</button>
          <button type="button" className="button-small" onClick={onBack}>Back</button>
        </div>
      </div>
    )
  }

  const save = (withTarget: boolean) => {
    saver.clearRefusal()
    setError('')
    const chosenTarget = withTarget ? target : null
    if (withTarget && chosenTarget === null) { setError('Complete the essential costs and the months first, or save without a target.'); return }
    const fundBasis = withTarget && total.status === 'complete' ? { months: monthCount, monthlyEssentials: total.monthly, reviewedOn: today } : null
    if (fund) {
      const next = reviewEmergencyFund(data, fund.id, chosenTarget, fundBasis)
      if (!next) { setError('This review could not be saved.'); return }
      void send(next, fund.id, withTarget)
      return
    }
    const aside = setAside.trim() === '' ? 0 : parseMoneyInput(setAside)
    if (aside === null || aside < 0) { setError('Enter the money already set aside, such as 500, or leave it empty.'); return }
    if (aside > available) {
      setError(available <= 0
        ? 'All your savings already have a purpose. Reduce another allocation first, or leave this empty.'
        : `You can count at most ${money(available)}: the part of your Savings with no purpose yet.`)
      return
    }
    const created = createEmergencyFundFromDraft(data, { goalId: newId(), movementId: newId() }, owner, today,
      { target: chosenTarget, ...(fundBasis ? { basis: fundBasis } : {}), alreadySetAside: aside })
    if (created.status === 'rejected') {
      setError(created.error === 'fund-exists' ? 'You already have an Emergency Fund.' : created.error === 'more-than-unassigned'
        ? `You can count at most ${money(available)}.` : 'This draft could not be saved.')
      return
    }
    void send(created.data, created.goalId, withTarget)
  }

  const groups: { title: string; kinds: EssentialLine['kind'][] }[] = [
    { title: 'Bills', kinds: ['bill'] },
    { title: 'Required debt payments', kinds: ['debt'] },
    { title: 'Day-to-day spending', kinds: ['variable', 'annual'] },
  ]

  return (
    <div className="tab-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <h1 className="tab-title">{fund ? 'Review My Emergency Fund' : 'Start an Emergency Fund'}</h1>
      <p className="muted-note">
        Money kept for an unexpected cost or a month with less income, so you need to borrow less and the savings for your other goals stay where they are.
        This is a draft: nothing is created or changed until you confirm it below.
      </p>
      {fund && (
        <p className="callout">You already have an Emergency Fund. It holds {money(held)}{fund.target !== null ? ` of ${money(fund.target)}` : ', with no target'}.
          {basis ? ` Last reviewed on ${formatDate(basis.reviewedOn)}.` : ''} A review only changes its target: what it holds stays the same.</p>
      )}

      <section className="block" aria-labelledby="essentials-title">
        <h2 id="essentials-title" className="section-title">1. Essential costs per month</h2>
        <p className="field-help">
          Tick what you would still have to pay in a hard month: housing, basic food, utilities, the transport you need, health and the minimum debt payments.
          You decide: change any amount. Saving for your other goals is never an essential cost.
        </p>
        {groups.map(group => {
          const list = estimate.lines.filter(line => group.kinds.includes(line.kind))
          if (list.length === 0) return null
          return (
            <fieldset key={group.title} className="essential-group">
              <legend>{group.title}</legend>
              <ul className="line-list">
                {list.map(line => {
                  const state = lines[line.key]
                  const id = `essential-${line.key.replace(/[^a-z0-9-]/gi, '-')}`
                  return (
                    <li key={line.key} className="essential-line">
                      <label className="check-row" htmlFor={id}>
                        <input id={id} type="checkbox" checked={state.essential}
                          onChange={event => setLines({ ...lines, [line.key]: { ...state, essential: event.target.checked } })} />
                        <span>{line.label}<small>{line.method}</small></span>
                      </label>
                      <input className="quick-input" inputMode="decimal" aria-label={`${line.label} per month (${data.space.currency})`} value={state.text}
                        placeholder="Amount" onChange={event => setLines({ ...lines, [line.key]: { ...state, text: event.target.value } })} />
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )
        })}
        <p className="field-help">
          Bills use their usual amount now ({formatYearMonth(today.slice(0, 7))}); a yearly bill counts ÷ 12.
          Day-to-day spending is the average of up to {AVERAGE_MONTHS} complete months up to {formatYearMonth(estimate.throughMonth)}{' '}
          ({estimate.monthsWithRecords} with records), so one unusual month does not decide it.
        </p>
        {estimate.exceptional.length > 0 && (
          <details className="explain">
            <summary>One-off costs left out ({estimate.exceptional.length})</summary>
            <p>These happened once in the last 12 months. They are the kind of cost a fund is for, so they are not counted as a usual month.</p>
            <ul className="line-list">
              {estimate.exceptional.map(item => <li key={item.key} className="line"><span>{item.label}<small>{formatDate(item.date)} · {item.category}</small></span><b>{money(item.amount)}</b></li>)}
            </ul>
          </details>
        )}
        <p className="line total-line"><span>Essential costs per month</span>
          <b>{total.status === 'complete' ? money(total.monthly) : `${money(total.knownMonthly)} + ?`}</b></p>
        {total.status === 'incomplete' && (
          <p className="callout callout-warning" role="status"><b>Estimate incomplete.</b> No amount yet for {missingNames.join(', ')}. Enter it, untick it, or save the fund without a target.</p>
        )}
      </section>

      <section className="block" aria-labelledby="months-title">
        <h2 id="months-title" className="section-title">2. Months of cover</h2>
        <div className="segmented" role="group" aria-label="Months of cover">
          {COVER_OPTIONS.map(option => (
            <button key={option} type="button" aria-pressed={months === String(option)} className={months === String(option) ? 'is-active' : ''}
              onClick={() => setMonths(String(option))}>{option} {option === 1 ? 'month' : 'months'}</button>
          ))}
        </div>
        <label className="form-field" htmlFor="cover-months">Or another number of months</label>
        <input id="cover-months" className="quick-input" inputMode="decimal" value={months} aria-invalid={!validMonths} onChange={event => setMonths(event.target.value)} />
        {!validMonths && <p className="field-error">Enter a number of months from 0.5 to 24.</p>}
        <p className="field-help">One month can be a first milestone. Three to six months is a common rough reference, not a rule: what fits you depends on how steady your income is and what you can set aside.</p>
        <p className="line total-line"><span>Target</span><b>{target === null ? 'Not worked out' : money(target)}</b></p>
        {target !== null && total.status === 'complete' && <p className="field-help">{money(total.monthly)} × {monthCount.toLocaleString('en-GB')} {monthCount === 1 ? 'month' : 'months'}.
          {fund && held > 0 ? ` What it holds now covers about ${coverMonths(held, total.monthly)?.toLocaleString('en-GB')} months.` : ''}</p>}
      </section>

      {!fund && (
        <section className="block" aria-labelledby="aside-title">
          <h2 id="aside-title" className="section-title">3. Money already set aside (optional)</h2>
          <label className="form-field" htmlFor="already-aside">Part of your Savings to count in the fund ({data.space.currency})</label>
          <input id="already-aside" className="quick-input" inputMode="decimal" value={setAside} placeholder="0" onChange={event => setSetAside(event.target.value)} aria-describedby="already-aside-help" />
          <p id="already-aside-help" className="field-help">
            {savings.unassigned === null ? 'Savings is not known yet, so nothing can be counted now. You can add money to the fund later.'
              : `Up to ${money(available)}: the part of your Savings with no purpose yet. It is not new money, so Savings stays the same. Money for your other goals is not touched.`}
          </p>
          <p className="field-help">No date or monthly amount is needed.</p>
        </section>
      )}

      <details className="explain">
        <summary>Where these references come from</summary>
        <ul>
          {SOURCES.map(source => <li key={source.name}><b>{source.name}</b>: {source.note}</li>)}
        </ul>
        <p>They are general guidance, not advice for you, and no amount guarantees you will be covered.</p>
      </details>

      {error && <p className="field-error" role="alert">{error}</p>}
      {saver.refusal && <p className="field-error" role="alert">{saver.refusal}</p>}
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" disabled={target === null} aria-disabled={saver.blocked || undefined} onClick={() => save(true)}>
          {sendingWith === true ? 'Saving…' : fund ? 'Save Review' : 'Create Emergency Fund'}
        </button>
        <button type="button" className="button-small" aria-disabled={saver.blocked || undefined} onClick={() => save(false)}>{sendingWith === false ? 'Saving…' : fund ? 'Save Without a Target' : 'Create Without a Target'}</button>
        <button type="button" className="button-small" onClick={onBack}>Cancel</button>
      </div>
    </div>
  )
}
