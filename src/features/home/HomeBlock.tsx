import { useContext, type ReactNode } from 'react'
import { FoldBlock } from '../../components/FoldBlock'
import { Icon } from '../../components/Icon'
import type { HomeBlock } from '../../ui/amountVisibility'
import { HomeBlocksContext } from './homeBlocksContext'
import { isOpen } from './homeLayout'

type Props = {
  block: HomeBlock
  /** The heading; My Money and My Goals are "Our …" in a Duo. */
  title: string
  /** The period or date the block refers to, shown even when it is closed. */
  period: string
  /** A short line shown while the block is closed. It must follow the block's hidden amounts. */
  summary: ReactNode
  /** Buttons next to the heading (eye, links). They never open or close the block. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * One Home block that opens and closes from its heading, like a day in
 * Bills (the shared FoldBlock, also used by Data). A closed block keeps its
 * period and a short summary; its content stays in place (with any form
 * being typed), but it cannot be reached by keyboard or read by a screen
 * reader until the block opens again.
 */
export function HomeBlockFrame({ block, title, period, summary, actions, children }: Props) {
  const control = useContext(HomeBlocksContext)
  const open = isOpen(control.layout, block)
  const index = control.layout.order.indexOf(block)
  const count = control.layout.order.length
  const name = title
  const drop = control.dropTarget?.block === block ? ` drop-${control.dropTarget.side}` : ''
  const arrange = control.customizing && (
    <div className="block-arrange">
      <span className="drag-handle" aria-hidden="true" title={`Drag to move ${name}`} onPointerDown={event => control.startDrag(block, event)}>
        <Icon name="grip" size={20} />
      </span>
      <small className="block-position">{index + 1} of {count}</small>
      <span className="inline-actions">
        <button type="button" className="button-small" data-move="up" aria-label={`Move up: ${name}`} disabled={index <= 0}
          onClick={() => control.move(block, index - 1)}><Icon name="chevronUp" size={16} /> Move up</button>
        <button type="button" className="button-small" data-move="down" aria-label={`Move down: ${name}`} disabled={index >= count - 1}
          onClick={() => control.move(block, index + 1)}><Icon name="chevronDown" size={16} /> Move down</button>
      </span>
    </div>
  )

  // While customizing, every block shows only its heading and summary, and the heading does not open it.
  return (
    <FoldBlock title={title} period={period} summary={summary} expanded={open && !control.customizing}
      onToggle={control.customizing ? undefined : () => control.toggle(block)} actions={control.customizing ? undefined : actions} before={arrange}
      className={`home-section home-block${control.dragging === block ? ' is-dragging' : ''}${drop}`} dataset={{ 'data-home-block': block }}>
      {children}
    </FoldBlock>
  )
}
