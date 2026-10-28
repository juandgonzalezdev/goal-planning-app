import { useId, type ReactNode } from 'react'
import { Icon } from './Icon'

type Props = {
  title: string
  /** The period or date the block refers to, shown even when it is closed. */
  period?: string
  /** A short line shown while the content is hidden. */
  summary: ReactNode
  /** True when the content is shown. */
  expanded: boolean
  /** Opens or closes the block. Without it the heading is plain text (Customize Home). */
  onToggle?: () => void
  /** Buttons next to the heading. They are not inside the heading button, so they never open or close the block. */
  actions?: ReactNode
  /** Shown above the heading (the Move up / Move down bar of Customize Home). */
  before?: ReactNode
  className?: string
  /** `data-…` attributes that name the block, so a link can find it. */
  dataset?: Record<`data-${string}`, string>
  children: ReactNode
}

/**
 * A block that opens and closes from its heading (Home and Data). Closed,
 * it keeps its period and a short summary; its content stays in the page,
 * with anything typed in a form, but takes no room, cannot be reached by
 * keyboard (inert) and is not read by a screen reader until it opens again.
 */
export function FoldBlock({ title, period, summary, expanded, onToggle, actions, before, className = '', dataset, children }: Props) {
  const id = useId()
  const titleId = `${id}-title`
  const bodyId = `${id}-body`
  const text = <>
    <span id={titleId} className="block-name">{title}</span>
    {period && <small className="block-period">{period}</small>}
    {!expanded && <small className="block-summary">{summary}</small>}
  </>

  return (
    <section className={`block fold-block${expanded ? ' is-open' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={titleId} {...dataset}>
      {before}
      <div className="section-head block-head">
        <h2 className="section-title block-title">
          {onToggle
            ? <button type="button" className="block-toggle" aria-expanded={expanded} aria-controls={bodyId} onClick={onToggle}>
              <span className="block-chevron"><Icon name="chevronDown" size={18} /></span>
              <span className="block-toggle-text">{text}</span>
            </button>
            : <span className="block-toggle"><span className="block-toggle-text">{text}</span></span>}
        </h2>
        {actions && <div className="inline-actions block-actions">{actions}</div>}
      </div>
      <div id={bodyId} className="block-body" inert={!expanded} aria-hidden={!expanded || undefined}>
        <div className="block-body-inner">{children}</div>
      </div>
    </section>
  )
}
