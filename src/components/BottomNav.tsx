import type { Tab } from '../app/navigation'

const LABELS: Record<Tab, string> = { home: 'Home', bills: 'Bills', goals: 'Goals', money: 'Money', history: 'History' }

/** The five main tabs, with their names always shown: fixed at the bottom on phones, a row under the header on wide screens (approved order). */
export function BottomNav({ current, onSelect }: { current: Tab | null; onSelect: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {(Object.keys(LABELS) as Tab[]).map(tab => (
        <button key={tab} type="button" aria-current={tab === current ? 'page' : undefined} className={tab === current ? 'is-selected' : ''} onClick={() => onSelect(tab)}>
          {LABELS[tab]}
        </button>
      ))}
    </nav>
  )
}
