import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { TABS, type Tab } from '../app/navigation'
import { Icon, type IconName } from './Icon'

const LABELS: Record<Tab, string> = { home: 'Home', bills: 'Bills', goals: 'Goals', money: 'Money', history: 'History' }
const ICONS: Record<Tab, IconName> = { home: 'home', bills: 'receipt', goals: 'target', money: 'wallet', history: 'history' }

/** One persistent navigation: a bottom float on small screens and a compact rail on wide ones. */
export function BottomNav({ current, onSelect, top, bottom, rail = false }: {
  current: Tab | null
  onSelect: (tab: Tab) => void
  top?: ReactNode
  bottom?: ReactNode
  rail?: boolean
}) {
  const nav = useRef<HTMLElement>(null)
  const destinations = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.style.getPropertyValue('--floating-nav-height')
    const measure = () => {
      const group = destinations.current
      const selected = group?.querySelector<HTMLElement>('[aria-current="page"]')
      if (group && selected) {
        group.style.setProperty('--indicator-x', `${selected.offsetLeft}px`)
        group.style.setProperty('--indicator-y', `${selected.offsetTop}px`)
        group.style.setProperty('--indicator-width', `${selected.offsetWidth}px`)
        group.style.setProperty('--indicator-height', `${selected.offsetHeight}px`)
      }
      if (rail) root.style.setProperty('--floating-nav-height', '0px')
      else if (nav.current?.offsetHeight) root.style.setProperty('--floating-nav-height', `${nav.current.offsetHeight}px`)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (nav.current) observer?.observe(nav.current)
    if (destinations.current) observer?.observe(destinations.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      if (previous) root.style.setProperty('--floating-nav-height', previous)
      else root.style.removeProperty('--floating-nav-height')
    }
  }, [current, rail])

  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.getPropertyValue('--nav-viewport-bottom')
    const viewport = window.visualViewport
    let frame = 0
    const update = () => {
      const active = document.activeElement
      const editing = active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]')
      // Use the visible viewport, not focus alone. Pinch zoom must not be mistaken for a keyboard.
      const gap = !rail && editing && viewport && Math.abs(viewport.scale - 1) < 0.01
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0
      root.style.setProperty('--nav-viewport-bottom', `${gap}px`)
      cancelAnimationFrame(frame)
      if (gap > 0 && active instanceof HTMLElement && viewport) frame = requestAnimationFrame(() => {
        if (document.activeElement !== active) return
        const rect = active.getBoundingClientRect()
        const visibleBottom = viewport.offsetTop + viewport.height - (nav.current?.offsetHeight ?? 72) - 24
        if (rect.bottom > visibleBottom || rect.top < viewport.offsetTop) active.scrollIntoView?.({ block: 'center', behavior: 'auto' })
      })
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      if (previous) root.style.setProperty('--nav-viewport-bottom', previous)
      else root.style.removeProperty('--nav-viewport-bottom')
    }
  }, [rail])

  return (
    <nav ref={nav} className="bottom-nav" aria-label="Main navigation">
      {top}
      <div ref={destinations} className="nav-destinations">
        <span className="nav-indicator" aria-hidden="true" hidden={current === null} />
        {TABS.map(tab => (
          <button key={tab} type="button" aria-current={tab === current ? 'page' : undefined}
            className={`nav-tab${tab === current ? ' is-selected' : ''}`} onClick={() => onSelect(tab)}>
            <span className="nav-icon"><Icon name={ICONS[tab]} size={22} /></span><span className="nav-label">{LABELS[tab]}</span>
          </button>
        ))}
      </div>
      {bottom}
    </nav>
  )
}
