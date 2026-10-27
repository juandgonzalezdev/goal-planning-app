import { createContext, type PointerEvent } from 'react'
import type { HomeBlock } from '../../ui/amountVisibility'
import { DEFAULT_LAYOUT, type HomeLayout } from './homeLayout'

/** What Home tells each block: open or closed, and, while customizing, how to move it. */
export interface HomeBlocksControl {
  layout: HomeLayout
  customizing: boolean
  toggle: (block: HomeBlock) => void
  move: (block: HomeBlock, to: number) => void
  /** Starts dragging a block by its handle (Customize Home only). */
  startDrag: (block: HomeBlock, event: PointerEvent<HTMLElement>) => void
  dragging: HomeBlock | null
  /** Where the dragged block would land: before or after this block. */
  dropTarget: { block: HomeBlock; side: 'before' | 'after' } | null
}

export const HomeBlocksContext = createContext<HomeBlocksControl>({
  layout: { ...DEFAULT_LAYOUT, open: [...DEFAULT_LAYOUT.order] }, customizing: false,
  toggle: () => {}, move: () => {}, startDrag: () => {}, dragging: null, dropTarget: null,
})
