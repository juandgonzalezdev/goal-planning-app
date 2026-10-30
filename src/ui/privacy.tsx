import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { IconTip } from '../components/IconTip'
import { BLOCK_NAMES, HOME_BLOCKS, useAmountVisibility, VisibilityContext, type AmountVisibility, type HomeBlock } from './amountVisibility'

/** The hidden blocks for everything inside (Home). The state itself is kept by the app, on this device. */
export function AmountVisibilityProvider({ value, children }: { value: AmountVisibility; children: ReactNode }) {
  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
}
/** The eye button in a block's header: light while amounts show, marked while they are hidden. */
export function EyeToggle({ block }: { block: HomeBlock }) {
  const { hidden, toggle } = useAmountVisibility()
  const isHidden = hidden.has(block)
  const label = `${isHidden ? 'Show' : 'Hide'} amounts in ${BLOCK_NAMES[block]}`
  return (
    <button type="button" className={`eye-toggle has-tip${isHidden ? ' is-hidden' : ''}`} aria-label={label} onClick={() => toggle(block)}>
      <Icon name={isHidden ? 'eyeOff' : 'eye'} size={18} />
      <IconTip label={label} />
    </button>
  )
}

/** How long "Amounts hidden" / "Amounts visible" stays under the Home eye. */
export const AMOUNTS_NOTICE_MS = 2000

/**
 * The eye above the Home blocks: one tap hides every amount, the next
 * shows them all again. Like the eye of each block, it shows the state:
 * open while amounts show, crossed out while all are hidden. Its name is
 * still Hide All Amounts / Show All Amounts. After a tap, a short
 * "Amounts hidden" or "Amounts visible" appears under it, over the page
 * (nothing moves), and screen readers hear it once.
 */
export function HomeAmountsEye() {
  const { hidden, setAll } = useAmountVisibility()
  const allHidden = HOME_BLOCKS.every(block => hidden.has(block))
  const label = allHidden ? 'Show All Amounts' : 'Hide All Amounts'
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), AMOUNTS_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <span className="amounts-eye">
      <button type="button" className={`icon-button tool-button has-tip${allHidden ? ' is-hidden' : ''}`} aria-label={label}
        onClick={() => { setAll(!allHidden); setNotice(allHidden ? 'Amounts visible' : 'Amounts hidden') }}>
        <Icon name={allHidden ? 'eyeOff' : 'eye'} size={20} />
        {!notice && <IconTip label={label} />}
      </button>
      <span className={`amounts-notice${notice ? ' is-shown' : ''}`} role="status">{notice}</span>
    </span>
  )
}

/** Hide All Amounts / Show All Amounts as a text button (Bills and History). */
export function AllAmountsToggle() {
  const { hidden, setAll } = useAmountVisibility()
  const allHidden = HOME_BLOCKS.every(block => hidden.has(block))
  return (
    <button type="button" className="button-small align-start" onClick={() => setAll(!allHidden)}>
      <Icon name={allHidden ? 'eye' : 'eyeOff'} size={16} /> {allHidden ? 'Show All Amounts' : 'Hide All Amounts'}
    </button>
  )
}
