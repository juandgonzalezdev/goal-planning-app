import { useState } from 'react'
import type { EraseOutcome, SpaceProblem } from '../../app/useSpace'
import type { SaveOutcome } from '../../ui/saveOutcome'

type Props = {
  problem: Extract<SpaceProblem, { kind: 'unreadable' }>
  /** A change is being saved: the actions wait. */
  busy: boolean
  /** "Download Both Copies": true once the file is made. Only reads. */
  onDownload: () => Promise<boolean>
  onUseOlderCopy: () => Promise<SaveOutcome>
  onErase: () => Promise<EraseOutcome>
  onRetry: () => void
  onExplore: () => void
}

const REASONS = {
  'broken': 'It may be damaged, or it is not information from this app.',
  'missing': 'The space this device points to is not there.',
  'copies-differ': 'The copy made from the information older versions of the app saved does not match it.',
  'newer-version': '',
} as const

const ERASE_TEXT: Partial<Record<EraseOutcome, string>> = {
  'failed': 'This browser did not allow erasing. Nothing was changed.',
  'read-only': 'This browser cannot erase it right now. Nothing was changed.',
  'busy': 'Still saving. Try again in a moment.',
}

/**
 * Saved information that cannot be opened. Nothing here starts a new
 * space, and nothing is changed without a yes: first Download Both Copies
 * (every copy as it is), then Use Older Copy (the copy that cannot be
 * opened is set aside, not deleted) or Erase. Information saved by a
 * newer version of the app is only downloaded, never replaced or erased.
 */
export function Recovery({ problem, busy, onDownload, onUseOlderCopy, onErase, onRetry, onExplore }: Props) {
  const [asking, setAsking] = useState<'older' | 'erase' | null>(null)
  const [message, setMessage] = useState('')
  const [downloaded, setDownloaded] = useState('')
  const newer = problem.reason === 'newer-version'

  const download = async () => {
    setDownloaded('')
    setDownloaded(await onDownload() ? 'Recovery file downloaded. Keep it private.' : 'The copies could not be read. Nothing was changed.')
  }
  const openOlder = async () => {
    setAsking(null)
    setMessage('')
    const outcome = await onUseOlderCopy()
    if (outcome === 'conflict') setMessage('Something changed in another tab, so the older copy was not opened. This is what the device has now.')
    else if (outcome === 'busy') setMessage('Still saving. Try again in a moment.')
    else if (outcome === 'not-saved') setMessage('The older copy could not be opened. Nothing was changed.')
  }
  const erase = async () => {
    setAsking(null)
    setMessage('')
    setMessage(ERASE_TEXT[await onErase()] ?? '')
  }

  return (
    <div className="screen-column">
      <h1 className="screen-title">Your Saved Information</h1>
      <div className="callout callout-warning" role="alert">
        {newer ? <>
          <p>Your space was saved by a newer version of the app, so this version cannot open it. It has not been changed.</p>
          <p>Open it with the latest version: reload the page, or open the app where you used it last.</p>
        </> : <>
          <p>Saved information on this device could not be opened. It has not been changed.</p>
          <p>{problem.source === 'older-copy' ? 'This is the copy older versions of the app saved. ' : ''}{REASONS[problem.reason]}</p>
        </>}
      </div>
      <section className="sub-block" aria-labelledby="recovery-download">
        <h2 id="recovery-download" className="section-title">Download Both Copies</h2>
        <p className="field-help">Saves every copy this device keeps, exactly as saved, also the ones that cannot be opened. It is a recovery file with your information not encrypted, not a backup: Restore Backup may not open it. Keep it private.</p>
        <button type="button" className="button-secondary" onClick={() => void download()}>Download Both Copies</button>
        {downloaded && <p className="muted-note" role="status">{downloaded}</p>}
      </section>
      {!newer && problem.olderCopy && (
        <section className="sub-block" aria-labelledby="recovery-older">
          <h2 id="recovery-older" className="section-title">Use Older Copy</h2>
          <p className="field-help">Opens the copy older versions of the app saved. It may not have your latest changes.</p>
          {asking === 'older' ? (
            <div className="discard-question">
              <p>Open the older copy? The copy that cannot be opened is kept aside, not deleted.</p>
              <div className="inline-actions">
                <button type="button" className="button-small button-small-primary" aria-disabled={busy || undefined} onClick={() => { if (!busy) void openOlder() }}>Use Older Copy</button>
                <button type="button" className="button-small" onClick={() => setAsking(null)}>Cancel</button>
              </div>
            </div>
          ) : <button type="button" className="button-secondary" onClick={() => setAsking('older')}>Use Older Copy…</button>}
        </section>
      )}
      {!newer && (
        <section className="sub-block" aria-labelledby="recovery-erase">
          <h2 id="recovery-erase" className="section-title">Erase Saved Information</h2>
          <p className="field-help">Removes everything this app saved on this device, so a new space can be started. Download Both Copies first if you may need them.</p>
          {asking === 'erase' ? (
            <div className="discard-question">
              <p>Erase everything saved on this device? This cannot be undone.</p>
              <div className="inline-actions">
                <button type="button" className="button-small button-small-primary" aria-disabled={busy || undefined} onClick={() => { if (!busy) void erase() }}>Erase Everything</button>
                <button type="button" className="button-small" onClick={() => setAsking(null)}>Cancel</button>
              </div>
            </div>
          ) : <button type="button" className="button-secondary" onClick={() => setAsking('erase')}>Erase Saved Information…</button>}
        </section>
      )}
      {message && <p className="muted-note" role="status">{message}</p>}
      <div className="screen-actions">
        <button type="button" className="button-secondary" onClick={onRetry}>Try Again</button>
        <button type="button" className="button-quiet" onClick={onExplore}>Explore the App</button>
      </div>
    </div>
  )
}
