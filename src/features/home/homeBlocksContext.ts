import { createContext, type PointerEvent } from 'react'
import type { HomeArea } from '../../ui/amountVisibility'
import { HOME_SECTIONS, DEFAULT_LAYOUT, type HomeLayout, type HomeSection } from './homeLayout'

/** What Home tells each area and part: open or closed, and, while customizing, how to move an area. */
export interface HomeBlocksControl {
  layout: HomeLayout
  customizing: boolean
  toggle: (section: HomeSection) => void
  move: (area: HomeArea, to: number) => void
  /** Starts dragging an area by its handle (Customize Home only). */
  startDrag: (area: HomeArea, event: PointerEvent<HTMLElement>) => void
  dragging: HomeArea | null
  /** Where the dragged area would land: before or after this area. */
  dropTarget: { area: HomeArea; side: 'before' | 'after' } | null
  /** The name of an area as shown (Our Money & Goals in a Duo). */
  name: (area: HomeArea) => string
}

export const HomeBlocksContext = createContext<HomeBlocksControl>({
  layout: { ...DEFAULT_LAYOUT, open: [...HOME_SECTIONS] }, customizing: false,
  toggle: () => {}, move: () => {}, startDrag: () => {}, dragging: null, dropTarget: null, name: area => area,
})
