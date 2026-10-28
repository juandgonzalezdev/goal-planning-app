import type { FinanceData } from '../domain/finance/types'

/**
 * What happened to a change. Screens say which one, so a change that was
 * not saved is never shown as done:
 * - `saved`: the store confirmed it (the whole transaction finished).
 * - `demo`: kept in the demo, which is never saved.
 * - `not-saved`: the browser refused or failed. Nothing was changed.
 * - `conflict`: another tab changed or erased the space first. Nothing was changed.
 * - `outdated`: the edit started before the space was opened again with
 *   newer changes. Nothing was changed, so those changes are not written over.
 * - `read-only`: this browser can only show the space. Nothing was saved.
 * - `busy`: another change is still being saved. Nothing was changed.
 * - `stale`: the user left, erased or switched space before the answer
 *   came. The answer is ignored, but that does NOT undo the write: the
 *   store may have saved it. Screens do nothing with it.
 */
export type SaveOutcome = 'saved' | 'demo' | 'not-saved' | 'conflict' | 'outdated' | 'read-only' | 'busy' | 'stale'

/** The change is now in the open space (saved, or kept in the demo): the screen can close the form or move on. */
export const isKept = (outcome: SaveOutcome): boolean => outcome === 'saved' || outcome === 'demo'

/** A short sentence after a change, e.g. "Balance updated. Saved on this device." Empty for `stale`. */
export function outcomeText(done: string, outcome: SaveOutcome): string {
  switch (outcome) {
    case 'saved': return `${done} Saved on this device.`
    case 'demo': return `${done} Demo only: not saved.`
    case 'not-saved': return 'This browser did not save it. Nothing was changed. Try again.'
    case 'conflict': return 'Not saved: this space changed in another tab. Nothing was changed here.'
    case 'outdated': return 'Not saved: this was started before the latest changes were opened. Copy what you need, then open it again.'
    case 'read-only': return 'Not saved: this browser can only show your space right now.'
    case 'busy': return 'Not saved yet: the last change is still being saved. Try again in a moment.'
    case 'stale': return ''
  }
}

/**
 * How a screen changes the open space: `change` gets the records on screen
 * and returns the changed ones. `base` is the revision a form started on
 * (`useEditBase`); without it, the revision on screen.
 */
export type ChangeSpace = (change: (data: FinanceData) => FinanceData, base?: number) => Promise<SaveOutcome>
