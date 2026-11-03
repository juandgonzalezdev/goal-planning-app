import { createContext, useContext } from 'react'
import type { MoneyAmount } from '../domain/goalAmounts'
import type { CurrencyCode } from '../domain/money'
import { formatAmount } from './format'

/**
 * Hiding amounts on Home, area by area or all at once. It only changes
 * what the screen shows: nothing is deleted or changed, and it is not a
 * lock (anyone with this device can show them again). The mask always has
 * the same length, so it never tells how many digits an amount has.
 */

/**
 * The seven blocks Home had before its three areas. Their names still
 * name the parts of Home (and the five parts that open and close), and
 * they are still written with the hidden areas, so an earlier version of
 * the app keeps hiding the same amounts.
 */
export const HOME_BLOCKS = ['month', 'left-to-pay', 'categories', 'debt', 'money', 'goals', 'year'] as const
export type HomeBlock = (typeof HOME_BLOCKS)[number]

/** Home's three areas, in their first order. Each has its own eye. */
export const HOME_AREAS = ['month', 'left-to-pay', 'money-goals'] as const
export type HomeArea = (typeof HOME_AREAS)[number]

export const AREA_NAMES: Record<HomeArea, string> = { month: 'This Month', 'left-to-pay': 'Left to Pay', 'money-goals': 'Money & Goals' }

/** The area each part of Home belongs to: its eye hides that part. */
export const AREA_OF: Record<HomeBlock, HomeArea> = {
  month: 'month', categories: 'month', year: 'month',
  'left-to-pay': 'left-to-pay',
  debt: 'money-goals', money: 'money-goals', goals: 'money-goals',
}

const isArea = (value: string): value is HomeArea => (HOME_AREAS as readonly string[]).includes(value)
const isBlock = (value: string): value is HomeBlock => (HOME_BLOCKS as readonly string[]).includes(value)

/**
 * The hidden areas, from what this device saved: area names, or the
 * block names of an earlier version. An area is hidden when its own name
 * or any of its blocks was saved as hidden, so an update never shows an
 * amount that was hidden (it may hide more). Unknown names are ignored.
 */
export function hiddenAreasFrom(saved: readonly string[]): Set<HomeArea> {
  const hidden = new Set<HomeArea>()
  for (const name of saved) {
    if (isArea(name)) hidden.add(name)
    if (isBlock(name)) hidden.add(AREA_OF[name])
  }
  return hidden
}

/** What is saved for the hidden areas: their names and the names of all their blocks (for an earlier version of the app). */
export function savedHiddenNames(hidden: ReadonlySet<HomeArea>): string[] {
  const names: string[] = []
  for (const area of HOME_AREAS) {
    if (!hidden.has(area)) continue
    names.push(area, ...HOME_BLOCKS.filter(block => AREA_OF[block] === area && block !== area))
  }
  return names
}

export const MASK = '••••'
/** What screen readers hear instead of a hidden amount. */
export const HIDDEN_SPOKEN = 'amount hidden'

export interface AmountVisibility {
  hidden: ReadonlySet<HomeArea>
  toggle: (area: HomeArea) => void
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
  /** Shows these amounts again (the area's eye on Home; every amount in Bills and History). */
  show: () => void
}

/** Money formatting for one part of Home, following its area's eye. Outside Home (no block), amounts always show. */
export function useBlockAmounts(block: HomeBlock | null, currency: CurrencyCode): BlockAmounts {
  const { hidden, toggle } = useAmountVisibility()
  const isHidden = block !== null && hidden.has(AREA_OF[block])
  return {
    hidden: isHidden,
    money: minor => (isHidden ? MASK : formatAmount(minor, currency)),
    spoken: minor => (isHidden ? HIDDEN_SPOKEN : formatAmount(minor, currency)),
    percent: value => (isHidden ? MASK : value),
    show: () => { if (isHidden && block !== null) toggle(AREA_OF[block]) },
  }
}

/**
 * Money formatting for screens outside Home that follow Hide All Amounts
 * (Bills, History): amounts are hidden only while every Home area is hidden.
 */
export function useAllAmounts(currency: CurrencyCode): BlockAmounts {
  const { hidden, setAll } = useAmountVisibility()
  const isHidden = allAreasHidden(hidden)
  return {
    hidden: isHidden,
    money: minor => (isHidden ? MASK : formatAmount(minor, currency)),
    spoken: minor => (isHidden ? HIDDEN_SPOKEN : formatAmount(minor, currency)),
    percent: value => (isHidden ? MASK : value),
    show: () => { if (isHidden) setAll(false) },
  }
}

export const allAreasHidden = (hidden: ReadonlySet<HomeArea>) => HOME_AREAS.every(area => hidden.has(area))
