import type { ReactNode } from 'react'
import type { Tab } from '../app/navigation'

const LABELS: Record<Tab, string> = { home: 'Home', bills: 'Bills', goals: 'Goals', money: 'Money', history: 'History' }

/**
 * The five main tabs, with their names always shown: fixed at the bottom on phones, a row under the
 * header on medium screens, and a sidebar on wide ones (approved order). In the sidebar, `top` (the
 * logo) and `bottom` (Settings) come with it, and the header no longer shows them: never twice.
 */
export function BottomNav({ current, onSelect, top, bottom }: { current: Tab | null; onSelect: (tab: Tab) => void; top?: ReactNode; bottom?: ReactNode }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {top}
      {(Object.keys(LABELS) as Tab[]).map(tab => (
        <button key={tab} type="button" aria-current={tab === current ? 'page' : undefined} className={tab === current ? 'is-selected' : ''} onClick={() => onSelect(tab)}>
          {LABELS[tab]}
        </button>
      ))}
      {bottom}
    </nav>
  )
}
