import { useId, useRef, useState, type ReactNode } from 'react'
import { useLeaveGuard } from '../../app/unsavedChanges'
import { Icon } from '../../components/Icon'
import { yearMonthOf, type YearMonth } from '../../domain/calendar'
import { billsForMonth, summarizeBills, type BillOccurrence } from '../../domain/finance/bills'
import { summarizeCards } from '../../domain/finance/debts'
import { debtsRingProgress, goalsRingProgress, incomeRingProgress, nextDebtPayment } from '../../domain/finance/goalRings'
import { activeGoals, goalSaved } from '../../domain/finance/goals'
import type { FinanceData, Id } from '../../domain/finance/types'
import type { CalendarDate } from '../../domain/goalTime'
import { sumMinor } from '../../domain/money'
import { useBlockAmounts, type BlockAmounts } from '../../ui/amountVisibility'
import { formatDate, monthName } from '../../ui/format'
import type { ChangeSpace } from '../../ui/saveOutcome'
import { MarkPaidForm } from '../bills/MarkPaid'
import { billMonthOf, paidText } from '../bills/payment'
import type { RingCardContext } from './GoalRings'

/** Forms opened from the card: the ring asks before a change of section closes one with typed changes. */
export const RING_CARD_FORM = 'ring-card:'

type Props = {
  context: RingCardContext
  data: FinanceData
  month: YearMonth
  today: CalendarDate
  /** The date of the latest balances (Cards & Loans). */
  asOf: CalendarDate
  onChange: ChangeSpace
  onOpenBills: () => void
  onAddBill: () => void
  onOpenIncome: () => void
  onOpenDebts: () => void
  onOpenGoals: () => void
}

/**
 * Ring-first Home (UX-04.1, A+C): one card under the ring, for the selected
 * section. It says where the section stands and its next step. Bills is the
 * only section with an action of its own here (Review payment, saved with
 * Mark as Paid's rules); the others open what already exists in the app.
 */
export function RingCard(props: Props) {
  const area = props.context.area
  if (area === 'bills') return <BillsCard {...props} />
  if (area === 'income') return <IncomeCard {...props} />
  if (area === 'debts') return <DebtsCard {...props} />
  return <GoalsCard {...props} />
}

function CardFrame({ title, chip, chipTone, children }: { title: string; chip?: string; chipTone?: 'positive' | 'warning'; children: ReactNode }) {
  const id = useId()
  return (
    <section className="ring-card" aria-labelledby={id}>
      <div className="ring-card-head">
        <h2 id={id} className="ring-card-title">{title}</h2>
        {chip && <span className={`ring-chip${chipTone ? ` is-${chipTone}` : ''}`}>{chip}</span>}
      </div>
      {children}
    </section>
  )
}

/** An amount as text, or the mask; screen readers hear "amount hidden" instead of the mask. */
function Amount({ minor, amounts }: { minor: number; amounts: BlockAmounts }) {
  if (!amounts.hidden) return <>{amounts.money(minor)}</>
  return <><span aria-hidden="true">{amounts.money(minor)}</span><span className="visually-hidden">{amounts.spoken(minor)}</span></>
}

const AREA_NAMES = { income: 'Income', bills: 'Bills', debts: 'Cards & Loans', goals: 'Goals' } as const

function Footer({ context, open, openLabel }: { context: RingCardContext; open?: () => void; openLabel?: string }) {
  return (
    <div className="ring-card-links">
      <button type="button" className="text-button" aria-label={`View ${AREA_NAMES[context.area]} details`} onClick={context.openDetails}>View details</button>
      {open && openLabel && <button type="button" className="text-button" data-return-key="ring-card-open" onClick={open}>{openLabel} <Icon name="arrowRight" size={16} /></button>}
    </div>
  )
}

function NextStep({ title, detail, action }: { title: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ring-next">
      <span className="ring-eyebrow">Next step</span>
      <p className="ring-next-title">{title}</p>
      {detail && <p className="ring-next-detail">{detail}</p>}
      {action}
    </div>
  )
}

const byDue = (a: BillOccurrence, b: BillOccurrence) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name)

function BillsCard({ context, data, month, today, onChange, onOpenBills, onAddBill }: Props) {
  const amounts = useBlockAmounts('left-to-pay', data.space.currency)
  const guard = useLeaveGuard()
  const [reviewing, setReviewing] = useState<Id | null>(null)
  const [showOthers, setShowOthers] = useState(false)
  const [showPaid, setShowPaid] = useState(false)
  const [saved, setSaved] = useState<{ text: string; completion?: string } | null>(null)
  const focusSaved = useRef(false)
  const focusAfterCancel = useRef<Id | null>(null)
  const name = monthName(month)
  const occurrences = billsForMonth(data, month)
  const summary = summarizeBills(occurrences)
  const unpaid = occurrences.filter(item => !item.paid).sort(byDue)
  const paid = occurrences.filter(item => item.paid).sort(byDue)
  const current = yearMonthOf(today) === month
  const debtName = (item: BillOccurrence) => (item.bill.debtId ? data.debts.find(debt => debt.id === item.bill.debtId)?.name ?? null : null)
  const due = (item: BillOccurrence) => (current && item.dueDate < today ? `overdue since ${formatDate(item.dueDate)}` : `due ${formatDate(item.dueDate)}`)
  const amountOf = (item: BillOccurrence) => (item.amount === null ? 'Amount needed' : <Amount minor={item.amount} amounts={amounts} />)
  const chip = summary.count ? `${summary.paidCount} of ${summary.count} paid` : undefined
  const tone = summary.count && summary.paidCount === summary.count ? 'positive' : undefined

  const review = (id: Id) => guard(form => !!form.tag?.startsWith(RING_CARD_FORM), () => {
    setSaved(null)
    setReviewing(id)
  })
  const reviewButton = (item: BillOccurrence, primary: boolean) => (
    <button type="button" className={`button-small${primary ? ' button-small-primary ring-cta' : ''}`} data-review={item.bill.id}
      aria-label={`Review payment: ${item.bill.name}`} ref={element => { if (element && focusAfterCancel.current === item.bill.id) { focusAfterCancel.current = null; element.focus() } }}
      onClick={() => review(item.bill.id)}>Review payment</button>
  )

  const savedNote = saved && <>
    <p className="muted-note paid-note ring-saved" tabIndex={-1} ref={element => {
      if (!element || !focusSaved.current) return
      focusSaved.current = false
      element.focus({ preventScroll: true })
      context.revealRing()
    }}><span className="paid-check" aria-hidden="true"><Icon name="check" size={14} /></span>{saved.text}</p>
    {saved.completion && <p className="muted-note paid-completion" role="status">{saved.completion}</p>}
  </>

  const paidList = paid.length > 0 && <>
    <button type="button" className="text-button align-start" aria-expanded={showPaid} aria-controls="ring-paid-bills" onClick={() => setShowPaid(!showPaid)}>
      {showPaid ? 'Hide paid bills' : `Paid bills (${paid.length})`}
    </button>
    {showPaid && <ul id="ring-paid-bills" className="line-list ring-bill-list">{paid.map(item => (
      <li key={item.bill.id} className="line">
        <span>{item.bill.name}<small>{paidText(data, billMonthOf(data, item)) || 'Paid'}</small></span>
        <b>{amountOf(item)}</b>
      </li>
    ))}</ul>}
  </>

  if (!summary.count) return (
    <CardFrame title={`Bills · ${name}`}>
      <div className="ring-empty">
        <p className="ring-state-title">No bills this month</p>
        <p className="muted-note">You haven’t added any bills for {name}. This isn’t the same as all bills paid.</p>
        <button type="button" className="button-small button-small-primary align-start" onClick={onAddBill}>Add Bill</button>
      </div>
      <Footer context={context} open={onOpenBills} openLabel="Open Bills" />
    </CardFrame>
  )

  const reviewed = reviewing ? unpaid.find(item => item.bill.id === reviewing) ?? null : null
  if (reviewed) return (
    <CardFrame title={`Bills · ${name}`} chip={chip}>
      <MarkPaidForm key={reviewed.bill.id} data={data} occurrence={reviewed} today={today} hidden={amounts.hidden} onChange={onChange} variant="review"
        tag={`${RING_CARD_FORM}bills:${reviewed.bill.id}`}
        onSaved={(text, completion) => { setReviewing(null); setSaved({ text, completion }); focusSaved.current = true }}
        onCancel={() => { focusAfterCancel.current = reviewed.bill.id; setReviewing(null) }} />
    </CardFrame>
  )

  if (!unpaid.length) {
    const paidTotal = sumMinor(paid.flatMap(item => (item.amount === null ? [] : [item.amount])))
    return (
      <CardFrame title={`Bills · ${name}`} chip={chip} chipTone={tone}>
        {savedNote}
        <div className="ring-done" role="group" aria-label="All bills paid">
          <p className="ring-state-title is-positive"><Icon name="target" size={22} />All bills paid!</p>
          <p>Nothing left to pay this month.</p>
          <p className="muted-note">{summary.paidCount} of {summary.count} bills paid.</p>
          <p>Paid this month: <b><Amount minor={paidTotal} amounts={amounts} /></b>{paid.some(item => item.amount === null) && ' + unknown'}</p>
        </div>
        {paidList}
        <Footer context={context} open={onOpenBills} openLabel="Open Bills" />
      </CardFrame>
    )
  }

  const [next, ...others] = unpaid
  const debt = debtName(next)
  return (
    <CardFrame title={`Bills · ${name}`} chip={chip}>
      {savedNote}
      <NextStep title={`Pay ${next.bill.name}`}
        detail={<>{!amounts.hidden && <>{amountOf(next)} · </>}{amounts.hidden ? due(next).replace(/^./, c => c.toUpperCase()) : due(next)}{debt && ` · linked to ${debt}`}</>}
        action={reviewButton(next, true)} />
      <p className="muted-note ring-left">
        {unpaid.length === 1 ? `This is the last bill for ${name}.` : `${unpaid.length} bills left`}
        {!amounts.hidden && unpaid.length > 1 && <> · Left to pay <Amount minor={summary.leftToPay} amounts={amounts} />{summary.unpaidUnknownCount > 0 && ' + unknown'}</>}
      </p>
      {others.length > 0 && <>
        <button type="button" className="text-button align-start" aria-expanded={showOthers} aria-controls="ring-other-bills" onClick={() => setShowOthers(!showOthers)}>
          {showOthers ? 'Hide other bills' : `Other bills to pay (${others.length})`}
        </button>
        {showOthers && <ul id="ring-other-bills" className="line-list ring-bill-list">{others.map(item => {
          const linked = debtName(item)
          return (
            <li key={item.bill.id} className="line ring-bill">
              <span>{item.bill.name}<small>{amounts.hidden ? due(item).replace(/^./, c => c.toUpperCase()) : <>{amountOf(item)} · {due(item)}</>}{linked && ` · linked to ${linked}`}</small></span>
              {reviewButton(item, false)}
            </li>
          )
        })}</ul>}
      </>}
      {paidList}
      <Footer context={context} open={onOpenBills} openLabel="Open Bills" />
    </CardFrame>
  )
}

function IncomeCard({ context, data, month, onOpenIncome }: Props) {
  const amounts = useBlockAmounts('month', data.space.currency)
  const income = incomeRingProgress(data, month)
  const name = monthName(month)
  const chip = amounts.hidden ? 'Hidden' : income.percent === null ? 'No forecast' : `${Math.round(income.percent)}% received`
  const expected = income.lines.filter(line => line.expected !== null && line.source)
    .sort((a, b) => (a.payDate ?? '').localeCompare(b.payDate ?? ''))
  const next = expected[0]
  return (
    <CardFrame title={`Income · ${name}`} chip={chip} chipTone={!amounts.hidden && income.percent === 100 ? 'positive' : undefined}>
      {next?.source && next.expected !== null
        ? <NextStep title={`Record ${next.source.name} when it arrives`}
          detail={amounts.hidden ? (next.payDate ? `Expected ${formatDate(next.payDate)}` : 'Expected this month') : <><Amount minor={next.expected} amounts={amounts} /> expected{next.payDate && ` · ${formatDate(next.payDate)}`}</>}
          action={<button type="button" className="button-small button-small-primary ring-cta" onClick={onOpenIncome}>Open Income</button>} />
        : <p className="ring-state-title">{income.lines.length ? 'All expected income is in.' : `No income set up for ${name}.`}</p>}
      <p>{amounts.hidden ? 'Amounts hidden' : <><Amount minor={income.received} amounts={amounts} /> received · {income.hasForecast ? <><Amount minor={income.expected} amounts={amounts} /> expected</> : 'No expected income set'}</>}</p>
      <p className="field-help">Received share of this month’s income, including extra income. Not a fixed plan, and not your bank balance.</p>
      <Footer context={context} open={next ? undefined : onOpenIncome} openLabel="Open Income" />
    </CardFrame>
  )
}

function DebtsCard({ context, data, month, asOf, onOpenDebts }: Props) {
  const amounts = useBlockAmounts('goals', data.space.currency)
  const progress = debtsRingProgress(data, month)
  const cards = summarizeCards(data, month, asOf)
  const name = monthName(month)
  const debtIds = new Set(data.debts.map(debt => debt.id))
  const nextLinked = billsForMonth(data, month).filter(item => !item.paid && item.bill.debtId && debtIds.has(item.bill.debtId)).sort(byDue)[0]
  const coverage = progress.unverifiedCount ? `${progress.unverifiedCount} ${progress.unverifiedCount === 1 ? 'debt' : 'debts'} without a linked bill` : ''
  const chip = !data.debts.length ? undefined : coverage ? 'Partial coverage' : progress.count ? `${progress.paidCount} of ${progress.count} paid` : 'Nothing to track'
  const tone = coverage ? 'warning' : progress.count && progress.paidCount === progress.count ? 'positive' : undefined
  if (!data.debts.length) return (
    <CardFrame title="Cards & Loans">
      <p className="ring-state-title">No cards or loans yet</p>
      <Footer context={context} open={onOpenDebts} openLabel="Open Cards & Loans" />
    </CardFrame>
  )
  return (
    <CardFrame title="Cards & Loans" chip={chip} chipTone={tone}>
      {nextLinked
        ? <NextStep title={`Pay ${nextLinked.bill.name}`} detail={<>Due {formatDate(nextLinked.dueDate)} · paid from Bills</>}
          action={<button type="button" className="button-small button-small-primary ring-cta" onClick={() => context.select('bills')}>Show in Bills</button>} />
        : progress.count > 0 && <p className="ring-state-title">All tracked payments made for {name}.</p>}
      <p>{progress.count ? `${progress.paidCount} of ${progress.count} ${coverage ? 'tracked payments' : 'payments'} made this month.` : 'No tracked payments this month.'}</p>
      <p className="field-help">Monthly payments from linked bills, not debt repaid.{coverage && ` Partial coverage: ${coverage}; excluded from tracked payments.`}</p>
      <ul className="line-list ring-bill-list">{cards.items.map(item => {
        const payment = nextDebtPayment(data, item.debt, asOf)
        return (
          <li key={item.debt.id} className="line">
            <span>{item.debt.name}<small>{payment ? <>Next payment {payment.amount === null ? 'not known' : <Amount minor={payment.amount} amounts={amounts} />} · {formatDate(payment.dueDate)}</> : 'No next payment planned'}</small></span>
            <b>{item.balance === null ? 'Not known' : <Amount minor={item.balance} amounts={amounts} />}</b>
          </li>
        )
      })}</ul>
      <p className="field-help">Remaining Balance, as last entered{cards.missingBalanceCount > 0 ? ' · Some balances unknown' : ''}.</p>
      <Footer context={context} open={onOpenDebts} openLabel="Open Cards & Loans" />
    </CardFrame>
  )
}

function GoalsCard({ context, data, onOpenGoals }: Props) {
  const amounts = useBlockAmounts('goals', data.space.currency)
  const progress = goalsRingProgress(data)
  const chip = amounts.hidden ? 'Hidden' : progress.percent === null ? undefined : `${Math.round(progress.percent)}%`
  const open = activeGoals(data.goals).map(goal => ({ goal, saved: goalSaved(goal, data.goalMovements) }))
  // The goal to add to next: the one with the nearest target date that is not reached yet, else the first one not reached.
  const candidates = open.filter(item => item.goal.target === null || item.saved < item.goal.target)
  const next = [...candidates].sort((a, b) => (a.goal.deadline ?? '9999').localeCompare(b.goal.deadline ?? '9999'))[0]
  return (
    <CardFrame title="Goals" chip={chip} chipTone={!amounts.hidden && progress.percent === 100 ? 'positive' : undefined}>
      {next
        ? <NextStep title="Add a Contribution"
          detail={<>{next.goal.name}{!amounts.hidden && next.goal.target !== null && <> · <Amount minor={next.saved} amounts={amounts} /> of <Amount minor={next.goal.target} amounts={amounts} /></>}{next.goal.deadline && ` · by ${formatDate(next.goal.deadline)}`}</>}
          action={<button type="button" className="button-small button-small-primary ring-cta" aria-label={`Add a Contribution to ${next.goal.name}`} onClick={() => context.openGoal(next.goal.id)}>Add a Contribution</button>} />
        : <p className="ring-state-title">{open.length ? 'Every goal has reached its target.' : 'No goals yet'}</p>}
      <p>{amounts.hidden ? 'Amounts hidden' : !progress.count ? 'No goals with a target yet' : <><Amount minor={progress.saved} amounts={amounts} /> saved · <Amount minor={progress.counted} amounts={amounts} /> of <Amount minor={progress.target} amounts={amounts} /> counted toward targets</>}</p>
      <p className="field-help">Current goals and contributions, not a historical snapshot.</p>
      <Footer context={context} open={onOpenGoals} openLabel="Open Goals" />
    </CardFrame>
  )
}
