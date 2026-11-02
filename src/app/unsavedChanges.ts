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

/**
 * A form with changes that are not saved. `closed`: the form is no longer
 * on screen, but what was typed is kept until discarded. `kept`: a draft the
 * app keeps while the user looks elsewhere (New Goal, Welcome Setup), so
 * moving around never drops it. `tag` and `month` say where a form belongs,
 * so a change inside a screen can tell which forms it would close.
 */
export interface UnsavedForm {
  id: string
  title: string
  closed: boolean
  kept: boolean
  tag?: string
  month?: string
}

/** What a form says about itself when it has changes. */
export interface UnsavedEntry { title: string; text: string; kept?: boolean; tag?: string; month?: string }

export interface UnsavedRegistry {
  /** The form `id` has these changes (null: none any more; `closed`: because the editor was closed). */
  set(id: string, entry: UnsavedEntry | null, closed?: boolean): void
  /** The form `id` left the screen. */
  leave(id: string): void
}

export const UnsavedChangesContext = createContext<UnsavedRegistry | null>(null)

/** Where a form belongs: what a change inside a screen compares with. */
export interface FormPlace { tag?: string; month?: string }

/**
 * For a form: says whether it has changes that are not saved. `fields` is
 * what the form shows (null while it is closed, for an editor that opens
 * on demand). It counts as modified once it differs from what it showed
 * when it opened. `settle()` after a save that keeps the form open: what
 * it shows then is the new starting point. A form that starts from
 * something to fill in (Subscription, Explore, Restore Backup) passes
 * `empty`: it is modified while it differs from an empty form. `tag` and
 * `month` say where the form belongs (see `useLeaveGuard`); `id` is its
 * place in the registry.
 */
export function useUnsavedChanges(title: string, fields: TypedFields | null, options: FormPlace & { empty?: TypedFields } = {}) {
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
  const { empty, tag, month } = options
  const start = empty ? describeTyped(title, empty) : opened
  const modified = text !== null && start !== null && text !== start

  useEffect(() => { registry?.set(id, modified && text !== null ? { title, text, tag, month } : null, text === null) }, [registry, id, modified, title, text, tag, month])
  useEffect(() => () => registry?.leave(id), [registry, id])

  return { modified, settle: () => setSettling(true), id }
}

/**
 * Asks before a change inside the app closes forms with changes:
 * `lost(form)` says which forms the change would close, and `run` makes
 * the change. Nothing to lose: `run` happens at once. Otherwise the app
 * asks "Leave without saving?", and `run` happens only after Discard and
 * Leave. Without the app around it (a screen tested on its own), `run`
 * happens at once.
 */
export type LeaveGuard = (lost: (form: UnsavedForm) => boolean, run: () => void) => void
export const LeaveGuardContext = createContext<LeaveGuard>((_, run) => run())
export const useLeaveGuard = () => useContext(LeaveGuardContext)

/**
 * The app's list of forms with unsaved changes. While saving is blocked
 * (`keepClosed`), a modified form that leaves the screen keeps what was
 * typed here, so it can still be copied: nothing is dropped silently.
 */
export function useUnsavedRegistry() {
  const texts = useRef(new Map<string, { title: string; text: string; closed: boolean; kept: boolean; tag?: string; month?: string }>())
  const keepClosed = useRef(false)
  const [forms, setForms] = useState<UnsavedForm[]>([])
  const formsOf = useCallback(() => [...texts.current].map(([id, entry]) => ({ id, title: entry.title, closed: entry.closed, kept: entry.kept, tag: entry.tag, month: entry.month })), [])
  const sync = useCallback(() => { setForms(formsOf()) }, [formsOf])

  const registry = useMemo<UnsavedRegistry>(() => ({
    set(id, entry, closed = false) {
      const before = texts.current.get(id)
      if (entry) texts.current.set(id, { title: entry.title, text: entry.text, closed: false, kept: entry.kept ?? false, tag: entry.tag, month: entry.month })
      else if (before && closed && keepClosed.current && !before.kept) texts.current.set(id, { ...before, closed: true })
      else texts.current.delete(id)
      const after = texts.current.get(id)
      if (before?.title !== after?.title || before?.closed !== after?.closed || before?.tag !== after?.tag || before?.month !== after?.month) sync()
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
    /** True while any form has unsaved changes (also one kept after it closed, or a kept draft). Read when it is needed, not only on screen. */
    hasUnsaved: useCallback(() => texts.current.size > 0, []),
    /**
     * The forms a change would close: on screen, not a kept draft, and `lost` says so. None while
     * saving is blocked, because then a form that closes keeps what was typed (`keepClosed`).
     */
    losing: useCallback((lost: (form: UnsavedForm) => boolean) => (keepClosed.current ? [] : formsOf().filter(form => !form.closed && !form.kept && lost(form))), [formsOf]),
    /** Everything typed in the forms with unsaved changes, for the clipboard; with `ids`, only those forms. */
    typedText: useCallback((ids?: readonly string[]) => [...texts.current].filter(([id]) => !ids || ids.includes(id)).map(([, entry]) => entry.text).join('\n\n'), []),
    setKeepClosed: useCallback((keep: boolean) => { keepClosed.current = keep }, []),
    /** The user chose to discard what was typed. */
    discardAll: useCallback(() => { texts.current.clear(); sync() }, [sync]),
  }
}
