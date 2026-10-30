import { useEffect, useId, useRef, useState } from 'react'

type Props = {
  onReset: () => void
  /** The look of the first Reset Demo button. */
  triggerClassName?: string
  /** Tells the place around it (the demo banner) when the question is showing. */
  onAskingChange?: (asking: boolean) => void
  /** Shows "The demo is back…" after a reset (Data and Settings). */
  showDone?: boolean
}

/**
 * Reset Demo, always in two steps, so a stray tap never restores the
 * example: the first button only asks "Reset demo?". Cancel changes
 * nothing; Reset Demo puts Alex's original example back (only the demo,
 * never the own space). The keyboard goes to Cancel when the question
 * opens and back to the first button when it closes.
 */
export function ResetDemoConfirm({ onReset, triggerClassName = 'button-secondary', onAskingChange, showDone = false }: Props) {
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (!asking && returnFocus.current) { returnFocus.current = false; trigger.current?.focus() }
  }, [asking])

  const ask = (next: boolean) => {
    if (!next) returnFocus.current = true
    setAsking(next)
    onAskingChange?.(next)
  }

  if (!asking) return <>
    <button ref={trigger} type="button" className={triggerClassName} onClick={() => { setDone(false); ask(true) }}>Reset Demo</button>
    {showDone && done && <p className="muted-note" role="status">The demo is back to Alex’s original example.</p>}
  </>
  return <ResetDemoQuestion onCancel={() => ask(false)} onReset={() => { onReset(); setDone(true); ask(false) }} />
}

/**
 * The second step of Reset Demo: "Reset demo?" with Cancel and Reset Demo.
 * The keyboard starts on Cancel. Where it goes when the question closes is
 * up to the place that asked (its first button, or the demo menu).
 */
export function ResetDemoQuestion({ onCancel, onReset }: { onCancel: () => void; onReset: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => { cancel.current?.focus() }, [])
  return (
    <div className="reset-confirm" role="group" aria-labelledby={`${id}-question`} aria-describedby={`${id}-text`}>
      <p><b id={`${id}-question`}>Reset demo?</b> <span id={`${id}-text`}>This will remove your changes and restore Alex’s original example.</span></p>
      <span className="inline-actions">
        <button ref={cancel} type="button" className="button-small" onClick={onCancel}>Cancel</button>
        <button type="button" className="button-small button-small-primary" onClick={onReset}>Reset Demo</button>
      </span>
    </div>
  )
}
