import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { BLOCK_NAMES, HOME_BLOCKS, useAmountVisibility, VisibilityContext, type AmountVisibility, type HomeBlock } from './amountVisibility'

/** The hidden blocks for everything inside (Home). The state itself is kept by the app, on this device. */
export function AmountVisibilityProvider({ value, children }: { value: AmountVisibility; children: ReactNode }) {
  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>
}
/** The eye button in a block's header. */
export function EyeToggle({ block }: { block: HomeBlock }) {
  const { hidden, toggle } = useAmountVisibility()
  const isHidden = hidden.has(block)
  const label = `${isHidden ? 'Show' : 'Hide'} amounts in ${BLOCK_NAMES[block]}`
  return (
    <button type="button" className="icon-button eye-toggle" aria-label={label} title={label} onClick={() => toggle(block)}>
      <Icon name={isHidden ? 'eyeOff' : 'eye'} size={18} />
    </button>
  )
}

/** Hide All Amounts / Show All Amounts, above the Home blocks. */
export function AllAmountsToggle() {
  const { hidden, setAll } = useAmountVisibility()
  const allHidden = HOME_BLOCKS.every(block => hidden.has(block))
  return (
    <button type="button" className="button-small align-start" onClick={() => setAll(!allHidden)}>
      <Icon name={allHidden ? 'eye' : 'eyeOff'} size={16} /> {allHidden ? 'Show All Amounts' : 'Hide All Amounts'}
    </button>
  )
}
