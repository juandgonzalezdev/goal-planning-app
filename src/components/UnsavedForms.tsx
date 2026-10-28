import { useEffect, useRef, useState } from 'react'
import type { UnsavedForm } from '../app/unsavedChanges'

/**
 * The forms with changes that are not saved, and "Copy What I Typed":
 * every field of each of them, as text. Where the browser does not allow
 * copying (Safari may refuse, and a page opened by its address on the
 * local network has no clipboard), the text is shown instead, selected,
 * to copy by hand.
 */
export function UnsavedForms({ forms, typedText }: { forms: UnsavedForm[]; typedText: () => string }) {
  const [shown, setShown] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (shown === null) return
    box.current?.focus()
    box.current?.select()
  }, [shown])

  if (forms.length === 0) return null
  const copy = async () => {
    const text = typedText()
    setCopied(false)
    try {
      await navigator.clipboard.writeText(text)
      setShown(null)
      setCopied(true)
    } catch {
      setShown(text)
    }
  }
  return (
    <div className="unsaved-forms">
      <p>Not saved here: {forms.map(form => form.title + (form.closed ? ' (closed)' : '')).join(', ')}.</p>
      <div className="inline-actions">
        <button type="button" className="button-small" onClick={() => void copy()}>Copy What I Typed</button>
        {shown === null && <button type="button" className="button-small" onClick={() => setShown(typedText())}>Show What I Typed</button>}
      </div>
      {copied && <p role="status">Copied. Paste it somewhere safe before you discard it.</p>}
      {shown !== null && (
        <label className="form-field">What you typed. Select it and copy it.
          <textarea ref={box} readOnly rows={Math.min(12, shown.split('\n').length + 1)} value={shown} />
        </label>
      )}
    </div>
  )
}

/** A question before what was typed is dropped: never without the user's yes. */
export function ConfirmDiscard({ question, confirm, onConfirm, onCancel }: { question: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="discard-question">
      <p>{question}</p>
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" onClick={onConfirm}>{confirm}</button>
        <button type="button" className="button-small" onClick={onCancel}>Keep Editing</button>
      </div>
    </div>
  )
}
