import { createContext } from 'react'
import type { Id } from '../../domain/finance/types'
import type { ValidityFilter } from '../../domain/finance/validity'

/** The three blocks of Money, always in this order (Money has no Customize). */
export const MONEY_BLOCKS = ['income', 'accounts', 'debts'] as const
export type MoneyBlock = (typeof MONEY_BLOCKS)[number]

export const MONEY_BLOCK_NAMES: Record<MoneyBlock, string> = {
  income: 'Income',
  accounts: 'Accounts & Savings',
  debts: 'Cards & Loans',
}

/**
 * How Money looks while moving around the app: which blocks are open, the
 * income filter, and the income source or account shown in detail. It is a
 * screen preference, never data, and lasts for the session only. The demo
 * and the own space each have their own.
 */
export interface MoneyView {
  open: MoneyBlock[]
  incomeFilter: ValidityFilter
  /** The income source whose payments are shown (one at a time). */
  incomeSource: Id | null
  /** The account whose actions are shown (one at a time). */
  account: Id | null
}

/** First entry, and after Reset Demo: every block closed, active items shown. */
export const INITIAL_MONEY_VIEW: MoneyView = { open: [], incomeFilter: 'active', incomeSource: null, account: null }

export const isBlockOpen = (view: MoneyView, block: MoneyBlock) => view.open.includes(block)

export function setBlockOpen(view: MoneyView, block: MoneyBlock, open: boolean): MoneyView {
  const others = view.open.filter(item => item !== block)
  return { ...view, open: open ? [...others, block] : others }
}

/** Expand All opens the three blocks, but not the payments of every income source. */
export const setAllBlocksOpen = (view: MoneyView, open: boolean): MoneyView => ({ ...view, open: open ? [...MONEY_BLOCKS] : [] })

/** What each Money block reads and changes. */
export interface MoneyBlocksControl {
  view: MoneyView
  onViewChange: (view: MoneyView) => void
}

export const MoneyBlocksContext = createContext<MoneyBlocksControl>({ view: INITIAL_MONEY_VIEW, onViewChange: () => {} })
