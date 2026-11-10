import type { YearMonth } from '../domain/calendar'
import { createContext, useContext, useState } from 'react'
import { isKept, outcomeText, type SaveOutcome } from '../ui/saveOutcome'

/**
 * Whether the screens can change the open space right now, for the
 * controls that do. `useSpace` refuses a change anyway when it cannot be
 * made; this only lets the controls say so before they are used.
 */
export interface WriteStatus {
  /** A change is being saved: every other control that changes data waits (one change at a time). */
  saving: boolean
  /** False while the space can only be shown (read-only, or blocked after a change from another tab). */
  canWrite: boolean
  /** The revision on screen (0 in the demo). */
  revision: number
}

export const WriteStatusContext = createContext<WriteStatus>({ saving: false, canWrite: true, revision: 0 })

export const useWriteStatus = () => useContext(WriteStatusContext)

/**
 * For a control that changes data: true while it must not be used. The
 * control stays focusable (`aria-disabled`), so the focus is not lost
 * while a change is saved; its handler checks `blocked` before acting.
 */
export function useWriteBlocked(): boolean {
  const { saving, canWrite } = useWriteStatus()
  return saving || !canWrite
}

/**
 * For a form: the revision the edit started on, kept while the form is
 * open. Saving with it is refused when the space was opened again with
 * newer changes since, so those changes are never written over silently.
 */
export function useEditBase(): number {
  const { revision } = useWriteStatus()
  const [base] = useState(revision)
  return base
}

/**
 * For a control or a form that saves. `save` sends one change and keeps
 * what was refused, in words (`refusal`), so the screen can say it while
 * the form keeps what was typed. `sending` is true while this one is being
 * saved ("Saving…"); `blocked` while any change is, or none can be.
 */
export function useSaver() {
  const blocked = useWriteBlocked()
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState('')
  const save = async (run: () => Promise<SaveOutcome>): Promise<SaveOutcome> => {
    setSending(true)
    setRefusal('')
    try {
      const outcome = await run()
      if (!isKept(outcome)) setRefusal(outcomeText('', outcome))
      return outcome
    } finally {
      setSending(false)
    }
  }
  return { save, sending, blocked, refusal, clearRefusal: () => setRefusal('') }
}

/** Transient notification of a confirmed user payment; never a retained or replayed event. */
type Completion = { month: YearMonth; spaceId: string }
type Listener = (event: Completion) => boolean
/** Claims the month once (true) or reports it was already celebrated (false). */
type Claimer = (event: Completion) => boolean
/** `claimed`: first completion of that month; `shown`: Home played the pulse, so no extra text is needed. */
export type CelebrationResult = { claimed: boolean; shown: boolean }
export function createBillCelebrationChannel() {
  const listeners = new Set<Listener>()
  let claimer: Claimer | null = null
  return {
    subscribe(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    setClaimer(next: Claimer) { claimer = next; return () => { if (claimer === next) claimer = null } },
    // No retained event: mounting Home, returning from Bills or changing Demo cannot replay a pulse.
    publish(event: Completion): CelebrationResult {
      if (claimer && !claimer(event)) return { claimed: false, shown: false }
      return { claimed: true, shown: [...listeners].some(listener => listener(event)) }
    },
  }
}
export const BillCelebrationContext = createContext({
  subscribe: (listener: Listener): (() => void) => { void listener; return () => {} },
  publish: (event: Completion): CelebrationResult => { void event; return { claimed: true, shown: false } },
})
