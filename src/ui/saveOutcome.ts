/**
 * What happened to a change: saved on this device, kept in the demo (which
 * is never saved), or refused by the browser. Screens say which one, so a
 * change that was not saved is never shown as done.
 */
export type SaveOutcome = 'saved' | 'demo' | 'not-saved'

/** A short sentence after a change, e.g. "Balance updated. Saved on this device." */
export function outcomeText(done: string, outcome: SaveOutcome): string {
  if (outcome === 'saved') return `${done} Saved on this device.`
  if (outcome === 'demo') return `${done} Demo only: not saved.`
  return `${done} This browser did not save it, so it will be lost when you close the page.`
}
