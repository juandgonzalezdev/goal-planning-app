import { createContext, useContext } from 'react'
import type { MoneyAmount } from '../domain/goalAmounts'
import type { CurrencyCode } from '../domain/money'
import { formatAmount } from './format'

/**
 * Hiding amounts on Home, block by block or all at once. It only changes
 * what the screen shows: nothing is deleted or changed, and it is not a
 * lock (anyone with this device can show them again). The mask always has
 * the same length, so it never tells how many digits an amount has.
 */
export const HOME_BLOCKS = ['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'] as const
export type HomeBlock = (typeof HOME_BLOCKS)[number]

export const BLOCK_NAMES: Record<HomeBlock, string> = {
  month: 'This Month', 'left-to-pay': 'Left to Pay', categories: 'Spending by Category', debt: 'Total Debt',
  money: 'My Money', goals: 'My Goals', year: 'Year Summary',
}

export const MASK = '••••'
/** What screen readers hear instead of a hidden amount. */
export const HIDDEN_SPOKEN = 'amount hidden'

export interface AmountVisibility {
  hidden: ReadonlySet<HomeBlock>
  toggle: (block: HomeBlock) => void
  setAll: (hidden: boolean) => void
}

export const VisibilityContext = createContext<AmountVisibility>({ hidden: new Set(), toggle: () => {}, setAll: () => {} })

export const useAmountVisibility = () => useContext(VisibilityContext)

export interface BlockAmounts {
  hidden: boolean
  /** The amount as text, or the mask. */
  money: (minor: MoneyAmount) => string
  /** For aria-labels: the amount, or "amount hidden". */
  spoken: (minor: MoneyAmount) => string
  /** A percentage, or the mask (a share can reveal an amount). */
  percent: (value: string) => string
}

/** Money formatting for one block, following its visibility. Outside Home (no block), amounts always show. */
export function useBlockAmounts(block: HomeBlock | null, currency: CurrencyCode): BlockAmounts {
  const { hidden } = useAmountVisibility()
  const isHidden = block !== null && hidden.has(block)
  return {
    hidden: isHidden,
    money: minor => (isHidden ? MASK : formatAmount(minor, currency)),
    spoken: minor => (isHidden ? HIDDEN_SPOKEN : formatAmount(minor, currency)),
    percent: value => (isHidden ? MASK : value),
  }
}
