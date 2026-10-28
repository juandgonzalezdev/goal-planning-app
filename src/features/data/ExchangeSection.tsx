import { useRef, useState, type ChangeEvent } from 'react'
import { exportFinanceData, importFinanceData } from '../../data/exchange'
import type { FinanceData } from '../../domain/finance/types'
import { isKept, outcomeText, type SaveOutcome } from '../../ui/saveOutcome'
import { useSaver, useWriteStatus } from '../../app/writeStatus'
import { useUnsavedChanges } from '../../app/unsavedChanges'
import { downloadFile } from '../../ui/download'

/**
 * Data Backup: download everything as a JSON file; Restore Backup: read it
 * back. This is the copy that can be restored (the PDF report cannot).
 * Restoring never replaces anything until the user confirms.
 */
type Props = {
  data: FinanceData
  isDemo: boolean
  onReplace: (data: FinanceData, base?: number) => Promise<SaveOutcome>
  /** While the space can only be shown: "Download Both Copies", every copy as stored. */
  onDownloadCopies?: () => Promise<boolean>
}

export function ExchangeSection({ data, isDemo, onReplace, onDownloadCopies }: Props) {
  const [pending, setPending] = useState<FinanceData | null>(null)
  const { revision } = useWriteStatus()
  const saver = useSaver()
  // The revision on screen when the file was chosen: Replace never writes over changes opened since.
  const [base, setBase] = useState(revision)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState('')
  const [copiesText, setCopiesText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  // A backup read and waiting for Replace is a change not made yet: it is never dropped silently.
  useUnsavedChanges('Restore Backup', pending ? { 'Backup file of': pending.space.name } : null, {})

  const download = () => downloadFile(exportFinanceData(data), 'goal-planning-backup.json')
  const downloadCopies = async () => {
    setCopiesText('')
    const done = await onDownloadCopies?.()
    setCopiesText(done ? 'Recovery file downloaded.' : 'The copies could not be read. Nothing was changed.')
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setDone('')
    if (!file) return
    const result = importFinanceData(await file.text())
    if (result.status === 'imported') { setErrors([]); setBase(revision); saver.clearRefusal(); setPending(result.data) }
    else { setPending(null); setErrors(result.errors) }
  }

  return (
    <>
      <section className="sub-block" aria-labelledby="data-backup">
        <h3 id="data-backup" className="section-title">Data Backup</h3>
        <p className="field-help">Download everything in this space as a JSON file, to restore it later. Keep it somewhere safe: it is not encrypted.</p>
        <button type="button" className="button-secondary" onClick={download}>Download Backup</button>
        {onDownloadCopies && <>
          <p className="field-help">Download Both Copies saves every copy this device keeps, exactly as saved. It is a recovery file with your information not encrypted, not a backup: Restore Backup may not open it. Keep it private.</p>
          <button type="button" className="button-secondary" onClick={() => void downloadCopies()}>Download Both Copies</button>
          {copiesText && <p className="muted-note" role="status">{copiesText}</p>}
        </>}
      </section>
      <section className="sub-block" aria-labelledby="data-restore">
        <h3 id="data-restore" className="section-title">Restore Backup</h3>
        {isDemo ? (
          <p className="field-help">Exit the demo to import your own data. Demo information and your own space are never mixed.</p>
        ) : <>
          <p className="field-help">Replace this space with a backup file. The file is checked first, and nothing changes until you confirm.</p>
          <label className="form-field">Choose a backup file (JSON)
            <input ref={fileInput} type="file" accept="application/json,.json" onChange={readFile} />
          </label>
          {errors.length > 0 && (
            <div className="callout callout-warning" role="alert">
              <p>This file cannot be used. Nothing was changed.</p>
              <ul>{errors.slice(0, 5).map(error => <li key={error}>{error}</li>)}</ul>
              {errors.length > 5 && <p>And {errors.length - 5} more problems.</p>}
            </div>
          )}
          {pending && (
            <div className="callout" role="alert">
              <p>Replace everything in this space with “{pending.space.name}” from the file? This cannot be undone. Download a backup first if you want a copy.</p>
              {saver.refusal && <p className="field-error">{saver.refusal}</p>}
              <div className="inline-actions">
                <button type="button" className="button-small button-small-primary" aria-disabled={saver.blocked || undefined} onClick={async () => {
                  const outcome = await saver.save(() => onReplace(pending, base))
                  // Not kept: the question stays, with the reason, so nothing looks replaced.
                  if (!isKept(outcome)) return
                  setDone(outcomeText('Your space was replaced with the file.', outcome))
                  setPending(null)
                }}>{saver.sending ? 'Saving…' : 'Replace'}</button>
                <button type="button" className="button-small" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}
          {done && <p className="muted-note" role="status">{done}</p>}
        </>}
      </section>
    </>
  )
}
