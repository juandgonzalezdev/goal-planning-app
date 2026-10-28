import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Which forms have changes that are not saved yet, so the app never puts
 * newer data from another tab over them, and never drops them without
 * asking. Each form says whether it is modified (different from what it
 * showed when it opened) and what was typed, as text the user can copy
 * ("Copy What I Typed"). The text stays in memory only: it is never
 * saved, sent or logged.
 */

/** A form's fields as the user sees them: label → what is typed or chosen. Empty values are left out of the copy. */
export type TypedFields = Record<string, string | number | boolean | null | undefined>

/** "Edit bill / Name: Rent / Amount: 1200" — every field that holds something, one per line. */
export function describeTyped(title: string, fields: TypedFields): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `${label}: ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}`)
  return [title, ...lines].join('\n')
}

/** A form with changes that are not saved. `closed`: the form is no longer on screen, but what was typed is kept until discarded. */
export interface UnsavedForm {
  id: string
  title: string
  closed: boolean
}

export interface UnsavedRegistry {
  /** The form `id` has these changes (null: none any more; `closed`: because the editor was closed). */
  set(id: string, entry: { title: string; text: string } | null, closed?: boolean): void
  /** The form `id` left the screen. */
  leave(id: string): void
}

export const UnsavedChangesContext = createContext<UnsavedRegistry | null>(null)

/**
 * For a form: says whether it has changes that are not saved. `fields` is
 * what the form shows (null while it is closed, for an editor that opens
 * on demand). It counts as modified once it differs from what it showed
 * when it opened. `settle()` after a save that keeps the form open: what
 * it shows then is the new starting point. A draft the app keeps while
 * the form is closed (New Goal, Welcome Setup) passes `empty`: it is
 * modified while it differs from an empty form.
 */
export function useUnsavedChanges(title: string, fields: TypedFields | null, empty?: TypedFields) {
  const registry = useContext(UnsavedChangesContext)
  const id = useId()
  const text = fields ? describeTyped(title, fields) : null
  const [opened, setOpened] = useState(text)
  const [settling, setSettling] = useState(false)
  // Opening or closing an editor, or a settled save, starts again from what it shows now.
  if ((opened === null) !== (text === null) || (settling && opened !== text)) {
    setOpened(text)
  }
  if (settling) setSettling(false)
  const start = empty ? describeTyped(title, empty) : opened
  const modified = text !== null && start !== null && text !== start

  useEffect(() => { registry?.set(id, modified && text !== null ? { title, text } : null, text === null) }, [registry, id, modified, title, text])
  useEffect(() => () => registry?.leave(id), [registry, id])

  return { modified, settle: () => setSettling(true) }
}

/**
 * The app's list of forms with unsaved changes. While saving is blocked
 * (`keepClosed`), a modified form that leaves the screen keeps what was
 * typed here, so it can still be copied: nothing is dropped silently.
 */
export function useUnsavedRegistry() {
  const texts = useRef(new Map<string, { title: string; text: string; closed: boolean }>())
  const keepClosed = useRef(false)
  const [forms, setForms] = useState<UnsavedForm[]>([])
  const sync = useCallback(() => {
    setForms([...texts.current].map(([id, entry]) => ({ id, title: entry.title, closed: entry.closed })))
  }, [])

  const registry = useMemo<UnsavedRegistry>(() => ({
    set(id, entry, closed = false) {
      const before = texts.current.get(id)
      if (entry) texts.current.set(id, { ...entry, closed: false })
      else if (before && closed && keepClosed.current) texts.current.set(id, { ...before, closed: true })
      else texts.current.delete(id)
      const after = texts.current.get(id)
      if (before?.title !== after?.title || before?.closed !== after?.closed) sync()
    },
    leave(id) {
      const entry = texts.current.get(id)
      if (!entry) return
      if (keepClosed.current) texts.current.set(id, { ...entry, closed: true })
      else texts.current.delete(id)
      sync()
    },
  }), [sync])

  return {
    registry,
    forms,
    /** True while any form has unsaved changes (also one kept after it closed). Read when it is needed, not only on screen. */
    hasUnsaved: useCallback(() => texts.current.size > 0, []),
    /** Everything typed in the forms with unsaved changes, for the clipboard. */
    typedText: useCallback(() => [...texts.current.values()].map(entry => entry.text).join('\n\n'), []),
    setKeepClosed: useCallback((keep: boolean) => { keepClosed.current = keep }, []),
    /** The user chose to discard what was typed. */
    discardAll: useCallback(() => { texts.current.clear(); sync() }, [sync]),
  }
}
