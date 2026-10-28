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
