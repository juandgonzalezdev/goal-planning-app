import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { UnsavedForm } from '../app/unsavedChanges'
import { useT } from '../i18n'

/**
 * The forms with changes that are not saved, and "Copy What I Typed":
 * every field of each of them, as text. Where the browser does not allow
 * copying (Safari may refuse, and a page opened by its address on the
 * local network has no clipboard), the text is shown instead, selected,
 * to copy by hand.
 */
export function UnsavedForms({ forms, typedText }: { forms: UnsavedForm[]; typedText: () => string }) {
  const { t } = useT()
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
      <p>{t('unsaved.notSavedHere', { forms: forms.map(form => (form.closed ? t('unsaved.closed', { title: form.title }) : form.title)).join(', ') })}</p>
      <div className="inline-actions">
        <button type="button" className="button-small" onClick={() => void copy()}>{t('unsaved.copy')}</button>
        {shown === null && <button type="button" className="button-small" onClick={() => setShown(typedText())}>{t('unsaved.show')}</button>}
      </div>
      {copied && <p role="status">{t('unsaved.copied')}</p>}
      {shown !== null && (
        <label className="form-field">{t('unsaved.typedLabel')}
          <textarea ref={box} readOnly rows={Math.min(12, shown.split('\n').length + 1)} value={shown} />
        </label>
      )}
    </div>
  )
}

/** A question before what was typed is dropped: never without the user's yes. */
export function ConfirmDiscard({ question, confirm, onConfirm, onCancel }: { question: string; confirm: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useT()
  return (
    <div className="discard-question">
      <p>{question}</p>
      <div className="inline-actions">
        <button type="button" className="button-small button-small-primary" onClick={onConfirm}>{confirm}</button>
        <button type="button" className="button-small" onClick={onCancel}>{t('unsaved.keepEditing')}</button>
      </div>
    </div>
  )
}

/**
 * "Leave without saving?": a move would close forms with changes. Keep
 * Editing (first, and Escape) stays exactly where the user was; Copy What I
 * Typed copies only these forms and stays open; Discard and Leave makes the
 * move once. While the move cannot be made safely yet (`canDiscard` false),
 * Discard and Leave waits, and after a while the dialog says so: nothing is
 * decided by the waiting.
 */
export function LeaveDialog({ forms, typedText, canDiscard, onKeep, onDiscard }: {
  forms: UnsavedForm[]; typedText: () => string; canDiscard: boolean; onKeep: () => void; onDiscard: () => void
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const { t } = useT()
  const [shown, setShown] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => { keep.current?.focus() }, [])
  // Each wait starts again: "taking longer" only after two seconds of this one.
  const [waited, setWaited] = useState(canDiscard)
  if (waited !== canDiscard) { setWaited(canDiscard); setSlow(false) }
  useEffect(() => {
    if (canDiscard) return
    const timer = setTimeout(() => setSlow(true), 2000)
    return () => clearTimeout(timer)
  }, [canDiscard])
  useEffect(() => {
    if (shown === null) return
    box.current?.focus()
    box.current?.select()
  }, [shown])

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
  // The focus stays inside the question; Escape is Keep Editing.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onKeep(); return }
    if (event.key !== 'Tab') return
    const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button, textarea') ?? [])]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  return (
    <div className="leave-backdrop">
      <div ref={dialog} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-text" onKeyDown={onKeyDown}>
        <h2 id="leave-title">{t('unsaved.leaveTitle')}</h2>
        <p id="leave-text">{t('unsaved.leaveText')}</p>
        <ul className="leave-forms">{forms.map(form => <li key={form.id}>{form.title}</li>)}</ul>
        <div className="inline-actions">
          <button ref={keep} type="button" className="button-small button-small-primary" onClick={onKeep}>{t('unsaved.keepEditing')}</button>
          <button type="button" className="button-small" onClick={() => void copy()}>{t('unsaved.copy')}</button>
          <button type="button" className="button-small button-small-danger" aria-disabled={!canDiscard || undefined} onClick={() => { if (canDiscard) onDiscard() }}>{t('unsaved.discardLeave')}</button>
        </div>
        {!canDiscard && <p className="field-help" role="status">{slow
          ? t('unsaved.slow')
          : t('unsaved.oneMoment')}</p>}
        {copied && <p role="status">{t('unsaved.copiedKept')}</p>}
        {shown !== null && (
          <label className="form-field">{t('unsaved.typedLabel')}
            <textarea ref={box} readOnly rows={Math.min(12, shown.split('\n').length + 1)} value={shown} />
          </label>
        )}
      </div>
    </div>
  )
}
