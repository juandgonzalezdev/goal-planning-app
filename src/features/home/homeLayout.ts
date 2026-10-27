import { HOME_BLOCKS, type HomeBlock } from '../../ui/amountVisibility'

/**
 * How Home is arranged: the order of its seven blocks and which ones are
 * open. It is a screen preference, never data: changing it changes no
 * amount and no record.
 */
export interface HomeLayout {
  order: HomeBlock[]
  open: HomeBlock[]
}

/** First time (or after Reset Layout): the approved order, with This Month and Left to Pay open. */
export const DEFAULT_LAYOUT: HomeLayout = { order: [...HOME_BLOCKS], open: ['month', 'left-to-pay'] }

const isBlock = (value: unknown): value is HomeBlock => typeof value === 'string' && (HOME_BLOCKS as readonly string[]).includes(value)
const unique = (values: HomeBlock[]) => [...new Set(values)]

/**
 * Reads a saved layout of any age or shape. Unknown names and repeats are
 * dropped and missing blocks are added at the end in their default order,
 * so every block always appears exactly once. Without a usable list of
 * open blocks, the default ones are open.
 */
export function normalizeLayout(value: unknown): HomeLayout {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const saved = Array.isArray(record.order) ? unique(record.order.filter(isBlock)) : []
  const order = [...saved, ...HOME_BLOCKS.filter(block => !saved.includes(block))]
  const open = Array.isArray(record.open) ? unique(record.open.filter(isBlock)) : [...DEFAULT_LAYOUT.open]
  return { order, open }
}

export const isOpen = (layout: HomeLayout, block: HomeBlock) => layout.open.includes(block)

export function setOpen(layout: HomeLayout, block: HomeBlock, open: boolean): HomeLayout {
  const others = layout.open.filter(item => item !== block)
  return { ...layout, open: open ? [...others, block] : others }
}

export const setAllOpen = (layout: HomeLayout, open: boolean): HomeLayout => ({ ...layout, open: open ? [...layout.order] : [] })

/** Puts `block` at position `to` (0 is the top); the others keep their order. */
export function moveBlock(layout: HomeLayout, block: HomeBlock, to: number): HomeLayout {
  const rest = layout.order.filter(item => item !== block)
  const index = Math.max(0, Math.min(rest.length, to))
  return { ...layout, order: [...rest.slice(0, index), block, ...rest.slice(index)] }
}
