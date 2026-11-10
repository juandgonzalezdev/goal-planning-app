import { AREA_OF, HOME_AREAS, HOME_BLOCKS, type HomeArea, type HomeBlock } from '../../ui/amountVisibility'
import type { RingArea } from '../../domain/finance/goalRings'
import { isYearMonth, type YearMonth } from '../../domain/calendar'

/** The five parts of Home that open and close (inside This Month and Money & Goals). This Month also folds as an area; Left to Pay always shows. */
export const HOME_SECTIONS = ['categories', 'year', 'money', 'debt', 'goals'] as const satisfies readonly HomeBlock[]
export type HomeSection = (typeof HOME_SECTIONS)[number]

/** The parts of each area that open and close, in their fixed order. */
export const AREA_SECTIONS: Record<HomeArea, HomeSection[]> = {
  month: ['categories', 'year'],
  'left-to-pay': [],
  'money-goals': ['money', 'debt', 'goals'],
}

/**
 * How Home is arranged: the order of its three areas and which parts are
 * open. It is a screen preference, never data: changing it changes no
 * amount, no record and no hidden amount.
 */
export interface HomeLayout {
  ringSelection?: RingArea
  /** UI only, on this device: months whose completed Bills were already celebrated (at most once per YYYY-MM). */
  celebratedBillMonths?: YearMonth[]
  /** Absent in existing layouts: preserve the previously expanded rings. */
  ringsOpen?: boolean
  /** Absent in existing layouts: preserve the expanded This Month area. */
  monthOpen?: boolean
  /** Ring-first Home: whether More for [Month] is open. Absent: closed, so the ring and its card come first. */
  moreOpen?: boolean
  order: HomeArea[]
  open: HomeSection[]
}

/** First time (or after Reset Layout): This Month, Left to Pay, Money & Goals, with every part closed. */
export const DEFAULT_LAYOUT: HomeLayout = { order: [...HOME_AREAS], open: [] }

const isArea = (value: unknown): value is HomeArea => typeof value === 'string' && (HOME_AREAS as readonly string[]).includes(value)
const isBlock = (value: unknown): value is HomeBlock => typeof value === 'string' && (HOME_BLOCKS as readonly string[]).includes(value)
const isSection = (value: unknown): value is HomeSection => typeof value === 'string' && (HOME_SECTIONS as readonly string[]).includes(value)
const unique = <T,>(values: T[]) => [...new Set(values)]
const complete = (saved: HomeArea[]) => [...saved, ...HOME_AREAS.filter(area => !saved.includes(area))]
const openSections = (value: unknown) => (Array.isArray(value) ? unique(value.filter(isSection)) : [])

/**
 * Reads a saved layout of any age or shape, so every area always appears
 * exactly once.
 * - This version (`version: 2`): the three areas and the open parts.
 * - An earlier version (seven blocks): each area takes the place of the
 *   first of its blocks, and a part stays open when its block was open.
 *   This Month and Left to Pay were blocks too; legacy open entries do not
 *   override the default area expansion.
 * - Anything else: the first layout.
 */
export function normalizeLayout(value: unknown): HomeLayout {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const rings = typeof record.ringsOpen === 'boolean' ? { ringsOpen: record.ringsOpen } : {}
  const month = typeof record.monthOpen === 'boolean' ? { monthOpen: record.monthOpen } : {}
  const more = typeof record.moreOpen === 'boolean' ? { moreOpen: record.moreOpen } : {}
  const selection = ['income', 'bills', 'debts', 'goals'].includes(record.ringSelection as string) ? { ringSelection: record.ringSelection as RingArea } : {}
  const months = Array.isArray(record.celebratedBillMonths) ? unique(record.celebratedBillMonths.filter(isYearMonth)) : []
  const celebrated = months.length ? { celebratedBillMonths: months } : {}
  const order = Array.isArray(record.order) ? record.order : []
  if (record.version === 2) return { ...rings, ...month, ...more, ...selection, ...celebrated, order: complete(unique(order.filter(isArea))), open: openSections(record.open) }
  return { order: complete(unique(order.filter(isBlock).map(block => AREA_OF[block]))), open: openSections(record.open) }
}

/** What is saved: the layout, marked as this version's. */
export const layoutToSave = (layout: HomeLayout) => ({ version: 2, order: layout.order, open: layout.open, ...(layout.ringsOpen === undefined ? {} : { ringsOpen: layout.ringsOpen }), ...(layout.monthOpen === undefined ? {} : { monthOpen: layout.monthOpen }), ...(layout.moreOpen === undefined ? {} : { moreOpen: layout.moreOpen }), ...(layout.ringSelection === undefined ? {} : { ringSelection: layout.ringSelection }), ...(layout.celebratedBillMonths?.length ? { celebratedBillMonths: layout.celebratedBillMonths } : {}) })

/**
 * Celebrated months only grow while the same space stays open: a change made from an older copy of the
 * layout (a selection, Reset Layout) never brings a celebration back. Reset Demo and erasing the space
 * start from the first layout on purpose and do not go through here.
 */
export function keepCelebratedMonths(current: HomeLayout, next: HomeLayout): HomeLayout {
  const months = current.celebratedBillMonths ?? []
  if (months.every(month => next.celebratedBillMonths?.includes(month))) return next
  return { ...next, celebratedBillMonths: unique([...months, ...(next.celebratedBillMonths ?? [])]) }
}

export const isOpen = (layout: HomeLayout, section: HomeSection) => layout.open.includes(section)

export function setOpen(layout: HomeLayout, section: HomeSection, open: boolean): HomeLayout {
  const others = layout.open.filter(item => item !== section)
  return { ...layout, open: open ? [...others, section] : others }
}

/** Expand All and Collapse All: This Month, five parts, the classic rings card and Ring-first's More. Headers stay visible. */
export const setAllOpen = (layout: HomeLayout, open: boolean): HomeLayout => ({ ...layout, monthOpen: open, ringsOpen: open, moreOpen: open, open: open ? [...HOME_SECTIONS] : [] })

/** Puts `area` at position `to` (0 is the top); the others keep their order. */
export function moveArea(layout: HomeLayout, area: HomeArea, to: number): HomeLayout {
  const rest = layout.order.filter(item => item !== area)
  const index = Math.max(0, Math.min(rest.length, to))
  return { ...layout, order: [...rest.slice(0, index), area, ...rest.slice(index)] }
}
