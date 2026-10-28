import { createContext } from 'react'
import type { Id } from '../../domain/finance/types'
import type { ValidityFilter } from '../../domain/finance/validity'

/** The six blocks of Data, always in this order (Data has no Customize). */
export const DATA_BLOCKS = ['income', 'bills', 'debts', 'accounts', 'goals', 'reports'] as const
export type DataBlock = (typeof DATA_BLOCKS)[number]

export const DATA_BLOCK_NAMES: Record<DataBlock, string> = {
  income: 'Income',
  bills: 'Bills',
  debts: 'Cards & Loans',
  accounts: 'Accounts & Balances',
  goals: 'Goals & Emergency Fund',
  reports: 'Reports & Backup',
}

/**
 * How Data looks while moving around the app: which blocks are open, the
 * filters, and the income source or account shown in detail. It is a
 * screen preference, never data, and lasts for the session only. The demo
 * and the own space each have their own.
 */
export interface DataView {
  open: DataBlock[]
  incomeFilter: ValidityFilter
  billFilter: ValidityFilter
  /** The income source whose payments are shown (one at a time). */
  incomeSource: Id | null
  /** The account whose actions are shown (one at a time). */
  account: Id | null
}

/** First entry, and after Reset Demo: every block closed, active items shown. */
export const INITIAL_DATA_VIEW: DataView = { open: [], incomeFilter: 'active', billFilter: 'active', incomeSource: null, account: null }

export const isBlockOpen = (view: DataView, block: DataBlock) => view.open.includes(block)

export function setBlockOpen(view: DataView, block: DataBlock, open: boolean): DataView {
  const others = view.open.filter(item => item !== block)
  return { ...view, open: open ? [...others, block] : others }
}

/** Expand All opens the six blocks, but not the payments of every income source. */
export const setAllBlocksOpen = (view: DataView, open: boolean): DataView => ({ ...view, open: open ? [...DATA_BLOCKS] : [] })

/** What each Data block reads and changes. */
export interface DataBlocksControl {
  view: DataView
  onViewChange: (view: DataView) => void
}

export const DataBlocksContext = createContext<DataBlocksControl>({ view: INITIAL_DATA_VIEW, onViewChange: () => {} })
