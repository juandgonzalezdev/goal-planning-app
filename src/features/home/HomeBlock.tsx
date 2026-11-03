import { useContext, type ReactNode } from 'react'
import { FoldBlock } from '../../components/FoldBlock'
import { Icon } from '../../components/Icon'
import type { HomeArea } from '../../ui/amountVisibility'
import { EyeToggle } from '../../ui/privacy'
import { HomeBlocksContext } from './homeBlocksContext'
import { isOpen, type HomeSection } from './homeLayout'

type SectionProps = {
  block: HomeSection
  title: string
  /** The period or date the part refers to, shown even when it is closed. */
  period: string
  /** A short line shown while the part is closed. It must follow its area's hidden amounts. */
  summary: ReactNode
  /** Buttons next to the heading (links). They never open or close the part. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * One part of a Home area that opens and closes from its heading (the
 * shared FoldBlock, also used by Money and Bills). Closed, it keeps its
 * period and a short summary; its content stays in place (with any form
 * being typed), but it cannot be reached by keyboard or read by a screen
 * reader until it opens again. Its amounts follow its area's eye.
 */
export function HomeBlockFrame({ block, title, period, summary, actions, children }: SectionProps) {
  const control = useContext(HomeBlocksContext)
  return (
    <FoldBlock title={title} period={period} summary={summary} expanded={isOpen(control.layout, block)} level={3}
      onToggle={() => control.toggle(block)} actions={actions} className="home-part" dataset={{ 'data-home-block': block }}>
      {children}
    </FoldBlock>
  )
}

type AreaProps = {
  area: HomeArea
  /** What the area's figures refer to: the month, or the date of the latest balances. */
  period: string
  /** Links next to the eye. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * One of Home's three areas. Its heading, its eye and its main figures
 * always show; only its parts open and close. While customizing, it shows
 * its heading with Move up, Move down and a handle; its content stays in
 * place (with anything typed) but is not shown.
 */
export function HomeAreaFrame({ area, period, actions, children }: AreaProps) {
  const control = useContext(HomeBlocksContext)
  const name = control.name(area)
  const index = control.layout.order.indexOf(area)
  const count = control.layout.order.length
  const titleId = `home-area-${area}`
  const drop = control.dropTarget?.area === area ? ` drop-${control.dropTarget.side}` : ''
  return (
    <section className={`block home-area${area === 'money-goals' ? ' is-balances' : ''}${control.dragging === area ? ' is-dragging' : ''}${drop}`}
      aria-labelledby={`${titleId}-name`} data-home-area={area}>
      {control.customizing && (
        <div className="block-arrange">
          <span className="drag-handle" aria-hidden="true" title={`Drag to move ${name}`} onPointerDown={event => control.startDrag(area, event)}>
            <Icon name="grip" size={20} />
          </span>
          <small className="block-position">{index + 1} of {count}</small>
          <span className="inline-actions">
            <button type="button" className="button-small" data-move="up" aria-label={`Move up: ${name}`} disabled={index <= 0}
              onClick={() => control.move(area, index - 1)}><Icon name="chevronUp" size={16} /> Move up</button>
            <button type="button" className="button-small" data-move="down" aria-label={`Move down: ${name}`} disabled={index >= count - 1}
              onClick={() => control.move(area, index + 1)}><Icon name="chevronDown" size={16} /> Move down</button>
          </span>
        </div>
      )}
      <div className="section-head area-head">
        <h2 className="section-title area-title" id={titleId} tabIndex={-1}>
          <span className="block-name" id={`${titleId}-name`}>{name}</span>
          <small className="block-period">{period}</small>
        </h2>
        {!control.customizing && <div className="inline-actions block-actions"><EyeToggle area={area} name={name} />{actions}</div>}
      </div>
      <div className="area-body">{children}</div>
    </section>
  )
}
