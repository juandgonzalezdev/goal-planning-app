import { useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useLeaveGuard } from '../../app/unsavedChanges'
import type { YearMonth } from '../../domain/calendar'
import type { CalendarDate } from '../../domain/goalTime'
import { billsRingProgress, debtsRingProgress, goalsRingProgress, incomeRingProgress, goalMonthPosition, nextDebtPayment, type RingArea } from '../../domain/finance/goalRings'
import { AnimatedSaved } from './AnimatedSaved'
import { billsForMonth, summarizeBills } from '../../domain/finance/bills'
import { summarizeCards } from '../../domain/finance/debts'
import { goalProgress } from '../../domain/finance/goals'
import { savingsSummary } from '../../domain/finance/savings'
import type { FinanceData } from '../../domain/finance/types'
import { useBlockAmounts } from '../../ui/amountVisibility'
import { formatDate, formatYearMonth } from '../../ui/format'
import type { SaveOutcome } from '../../ui/saveOutcome'
import { GoalMovementForm } from '../goals/GoalMovementForm'
import { BillCelebrationContext } from '../../app/writeStatus'
import { pulseAt } from './bullseye'
import { pointAt, RING_AREAS, SECTION_ANGLES, sectionHitPolygon, sectionPath } from './ringGeometry'
import { useMediaQuery } from '../../ui/useMediaQuery'
import './goalRings.css'

type Area = RingArea
export type RingsView = 'all' | Area | `goal:${string}`
const AREAS: Area[] = ['income', 'bills', 'debts', 'goals']
const NAMES = { income: 'Income', bills: 'Bills', debts: 'Cards & Loans', goals: 'Goals' }
/** Change to false to show the current value immediately when opening a goal. */
export const DRAW_GOAL_ON_OPEN = true

type Props = {
  /** The parent FoldBlock supplies the root heading and landmark. */
  embedded?: boolean
  selection?: Area; onSelectionChange?: (area: Area) => void
  data: FinanceData; month: YearMonth; today: CalendarDate; asOf: CalendarDate
  newId: () => string; onChange: (data: FinanceData, base?: number) => Promise<SaveOutcome>
  onOpen: (area: Area) => void
  view?: RingsView; onViewChange?: (view: RingsView) => void
  /**
   * Ring-first Home: the card shown under the ring for the selected area, instead of View details and Open.
   * The centre still opens the details (UX-03); the card only adds the area's next step.
   */
  card?: (context: RingCardContext) => ReactNode
}

/** What the Ring-first card can ask of the ring it belongs to. */
export type RingCardContext = {
  area: Area
  /** The same details the centre opens. */
  openDetails: () => void
  /** A goal's detail inside the ring, where Add Contribution already is. */
  openGoal: (id: string) => void
  select: (area: Area) => void
  /** Brings the ring back into view after a change made from the card, so the update (and any Pulse) is seen. */
  revealRing: () => void
}

const ease = (x: number) => 1 - (1 - x) ** 3

function SectionFill({ index, percent, replay, reduced }: { index: number; percent: number; replay: number; reduced: boolean }) {
  const [shown, setShown] = useState(0)
  const current = useRef(0)
  const priorReplay = useRef(replay)
  useEffect(() => {
    if (reduced) return
    let frame = 0, start: number | null = null
    const from = priorReplay.current === replay ? current.current : 0
    priorReplay.current = replay
    const step = (now: number) => {
      start ??= now
      const t = Math.min(1, Math.max(0, (now - start - (replay ? 0 : index * 60)) / 520))
      current.current = from + (percent - from) * ease(t)
      setShown(current.current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [index, percent, replay, reduced])
  return <path className="rings-band-sweep four-fill" d={sectionPath(index, (reduced ? percent : shown) / 100)} data-final-percent={percent} />
}

function RingNumber({ value, format, reduced }: { value: number; format: (n: number) => string; reduced: boolean }) {
  const [shown, setShown] = useState(0)
  const current = useRef(0)
  useEffect(() => {
    if (reduced) return
    let frame = 0, start: number | null = null
    const from = current.current, duration = Math.min(700, 380 + 40 * String(Math.abs(Math.round(value))).length)
    const step = (now: number) => {
      start ??= now
      const t = Math.min(1, (now - start) / duration)
      current.current = from + (value - from) * ease(t)
      setShown(Math.round(current.current))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  return <strong className="four-value" aria-hidden="true">{format(reduced ? value : shown)}</strong>
}


type AreaPresentation = {
  name: string; short: string; accessible: string; percent: number | null
  value?: number; format: (n: number) => string; main?: string; context: string; pill: string
  glyph?: 'target' | 'empty' | 'hidden'; tone?: 'positive' | 'warning'
}
type FourSectionsProps = {
  areas: Record<RingArea, AreaPresentation>; selected: RingArea; month: YearMonth; spaceId: string
  reduced: boolean; canCelebrate: boolean; onSelect: (area: RingArea) => void; onDetails: (area: RingArea) => void
}

function BullseyeGlyph({ empty = false }: { empty?: boolean }) {
  return <svg className="four-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeDasharray={empty ? '1.5 3' : undefined}/>{!empty && <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.6" className="four-target-dot"/></>}</svg>
}

function SectionLabel({ area, index }: { area: AreaPresentation; index: number }) {
  const name = useRef<SVGTextElement>(null), value = useRef<SVGTextElement>(null), box = useRef<SVGRectElement>(null)
  const p = pointAt(160, SECTION_ANGLES[index])
  useLayoutEffect(() => {
    const width = Math.max(name.current?.getComputedTextLength?.() ?? area.name.length * 9, value.current?.getComputedTextLength?.() ?? area.short.length * 8) + 20
    box.current?.setAttribute('x', String(p.x - width / 2)); box.current?.setAttribute('width', String(width))
  }, [area.name, area.short, p.x])
  return <g className="four-label"><rect ref={box} x={p.x - 70} y={p.y - 23} width="140" height="46" rx="11"/><text ref={name} className="four-label-name" x={p.x} y={p.y - 3} data-ring-label={RING_AREAS[index]}>{area.name}</text><text ref={value} className="four-label-value" x={p.x} y={p.y + 16}>{area.short}</text></g>
}

function FourSections({ areas, selected, month, spaceId, reduced, canCelebrate, onSelect, onDetails }: FourSectionsProps) {
  const chart = useRef<HTMLDivElement>(null), origin = useRef<{area: RingArea; x: number; y: number; cancelled: boolean; released?: boolean} | null>(null)
  const [pressed, setPressed] = useState<RingArea | null>(null)
  const [cycles, setCycles] = useState({income:0,bills:0,debts:0,goals:0})
  const [run, setRun] = useState<{id: number; elapsed: number; animate: boolean} | null>(null)
  const serial = useRef(0), channel = useContext(BillCelebrationContext), gradientId = useId()
  const choose = (area: RingArea) => { setRun(null); setPressed(null); setCycles(c=>({...c,[area]:c[area]+1})); onSelect(area) }
  useEffect(()=>channel.subscribe(event=>{
    if (!canCelebrate || event.month !== month || event.spaceId !== spaceId || !chart.current?.isConnected || chart.current.closest('[inert], [hidden]')) return false
    serial.current += 1
    setPressed(null); onSelect('bills'); if(selected!=='bills')setCycles(c=>({...c,bills:c.bills+1}))
    setRun({id:serial.current,elapsed:reduced?2980:0,animate:!reduced})
    return true
  }),[channel,canCelebrate,month,spaceId,onSelect,reduced,selected])
  if(run && areas.bills.percent!==100)setRun(null)
  const animateId = run?.animate ? run.id : 0
  useEffect(()=>{
    if (!animateId || reduced) return
    let frame=0,start:number|null=null
    const step=(now:number)=>{
      start??=now; const elapsed=Math.min(2980,now-start)
      setRun(current=>current?.id===animateId?{...current,elapsed,animate:elapsed<2980}:current)
      if(elapsed<2980) frame=requestAnimationFrame(step)
    }
    frame=requestAnimationFrame(step)
    return()=>cancelAnimationFrame(frame)
  },[animateId,reduced])
  useEffect(()=>{
    const query=window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const stop=()=>{if(query?.matches)setRun(current=>current?{...current,elapsed:2980,animate:false}:null)}
    query?.addEventListener?.('change',stop)
    return()=>query?.removeEventListener?.('change',stop)
  },[])
  const active=!!run?.animate&&!reduced, pulse=active?pulseAt(run.elapsed):null
  const celebrationText=!!run&&(reduced || run.elapsed>=1300&&run.elapsed<2980)
  const a=areas[selected], completedNotice=`Everything paid for ${formatYearMonth(month)}`
  const pointer=(area:RingArea)=>({
    onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{if(e.button!==0)return;origin.current={area,x:e.clientX,y:e.clientY,cancelled:false};setPressed(area)},
    onPointerMove:(e:PointerEvent<HTMLButtonElement>)=>{const p=origin.current;if(p?.area===area&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>8){p.cancelled=true;setPressed(null)}},
    onPointerUp:()=>{const p=origin.current;setPressed(null);if(p)origin.current={...p,released:true};if(p?.area===area&&!p.cancelled)choose(area)},
    onPointerCancel:()=>{origin.current=null;setPressed(null)},
    onPointerLeave:()=>{if(origin.current)origin.current.cancelled=true;setPressed(null)},
    // Native keyboard/AT click without pointer events; real pointer up already selected exactly once.
    onClick:(e:MouseEvent<HTMLButtonElement>)=>{const pointer=origin.current?.released;origin.current=null;if(!pointer&&e.detail===0)choose(area)},
  })
  return <div className={`rings-stage four-stage${reduced?' is-reduced-motion':''}${run?' has-completion':''}`} ref={chart} data-celebrating={active||undefined}>
    <svg viewBox="-12 -12 424 424" aria-hidden="true" className="four-vector">
      {RING_AREAS.map((area,i)=>{
        const delta=pointAt(selected===area?7:0,SECTION_ANGLES[i]),amp=pulse?.arcs[i]
        return <g key={area} className={`rings-band rings-band-${area} four-section${selected===area?' is-selected':''}${pressed===area?' is-pressed':''}${areas[area].short==='Hidden'?' is-hidden':''}`} style={{filter:amp?`brightness(${amp.brightness})`:undefined,transform:amp?`scale(${amp.scale})`:undefined}}>
          <g className="four-offset" transform={`translate(${delta.x-200} ${delta.y-200})`}><g className="four-pop">
            <path className="rings-band-track four-track" d={sectionPath(i)}/>
            {areas[area].percent!==null&&areas[area].percent!>0&&<SectionFill key={`${month}:${area}`} index={i} percent={areas[area].percent!} replay={cycles[area]} reduced={reduced}/>}
            <path className="four-focus" d={sectionPath(i,1,129.5,190.5)}/><SectionLabel area={areas[area]} index={i}/>
          </g></g>
        </g>
      })}
    </svg>
    <div className="four-controls" role="radiogroup" aria-label="Select an area" onKeyDown={event=>{
      if(event.repeat){event.preventDefault();return}
      origin.current=null
      const cardinal:Record<string,RingArea>={ArrowUp:'income',ArrowRight:'bills',ArrowDown:'debts',ArrowLeft:'goals'}
      const area=cardinal[event.key]
      if(area){event.preventDefault();choose(area);chart.current?.querySelector<HTMLButtonElement>(`[data-area="${area}"]`)?.focus()}
      else if(event.key===' '){event.preventDefault();choose(selected)}
      else if(event.key==='Enter'){event.preventDefault();setRun(null);onDetails(selected)}
    }}>
      {RING_AREAS.map((area,i)=>{
        const d=pointAt(selected===area?7:0,SECTION_ANGLES[i])
        return <button key={area} type="button" role="radio" aria-checked={selected===area} aria-label={`Select ${areas[area].name}, ${areas[area].accessible}`} tabIndex={selected===area?0:-1} data-area={area} data-ring-hit={area} data-rings-focus={`area-${area}`} className={`four-radio four-radio-${area}`} style={{clipPath:sectionHitPolygon(i),transform:`translate(${(d.x-200)/424*100}%, ${(d.y-200)/424*100}%)${pressed===area&&!reduced?' scale(.97)':''}`}} {...pointer(area)}><span className="visually-hidden">{areas[area].name}</span></button>
      })}
    </div>
    {pulse&&<svg className="four-fx" viewBox="-12 -12 424 424" aria-hidden="true"><defs><radialGradient id={gradientId}><stop offset="0" stopColor="var(--color-progress)" stopOpacity="0"/><stop offset=".72" stopColor="var(--color-progress)" stopOpacity=".16"/><stop offset="1" stopColor="var(--color-progress)" stopOpacity="0"/></radialGradient></defs><circle cx="200" cy="200" r={pulse.front*1.04} fill={`url(#${gradientId})`} opacity={pulse.glowOpacity}/><circle cx="200" cy="200" r={pulse.front} fill="none" stroke="var(--color-progress)" strokeWidth={pulse.waveWidth} opacity={pulse.waveOpacity}/></svg>}
    <button type="button" className={`rings-core four-core${a.tone?' is-'+a.tone:''}`} aria-label={`${a.name} centre, ${run?'All paid':a.accessible}. Show details`} onClick={()=>{setRun(null);onDetails(selected)}} style={{transform:pulse?`scale(${pulse.beat})`:undefined}}>
      <div className="rings-core-content four-core-content" key={`${month}:${selected}:${cycles[selected]}:${a.short==='Hidden'}`}>
        {celebrationText?<><span className="four-eyebrow">Bullseye!</span><BullseyeGlyph/><strong className="four-value">All paid</strong><span className="four-context">{completedNotice}</span></>:<>
          <b className="four-name">{a.name}</b>
          {a.glyph==='hidden'?<svg className="four-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>:a.glyph&&<BullseyeGlyph empty={a.glyph!=='target'}/>}
          {a.value!==undefined?<RingNumber value={a.value} format={a.format} reduced={reduced}/>:a.main&&<strong className="four-value">{a.main}</strong>}
          <span className="four-context">{a.context}</span>{a.pill&&<span className="four-pill">{a.pill}</span>}
        </>}
      </div>
    </button>
    <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{run?`Bullseye! All paid. ${completedNotice}.`:`${a.name}. ${a.accessible}. ${a.context}. ${a.pill}`}</p>
  </div>
}

/** Renders the Ring-first card as an element, so its handlers (which use the ring's refs) only run on events. */
function CardSlot({ render, context }: { render: (context: RingCardContext) => ReactNode; context: RingCardContext }) {
  return <>{render(context)}</>
}

export function GoalRings({ data, month, today, asOf, newId, onChange, onOpen, view: controlledView, onViewChange, embedded = false, selection, onSelectionChange, card }: Props) {
  const [localView, setLocalView] = useState<RingsView>('all')
  const requestedView = controlledView ?? localView
  const view = requestedView.startsWith('goal:') && !data.goals.some(g => g.id === requestedView.slice(5) && g.status === 'active') ? 'goals' : requestedView
  const [localSelection, setLocalSelection] = useState<Area>('bills')
  const ringSelection = selection ?? localSelection
  const [form, setForm] = useState(false)
  const [change, setChange] = useState<{ goalId: string; amount: number; before: number; after: number } | null>(null)
  const [notice, setNotice] = useState('')
  const root = useRef<HTMLElement>(null)
  const areaOrigin = useRef(`area-${AREAS.includes(requestedView as Area) ? requestedView : ringSelection}`)
  const focusTo = useRef<string | null>(null)
  const guard = useLeaveGuard()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const incomeAmounts = useBlockAmounts('month', data.space.currency)
  const billAmounts = useBlockAmounts('left-to-pay', data.space.currency)
  const amounts = useBlockAmounts('goals', data.space.currency)
  const money = (minor: number | null) => minor === null ? (amounts.hidden ? '••••' : 'Not known') : amounts.money(minor)
  const billMoney = (minor: number | null) => minor === null ? (billAmounts.hidden ? '••••' : 'Not known') : billAmounts.money(minor)
  const savings = savingsSummary(data, asOf)
  const income = incomeRingProgress(data, month)
  const billProgress = billsRingProgress(data, month)
  const debtProgress = debtsRingProgress(data, month)
  const goalsProgress = goalsRingProgress(data)
  const ringProgress = { income, bills: billProgress, debts: debtProgress, goals: goalsProgress }
  const ringHidden = { income: incomeAmounts.hidden, bills: false, debts: false, goals: amounts.hidden }
  const summary = {
    income: incomeAmounts.hidden ? 'Amounts hidden' : income.percent === null ? 'No expected income set' : `${Math.round(income.percent)}% received`,
    bills: billProgress.count ? `${billProgress.paidCount} of ${billProgress.count} paid` : 'No bills this month',
    debts: !data.debts.length ? 'No cards or loans yet' : debtProgress.count ? `${debtProgress.paidCount} of ${debtProgress.count}${debtProgress.unverifiedCount ? ' tracked payments' : ''} paid` : 'No tracked payments this month',
    goals: amounts.hidden ? 'Amounts hidden' : goalsProgress.percent === null ? 'No goals with a target yet' : `${Math.round(goalsProgress.percent)}% saved`,
  }
  const coverage = debtProgress.unverifiedCount ? `${debtProgress.unverifiedCount} ${debtProgress.unverifiedCount === 1 ? 'debt' : 'debts'} without a linked bill` : ''
  // Choosing another section closes a payment being reviewed in the Ring-first card: ask first when something was typed.
  const selectRing = (area: Area) => guard(f => area !== ringSelection && !!f.tag?.startsWith('ring-card:'), () => {
    setLocalSelection(area); onSelectionChange?.(area)
    if (view !== 'all') { setLocalView('all'); onViewChange?.('all') }
  })
  const occurrences = billsForMonth(data, month)
  const bills = summarizeBills(occurrences)
  const cards = summarizeCards(data, month, asOf)
  const goal = view.startsWith('goal:') ? data.goals.find(g => g.id === view.slice(5)) : null
  // Goal detail is current, like Goals; the area overview follows Home's balance date.
  const progress = goal ? goalProgress(goal, data.goalMovements, today) : null
  const selected: Area | null = goal ? 'goals' : AREAS.includes(view as Area) ? view as Area : null
  const time = goal ? goalMonthPosition(goal, today) : null
  const PanelHeading = embedded ? 'h3' : 'h2'
  const title = goal?.name ?? (selected ? NAMES[selected] : 'All areas')
  const values: Record<Area, string> = {
    income: incomeAmounts.money(income.received), bills: billAmounts.money(bills.leftToPay),
    debts: money(cards.totalBalance), goals: money(savings.assigned),
  }
  const notes = {
    income: `Received · ${formatYearMonth(month)}`, bills: `Left to pay · ${formatYearMonth(month)}${bills.unpaidUnknownCount ? ' · Some amounts unknown' : ''}`,
    debts: `Remaining Balance${cards.missingBalanceCount ? ' · Some balances unknown' : ''}`,
    goals: `Savings allocation · by ${formatDate(asOf)}`,
  }
  // A change of view closes the Contribution form, and any payment being reviewed in the Ring-first card.
  const go = (next: RingsView, focus = 'rings-title', withForm = false) => guard(f => f.tag === 'rings-contribution' || !!f.tag?.startsWith('ring-card:'), () => {
    if (view === next && !form && !withForm) { root.current?.querySelector<HTMLElement>(`[data-rings-focus="${CSS.escape(focus)}"]`)?.focus(); return }
    focusTo.current = withForm ? 'form' : focus
    if (next !== view) setChange(null)
    setForm(withForm); setNotice(''); setLocalView(next); onViewChange?.(next)
  })
  useLayoutEffect(() => {
    if (!focusTo.current) return
    const target = root.current?.querySelector<HTMLElement>(`[data-rings-focus="${CSS.escape(focusTo.current)}"]`)
    target?.focus(); focusTo.current = null
  }, [view, form])
  const openArea = (area: Area, origin = `area-${area}`) => {
    // Hidden SVG targets must not navigate or ask to discard a Contribution.
    if (goal) return
    areaOrigin.current = origin
    go(area)
  }
  const back = () => {
    if (form) guard(f => f.tag === 'rings-contribution', () => { focusTo.current = 'contribution'; setForm(false) })
    else if (goal) go('goals', `goal-${goal.id}`)
    else if (selected) go('all', areaOrigin.current)
  }
  const presentations = Object.fromEntries(AREAS.map(area => {
    const percent = ringHidden[area] ? null : ringProgress[area].percent
    const item: AreaPresentation = {name:NAMES[area],percent,short:ringHidden[area]?'Hidden':percent===null?'—':area==='bills'?`${billProgress.paidCount}/${billProgress.count}`:area==='debts'?`${debtProgress.paidCount}/${debtProgress.count}`:`${Math.round(percent)}%`,accessible:summary[area]+(area==='debts'&&coverage?`, Partial coverage: ${coverage}`:''),format:n=>String(n),context:'',pill:''}
    if(ringHidden[area]){item.glyph='hidden';item.context=area==='income'?'Income progress uses amounts':'Goal progress uses amounts';item.pill='Amounts hidden'}
    else if(area==='income'){
      // Without a valid forecast there is no share to show: the centre shows what was received instead.
      if(percent===null){item.value=income.received;item.format=n=>incomeAmounts.money(n);item.context='Received this month';item.pill='No forecast';item.accessible=`No expected income set, ${incomeAmounts.spoken(income.received)} received this month`}
      else{const expected=income.lines.filter(line=>line.expected!==null).length;item.value=Math.round(percent);item.format=n=>`${n}%`;item.context='of income received';item.pill=expected?`${expected} expected`:'All received';if(!expected)item.tone='positive'}
    }else if(area==='bills'){
      if(!billProgress.count){item.glyph='empty';item.context='Nothing due this month';item.pill='No bills this month'}
      else if(billProgress.count===billProgress.paidCount){item.glyph='target';item.main='All paid';item.context='bills this month';item.pill=`${billProgress.count} of ${billProgress.count}`;item.tone='positive'}
      else{item.value=billProgress.paidCount;item.format=n=>`${n} of ${billProgress.count}`;item.context='bills paid';item.pill=`${billProgress.count-billProgress.paidCount} unpaid`}
    }else if(area==='debts'){
      if(!debtProgress.count){item.glyph='empty';item.context=data.debts.length?'No tracked payments this month':'No cards or loans yet';item.pill=coverage?'Partial coverage':'Nothing to track'}
      else{item.value=debtProgress.paidCount;item.format=n=>`${n} of ${debtProgress.count}`;item.context=coverage?'tracked payments paid':'payments made';item.pill=coverage?'Partial coverage':debtProgress.count===debtProgress.paidCount?'All paid':`${debtProgress.count-debtProgress.paidCount} due`}
      item.tone=coverage?'warning':debtProgress.count===debtProgress.paidCount?'positive':undefined
    }else if(percent===null){item.glyph='empty';item.context='No goals with a target yet';item.pill='No targets yet'}
    else{item.value=Math.round(percent);item.format=n=>`${n}%`;item.context='of goal targets';item.pill=percent>=100?'All reached':'';item.tone='positive'}
    return [area,item]
  })) as Record<Area,AreaPresentation>
  const actualChange = goal && change?.goalId === goal.id ? change : null
  return <section className={`block goal-rings has-four-sections${card ? ' is-ring-first' : ''}${reducedMotion ? ' is-reduced-motion' : ''}`} aria-label={embedded ? undefined : 'Your money and goals'} ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && view !== 'all') { event.preventDefault(); event.stopPropagation(); back() }
  }}>
    {!embedded && <nav className="rings-crumbs" aria-label="Rings navigation">
      <button type="button" onClick={() => go('all', selected ? areaOrigin.current : 'rings-title')} aria-current={view === 'all' ? 'page' : undefined}>All areas</button>
      {selected && <><span aria-hidden="true">›</span><button type="button" onClick={() => go(selected, goal ? `goal-${goal.id}` : 'rings-title')} aria-current={!goal ? 'page' : undefined}>{NAMES[selected]}</button></>}
      {goal && <><span aria-hidden="true">›</span><span aria-current="page">{goal.name}</span></>}
    </nav>}
    {view !== 'all' && <button type="button" className="back-link" onClick={back}>← {form ? 'Close Contribution' : goal ? 'Goals' : 'All areas'}</button>}
    <div className="rings-layout">
      {goal && progress ? <div className="rings-stage is-goal">
        <svg viewBox="0 0 400 400" aria-hidden="true">{!amounts.hidden && progress.hasTarget && <g className="rings-progress" key={goal.id}>
          <>
            <circle cx="200" cy="200" r="150" className="rings-progress-track"/>
            <circle cx="200" cy="200" r="150" pathLength="100" transform="rotate(-90 200 200)" className={`rings-progress-value${DRAW_GOAL_ON_OPEN && !actualChange ? ' draw-on-open' : ''}`} strokeDasharray="100 100" strokeDashoffset={100-progress.percent} style={{'--progress-offset':100-progress.percent} as CSSProperties}/>
            {actualChange && goal.target!==null && <circle cx="200" cy="200" r="150" pathLength="100" transform={`rotate(${actualChange.before/goal.target*360-90} 200 200)`} className="rings-progress-new" strokeDasharray={`${Math.max(0,Math.min(100,actualChange.after/goal.target*100)-Math.min(100,actualChange.before/goal.target*100))} 100`}/>}
          </>
        </g>}</svg>
        <div className="rings-goal-center"><b>{goal.name}</b><AnimatedSaved key={goal.id} value={progress.saved} format={money}/><span>{goal.target===null?'No target set':`of ${money(goal.target)}`}</span>{!amounts.hidden&&progress.hasTarget&&<span>{Math.round(progress.percent)}%</span>}{actualChange&&!amounts.hidden&&<span className="rings-added">+{money(actualChange.amount)}</span>}</div>
      </div> : <FourSections key={`${data.space.id}:${month}`} areas={presentations} selected={ringSelection} month={month} spaceId={data.space.id} reduced={reducedMotion} canCelebrate={view==='all'} onSelect={selectRing} onDetails={openArea}/>}
      <div className="rings-panel">
        {(!embedded || view !== 'all') && <PanelHeading className="section-title" tabIndex={-1} data-rings-focus="rings-title">{title}</PanelHeading>}
        {view === 'all' && card ? <CardSlot render={card} context={{
          area: ringSelection, openDetails: () => openArea(ringSelection, `area-${ringSelection}`), openGoal: id => go(`goal:${id}`, 'rings-title', true), select: selectRing,
          revealRing: () => root.current?.querySelector('.four-stage')?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' }),
        }} /> : view === 'all' ? <>
          {coverage && ringSelection!=='debts' && <p className="field-help">Partial coverage: {coverage}; excluded from tracked payments.</p>}
          <div className="rings-actions">
            <button type="button" className="button-small" aria-label={`View ${NAMES[ringSelection]} details`} data-rings-focus="details" onClick={() => openArea(ringSelection, `area-${ringSelection}`)}>View details</button>
            <button type="button" className="button-small" data-return-key="rings-open" onClick={() => onOpen(ringSelection)}>Open {NAMES[ringSelection]}</button>
          </div>
          <div className="rings-context">
            {ringSelection === 'income' && <><p>{incomeAmounts.hidden ? 'Amounts hidden' : <>{incomeAmounts.money(income.received)} received · {income.hasForecast ? `${incomeAmounts.money(income.expected)} expected` : 'No expected income set'}</>}</p><p className="field-help">Received share of this month's income, including extra income. This is not a fixed plan.</p></>}
            {ringSelection === 'bills' && <p>{!billProgress.count ? 'No bills this month' : <>{billProgress.count - billProgress.paidCount} unpaid{!billAmounts.hidden && <> · Left to pay {billMoney(bills.leftToPay)}</>}{bills.unpaidUnknownCount > 0 ? ' · Some amounts unknown' : ''}</>}</p>}
            {ringSelection === 'debts' && <><p>{!data.debts.length ? 'No cards or loans yet' : <>Remaining Balance {amounts.hidden ? 'hidden' : money(cards.totalBalance)}{cards.missingBalanceCount > 0 ? ' · Some balances unknown' : ''}</>}</p><p className="field-help">Monthly payments, not debt repaid. {debtProgress.unverifiedCount > 0 ? `Partial coverage: ${coverage}; excluded from tracked payments.` : 'Based on linked bills for this month.'}</p></>}
            {ringSelection === 'goals' && <><p>{amounts.hidden ? 'Amounts hidden' : !goalsProgress.count ? 'No goals with a target yet' : <>{money(goalsProgress.saved)} saved · {money(goalsProgress.counted)} of {money(goalsProgress.target)} counted toward targets</>}</p><p className="field-help">Current active goals and movements, not a historical snapshot. {goalsProgress.withoutTargetCount > 0 ? `${goalsProgress.withoutTargetCount} without a valid target excluded.` : ''}</p></>}
          </div>
        </> : goal && progress ? <>
          <dl className="fact-rows"><div><dt>Saved</dt><dd>{money(progress.saved)}</dd></div><div><dt>Target</dt><dd>{money(goal.target)}</dd></div><div><dt>To go</dt><dd>{goal.target === null ? 'No target set' : money(progress.remaining)}</dd></div></dl>
          <p>{goal.deadline ? `By ${formatDate(goal.deadline)}` : 'No deadline'}</p>
          {goal.deadline && <div className="rings-timeline" aria-label="Time, separate from money progress">
            <p>Month {time?.current} of {time?.total}</p>
            {progress.pace.status === 'suggested' && progress.pace.monthly && <p>{money(progress.pace.monthly.amount)} per month · Suggested, not a payment</p>}
            {progress.pace.status === 'deadline-passed' && <p>The target date has passed.</p>}
          </div>}
          {!form && <button type="button" className="button-small button-small-primary" data-rings-focus="contribution" onClick={() => { focusTo.current = 'form'; setForm(true) }}>Add Contribution</button>}
          {form && <div tabIndex={-1} data-rings-focus="form"><GoalMovementForm key={goal.id} data={data} goal={goal} today={today} newId={newId} onChange={onChange} contributionOnly
            onSaved={(amount, before, after) => { setChange({ goalId: goal.id, amount, before, after }); setNotice('Contribution added.'); }} /></div>}
        </> : <>
          <p className="rings-main-value">{selected && values[selected]}</p><p className="field-help">{selected && notes[selected]}</p>
          {selected === 'income' && <ul className="line-list">{income.lines.filter(line => line.received).map(line => <li key={line.received!.id} className="line"><span>{line.source?.name ?? line.received!.note ?? 'Income'}<small>{formatDate(line.received!.receivedOn)}{line.received!.extraordinary ? ' · Irregular' : line.source ? ' · Regular' : ''}</small></span><b>{incomeAmounts.money(line.received!.amount)}</b></li>)}</ul>}
          {selected === 'income' && !income.lines.some(line => line.received) && <p>No income received this month.</p>}
          {selected === 'bills' && <>
            {!billAmounts.hidden && <><div className="rings-split" aria-label="Paid and left to pay"><i style={{ width: `${bills.knownTotal ? (bills.knownTotal - bills.leftToPay) / bills.knownTotal * 100 : 0}%` }} /></div><p>By amount · ✓ Paid {billAmounts.money(bills.knownTotal - bills.leftToPay)} · Left to pay {billAmounts.money(bills.leftToPay)}</p></>}
            {bills.unknownCount > 0 && <p>Some bill amounts are unknown.</p>}
            <ul className="line-list">{occurrences.map(item => <li className="line" key={item.bill.id}><span>{item.bill.name}<small>{item.paid ? '✓ Paid' : `◷ Due ${formatDate(item.dueDate)}`}</small></span><b>{billMoney(item.amount)}</b></li>)}</ul>
            {!occurrences.length && <p>No bills this month.</p>}
          </>}
          {selected === 'debts' && <ul className="line-list">{cards.items.map(item => {
              const next = nextDebtPayment(data, item.debt, asOf)
              return <li className="line" key={item.debt.id}><span>{item.debt.name}<small>Remaining Balance {money(item.balance)} · {next ? `Next payment ${money(next.amount)} · ${formatDate(next.dueDate)}` : 'No next payment planned'}</small></span></li>
            })}</ul>}
          {selected === 'debts' && !cards.items.length && <p>No cards or loans yet.</p>}
          {selected === 'goals' && <>
            <p>Savings {money(savings.total)} · Assigned {money(savings.assigned)} · Unassigned {money(savings.unassigned)}</p>
            {!amounts.hidden && savings.total !== null && savings.total > 0 && savings.unassigned !== null && savings.unassigned >= 0 && <div className="rings-split" aria-label="Assigned and unassigned savings"><i style={{ width: `${savings.assigned / savings.total * 100}%` }} /></div>}
            {!amounts.hidden && savings.unassigned !== null && savings.unassigned < 0 && <p>Assigned savings exceed account balances.</p>}
            <div className="rings-area-list">{savings.purposes.map(({ goal: item, saved }) => {
              const p = goalProgress(item, data.goalMovements.filter(m => m.date <= asOf), asOf)
              return <button type="button" className="rings-area" key={item.id} data-rings-focus={`goal-${item.id}`} onClick={() => go(`goal:${item.id}`)}>
                {!amounts.hidden && p.hasTarget && <svg className="rings-mini" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15" /><circle className="rings-mini-value" cx="20" cy="20" r="15" pathLength="100" transform="rotate(-90 20 20)" strokeDasharray={`${p.percent} 100`} /></svg>}
                <span>{item.name}<small>{money(saved)}{item.target === null ? ' · No target set' : ` of ${money(item.target)}`} · {item.deadline ? `By ${formatDate(item.deadline)}` : 'No deadline'}</small></span>
              </button>
            })}</div>
            {!savings.purposes.length && <p>No active goals yet.</p>}
          </>}
          {selected && <button type="button" className="button-small" data-return-key="rings-open" onClick={() => guard(f => f.tag === 'rings-contribution', () => onOpen(selected))}>Open {NAMES[selected]}</button>}
        </>}
      </div>
    </div>
    {/* The overview announces its selection in FourSections; detail views announce where the user is. */}
    <p className="visually-hidden" role="status" aria-live="polite">{view !== 'all' ? `${title}. ` : ''}{notice}</p>
  </section>
}
