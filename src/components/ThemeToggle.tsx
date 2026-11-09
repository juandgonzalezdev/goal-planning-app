import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { IconTip } from './IconTip'
import { isKept, type SaveOutcome } from '../ui/saveOutcome'

/** Confirm an explicit appearance action only after the existing owner keeps it. */
export function ThemeToggle({ dark, onChange, noticeHost }: { dark: boolean; onChange: (dark: boolean) => Promise<SaveOutcome>; noticeHost?: HTMLElement | null }) {
  const [notice, setNotice] = useState<{ dark: boolean; text: string } | null>(null)
  const message = notice?.dark === dark ? notice.text : ''
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2000)
    return () => window.clearTimeout(timer)
  }, [notice])
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return <span className={`theme-toggle${message ? ' is-confirming' : ''}`}>
    <button type="button" className="icon-button has-tip" aria-label={label} onClick={async () => {
      const next = !dark
      const outcome = await onChange(next)
      if (alive.current && isKept(outcome)) setNotice({ dark: next, text: next ? 'Dark mode on' : 'Light mode on' })
    }}><Icon name={dark ? 'sun' : 'moon'} /><IconTip label={label} /></button>
    <span className="visually-hidden control-status" role="status">{message}</span>
    {noticeHost && message && createPortal(<span className="control-notice" aria-hidden="true">{message}</span>, noticeHost)}
  </span>
}
