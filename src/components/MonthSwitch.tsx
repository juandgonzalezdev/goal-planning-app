import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { monthsOfYear, type YearMonth } from '../domain/calendar'
import { formatYearMonth } from '../ui/format'
import { Icon } from './Icon'
import { indexMonth, monthIndex, MonthWheelMotion, wheelSlot, WHEEL_MIN, WHEEL_MAX } from './monthWheel'

/** Visual motion stays local; only a settled, owner-accepted month updates content. */
export function MonthSwitch({ value, onChange }: { months: YearMonth[]; value: YearMonth; onChange: (month: YearMonth) => void }) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const items = useRef<HTMLDivElement>(null)
  const controller = useRef<MonthWheelMotion | null>(null)
  const latest = useRef({ value, onChange })
  const pointerId = useRef<number | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const committed = useRef(value)
  const [, requestReconciliation] = useState(0)
  const [announcement, announce] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [yearDraft, setYearDraft] = useState(value.slice(0, 4))
  const validYear = /^\d{1,4}$/.test(yearDraft) && Number(yearDraft) >= 1 && Number(yearDraft) <= 9999
  const gridYear = validYear ? Number(yearDraft) : Number(value.slice(0, 4))
  const short = (month: YearMonth) => formatYearMonth(month).split(' ')[0].slice(0, 3)

  useLayoutEffect(() => {
    latest.current = { value, onChange }
    controller.current?.sync(monthIndex(value))
  })
  useLayoutEffect(() => {
    const el = root.current!, host = items.current!
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    // No media-query support: provide the non-animated accessible fallback.
    let flat = media?.matches ?? true
    let width = el.clientWidth || 300
    const nodes = new Map<number, HTMLDivElement>()
    const draw = (position: number, reduced: boolean) => {
      el.classList.toggle('is-flat', reduced)
      el.style.setProperty('--wheel-lens', Math.round(Math.min(150, Math.max(124, width * .42))) + 'px')
      el.dataset.visualMonth = String(position)
      const lo = Math.floor(position) - 3, hi = Math.ceil(position) + 3, center = Math.round(position)
      for (let n = Math.max(WHEEL_MIN, lo); n <= Math.min(WHEEL_MAX, hi); n++) {
        if (!nodes.has(n)) {
          const node = document.createElement('div')
          node.className = 'month-face'
          const month = document.createElement('strong'), year = document.createElement('small')
          month.textContent = formatYearMonth(indexMonth(n)).split(' ')[0]
          year.textContent = String(Math.floor(n / 12)).padStart(4, '0')
          node.append(month, year); host.append(node); nodes.set(n, node)
        }
      }
      nodes.forEach((node, n) => {
        if (n < lo || n > hi) { node.remove(); nodes.delete(n); return }
        const p = n - position, slot = wheelSlot(p, reduced), side = Math.abs(p) > .5
        node.style.transform = `translate3d(${slot.x * width}px,0,${slot.z}px) rotateY(${slot.r}deg) scale(${slot.s})`
        node.style.opacity = String(slot.o)
        node.classList.toggle('is-side', side)
        node.classList.toggle('new-year', side && Math.abs(p) < 1.5 && Math.floor(n / 12) !== Math.floor(center / 12))
      })
    }
    const motion = new MonthWheelMotion(monthIndex(latest.current.value), flat, () => width, draw, index => {
      latest.current.onChange(indexMonth(index))
      // Reconcile after the owner and this component commit together.
      requestReconciliation(revision => revision + 1)
    })
    controller.current = motion
    draw(motion.position, flat)
    const halt = () => { pointerId.current = null; motion.halt() }
    const visibility = () => { if (document.hidden) halt() }
    const reduced = () => { flat = media?.matches ?? true; pointerId.current = null; motion.setReduced(flat) }
    const resize = () => {
      const next = el.clientWidth || 300
      if (next !== width) { width = next; halt() }
      draw(motion.position, flat)
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    observer?.observe(el)
    window.addEventListener('resize', resize)
    window.addEventListener('blur', halt)
    window.addEventListener('pagehide', halt)
    document.addEventListener('visibilitychange', visibility)
    media?.addEventListener?.('change', reduced)
    return () => {
      motion.destroy(); controller.current = null; pointerId.current = null
      observer?.disconnect()
      window.removeEventListener('resize', resize); window.removeEventListener('blur', halt); window.removeEventListener('pagehide', halt)
      document.removeEventListener('visibilitychange', visibility); media?.removeEventListener?.('change', reduced)
      host.replaceChildren()
    }
  }, [])
  useEffect(() => {
    if (committed.current !== value) { committed.current = value; announce(formatYearMonth(value)) }
  }, [value])
  useEffect(() => {
    if (!expanded) return
    const panel = dialog.current!, opener = trigger.current
    if (typeof panel.showModal === 'function') panel.showModal()
    else panel.setAttribute('open', '')
    panel.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    return () => {
      if (typeof panel.showModal === 'function') panel.close()
      else panel.removeAttribute('open')
      opener?.focus()
    }
  }, [expanded])
  const choose = (month: YearMonth) => {
    controller.current?.halt()
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && !month.startsWith('0000') && month !== value) onChange(month)
  }
  const open = () => { controller.current?.halt(); pointerId.current = null; setYearDraft(value.slice(0, 4)); setExpanded(true) }
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget, rect = el.getBoundingClientRect()
    const scale = rect.width ? (el.clientWidth || 300) / rect.width : 1
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale, t: event.timeStamp || performance.now() }
  }
  return <>
    <div ref={root} className="month-picker month-carousel" role="group" aria-label="Month" onKeyDown={event => {
      const motion = controller.current
      motion?.keyboard()
      if (event.key === 'Escape') { motion?.halt(); setExpanded(false); return }
      const delta = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 }[event.key]
      if (delta !== undefined) { event.preventDefault(); motion?.step(delta) }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); motion?.edge(event.key === 'End') }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { controller.current?.halt(); pointerId.current = null }
    }} onClickCapture={event => {
      if (controller.current?.consumeClick(event.detail)) { event.preventDefault(); event.stopPropagation() }
    }} onPointerDown={event => {
      if (event.isPrimary === false || event.button !== 0 || pointerId.current !== null) return
      const target = (event.target as HTMLElement).closest('button')
      const zone = target?.classList.contains('month-previous') ? -1 : target?.classList.contains('month-next') ? 1 : 0
      const p = point(event)
      pointerId.current = event.pointerId
      controller.current?.down(p.x, p.y, p.t, zone)
      target?.setPointerCapture?.(event.pointerId)
    }} onPointerMove={event => {
      if (event.pointerId !== pointerId.current) return
      const p = point(event)
      if (controller.current?.move(p.x, p.y, p.t)) event.currentTarget.setPointerCapture?.(event.pointerId)
    }} onPointerUp={event => {
      if (event.pointerId !== pointerId.current) return
      pointerId.current = null; controller.current?.up(point(event).t)
    }} onPointerCancel={event => {
      if (event.pointerId === pointerId.current) { pointerId.current = null; controller.current?.cancelGesture() }
    }} onLostPointerCapture={event => {
      // A drag transfers capture from its button to the wheel; that is not a loss.
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) return
      if (event.pointerId === pointerId.current) { pointerId.current = null; controller.current?.cancelGesture() }
    }} onPointerLeave={event => {
      if (event.pointerType === 'mouse' && pointerId.current !== null && event.buttons === 0) { pointerId.current = null; controller.current?.halt() }
    }} onContextMenu={event => { if (pointerId.current !== null) event.preventDefault() }}>
      <div className="month-drum" aria-hidden="true"><div className="month-lens" /><div className="month-faces" ref={items} /></div>
      <button type="button" className="month-zone month-previous" aria-label="Previous month" disabled={value === '0001-01'} onClick={() => controller.current?.step(-1)}><Icon name="chevronLeft" size={18} /></button>
      <button type="button" ref={trigger} className="month-zone month-wheel-front" value={value} aria-label={'Choose month: ' + formatYearMonth(value)} aria-haspopup="dialog" aria-expanded={expanded} aria-controls={id} onClick={open}><span className="sr-only">{formatYearMonth(value)}</span></button>
      <button type="button" className="month-zone month-next" aria-label="Next month" disabled={value === '9999-12'} onClick={() => controller.current?.step(1)}><Icon name="chevronRight" size={18} /></button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
    {expanded && createPortal(<dialog ref={dialog} id={id} className="month-grid-panel" aria-label="Choose month" onCancel={event => { event.preventDefault(); setExpanded(false) }} onKeyDown={event => {
      event.stopPropagation()
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false) }
    }}>
      <div className="month-year-row">
        <button type="button" className="button-small" aria-label="Previous year" disabled={!validYear || gridYear <= 1} onClick={() => setYearDraft(String(gridYear - 1))}>‹</button>
        <label>Year<input type="number" inputMode="numeric" min="1" max="9999" value={yearDraft} aria-invalid={!validYear} aria-describedby={id + '-year-help'} onChange={event => setYearDraft(event.target.value)} /></label>
        <button type="button" className="button-small" aria-label="Next year" disabled={!validYear || gridYear >= 9999} onClick={() => setYearDraft(String(gridYear + 1))}>›</button>
      </div>
      <p id={id + '-year-help'} className="muted-note">{validYear ? 'Choose a month.' : 'Enter a year from 1 to 9999.'}</p>
      <div className="month-grid">{monthsOfYear(gridYear).map(month => <button type="button" key={month} className="button-small" disabled={!validYear} aria-label={formatYearMonth(month)} aria-pressed={month === value} onClick={() => { choose(month); setExpanded(false) }}>{short(month)}</button>)}</div>
      <button type="button" className="button-small month-close" onClick={() => setExpanded(false)}>Close</button>
    </dialog>, document.body)}
  </>
}
