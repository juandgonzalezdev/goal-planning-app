import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { IconTip } from './IconTip'
import { ResetDemoQuestion } from './ResetDemoConfirm'
import { usePopover } from './usePopover'

type Props = {
  /** True while Reset Demo asks "Reset demo?" (the rest of the banner steps aside). */
  asking: boolean
  onAskingChange: (asking: boolean) => void
  onReset: () => void
  onExit: () => void
  /** Exit Demo's question when something typed in the demo would be dropped. */
  exitQuestion?: ReactNode
}

/**
 * The strip shown while the demo is open: "Demo · Invented data", Exit
 * Demo, and a menu of its own (separate from Home options) that explains
 * the demo and holds Reset Demo. Reset Demo still asks first, here and in
 * Data and Settings; Exit Demo still asks when something typed would be
 * dropped. When the question closes, the keyboard goes back to the menu button.
 */
export function DemoBanner({ asking, onAskingChange, onReset, onExit, exitQuestion }: Props) {
  const { open, setOpen, close, rootRef, buttonRef } = usePopover()
  const returnFocus = useRef(false)
  const id = useId()
  const label = 'Demo options'

  useEffect(() => {
    if (!asking && returnFocus.current) { returnFocus.current = false; buttonRef.current?.focus() }
  }, [asking, buttonRef])

  const closeQuestion = () => { returnFocus.current = true; onAskingChange(false) }

  return (
    <div className={`demo-banner${asking ? ' is-asking' : ''}`} role="note">
      {asking
        ? <span className="inline-actions"><ResetDemoQuestion onCancel={closeQuestion} onReset={() => { onReset(); closeQuestion() }} /></span>
        : <>
          <span className="demo-label"><b>Demo</b> · Invented data</span>
          <span className="inline-actions demo-actions">
            <button type="button" className="button-small" onClick={onExit}>Exit Demo</button>
            <div className="menu-root" ref={rootRef}>
              <button ref={buttonRef} type="button" className="icon-button tool-button banner-tool has-tip" aria-label={label} aria-expanded={open}
                aria-controls={open ? `${id}-panel` : undefined} onClick={() => (open ? close() : setOpen(true))}>
                <Icon name="more" size={20} />
                {!open && <IconTip label={label} />}
              </button>
              {open && (
                <div id={`${id}-panel`} className="popover demo-popover" role="group" aria-label="About the demo">
                  <p>Alex and all the information in this demo are invented.</p>
                  <p>Changes are not saved: they last until you leave the demo or reset it.</p>
                  <button type="button" className="button-small" onClick={() => { setOpen(false); onAskingChange(true) }}>Reset Demo</button>
                </div>
              )}
            </div>
          </span>
        </>}
      {exitQuestion && <div className="demo-question" role="alert">{exitQuestion}</div>}
    </div>
  )
}
