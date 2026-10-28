import { useRef, useState, type ChangeEvent } from 'react'
import { exportFinanceData, importFinanceData } from '../../data/exchange'
import type { FinanceData } from '../../domain/finance/types'
import { outcomeText, type SaveOutcome } from '../../ui/saveOutcome'

/**
 * Data Backup: download everything as a JSON file; Restore Backup: read it
 * back. This is the copy that can be restored (the PDF report cannot).
 * Restoring never replaces anything until the user confirms.
 */
export function ExchangeSection({ data, isDemo, onReplace }: { data: FinanceData; isDemo: boolean; onReplace: (data: FinanceData) => SaveOutcome }) {
  const [pending, setPending] = useState<FinanceData | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportFinanceData(data)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'goal-planning-backup.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setDone('')
    if (!file) return
    const result = importFinanceData(await file.text())
    if (result.status === 'imported') { setErrors([]); setPending(result.data) }
    else { setPending(null); setErrors(result.errors) }
  }

  return (
    <>
      <section className="sub-block" aria-labelledby="data-backup">
        <h3 id="data-backup" className="section-title">Data Backup</h3>
        <p className="field-help">Download everything in this space as a JSON file, to restore it later. Keep it somewhere safe: it is not encrypted.</p>
        <button type="button" className="button-secondary" onClick={download}>Download Backup</button>
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
              <div className="inline-actions">
                <button type="button" className="button-small button-small-primary" onClick={() => { setDone(outcomeText('Your space was replaced with the file.', onReplace(pending))); setPending(null) }}>Replace</button>
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
