import { useId, useState } from 'react'
import { TIPS, useOpenGuide, type TipTopic } from '../features/help/tips'

/**
 * A "?" next to a figure. It opens a short note under it (not a tooltip, so
 * it works the same with a finger, a mouse, the keyboard and a screen
 * reader), with "Read more in the guide". Nothing moves until it is used.
 */
/** `label`: the name shows next to the "?" (where the figure it explains isn't right beside it). */
export function HelpTip({ topic, label = false, hiddenAmounts = false }: { topic: TipTopic; label?: boolean; hiddenAmounts?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const openGuide = useOpenGuide()
  const tip = TIPS[topic]
  return (
    <span className="help-tip">
      <button type="button" className={`help-tip-button${label ? ' has-label' : ''}`} aria-label={`About ${tip.name}`} aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(!open)}><span className="help-tip-mark" aria-hidden="true">?</span>{label && <span aria-hidden="true">{tip.name}</span>}</button>
      <span id={id} className="help-tip-panel" role="note" hidden={!open}>
        {open && <>
          {tip.text.map(line => <span key={line} className="help-tip-line">{line}</span>)}
          {tip.example && !hiddenAmounts && <span className="help-tip-line help-tip-example">{tip.example}</span>}
          {openGuide && <button type="button" className="text-button" onClick={() => openGuide(tip.chapter)}>Read more in the guide</button>}
          <button type="button" className="text-button" onClick={() => setOpen(false)}>Close</button>
        </>}
      </span>
    </span>
  )
}
