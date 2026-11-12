import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { TABS, type Tab } from '../app/navigation'
import { Icon, type IconName } from './Icon'
import { useT, type MessageKey } from '../i18n'

const LABELS: Record<Tab, MessageKey> = { home: 'nav.home', bills: 'nav.bills', goals: 'nav.goals', money: 'nav.money', history: 'nav.history' }
const ICONS: Record<Tab, IconName> = { home: 'home', bills: 'receipt', goals: 'target', money: 'wallet', history: 'history' }

/** One persistent navigation: a bottom float on small screens and a compact rail on wide ones. */
export function BottomNav({ current, onSelect, top, bottom, rail = false }: {
  current: Tab | null
  onSelect: (tab: Tab) => void
  top?: ReactNode
  bottom?: ReactNode
  rail?: boolean
}) {
  const { t } = useT()
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
    const viewport = window.visualViewport
    let frame = 0
    // Height is independent of viewport panning: scrolling must not toggle the keyboard.
    // Retain detection across blur until viewport recovery: Save must not move before click.
    let keyboardOpen = false
    const update = () => {
      const active = document.activeElement
      const editing = active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]')
      // Use the visible viewport, not focus alone. Pinch zoom must not be mistaken for a keyboard.
      const gap = !rail && (editing || keyboardOpen) && viewport && Math.abs(viewport.scale - 1) < 0.01
        ? Math.max(0, window.innerHeight - viewport.height) : 0
      // Ignore fractional rounding and browser chrome; a keyboard must substantially reduce height.
      keyboardOpen = gap > Math.max(120, window.innerHeight * 0.15)
      if (nav.current) {
        nav.current.dataset.keyboard = String(keyboardOpen)
        nav.current.inert = keyboardOpen
        if (keyboardOpen) nav.current.setAttribute('aria-hidden', 'true')
        else nav.current.removeAttribute('aria-hidden')
      }
      cancelAnimationFrame(frame)
      if (keyboardOpen && editing && active instanceof HTMLElement && viewport) frame = requestAnimationFrame(() => {
        if (document.activeElement !== active) return
        const rect = active.getBoundingClientRect()
        const visibleBottom = viewport.offsetTop + viewport.height - 24
        if (rect.bottom > visibleBottom || rect.top < viewport.offsetTop) active.scrollIntoView?.({ block: 'center', behavior: 'auto' })
      })
    }
    update()
    viewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [rail])

  // First measure (and each layout change) must paint before transitions start.
  useLayoutEffect(() => {
    const group = destinations.current
    group?.removeAttribute('data-ready')
    const frame = requestAnimationFrame(() => group?.setAttribute('data-ready', 'true'))
    return () => cancelAnimationFrame(frame)
  }, [rail])

  return (
    <nav ref={nav} className="bottom-nav" aria-label={t('nav.main')}>
      {top}
      <div ref={destinations} className="nav-destinations">
        <span className="nav-indicator" aria-hidden="true" hidden={current === null} />
        {TABS.map(tab => (
          <button key={tab} type="button" aria-current={tab === current ? 'page' : undefined}
            className={`nav-tab${tab === current ? ' is-selected' : ''}`} onClick={() => onSelect(tab)}>
            <span className="nav-icon"><Icon name={ICONS[tab]} size={22} /></span><span className="nav-label">{t(LABELS[tab])}</span>
          </button>
        ))}
      </div>
      {bottom}
    </nav>
  )
}
