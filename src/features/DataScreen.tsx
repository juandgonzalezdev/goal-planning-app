import { useRef, useState, type ChangeEvent } from 'react'
import { exportFinanceData, importFinanceData } from '../data/exchange'
import type { FinanceData } from '../domain/finance/types'

type Props = { data: FinanceData; isDemo: boolean; onReplace: (data: FinanceData) => void }

/**
 * Manage Your Data, for now: export and import a data file. Editing every
 * record arrives in a later version. Importing never replaces anything
 * until the user confirms.
 */
export function DataScreen({ data, isDemo, onReplace }: Props) {
  const [pending, setPending] = useState<FinanceData | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportFinanceData(data)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'goal-planning-data.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setDone(false)
    if (!file) return
    const result = importFinanceData(await file.text())
    if (result.status === 'imported') { setErrors([]); setPending(result.data) }
    else { setPending(null); setErrors(result.errors) }
  }

  return (
    <div className="tab-screen">
      <h1 className="tab-title">Manage Your Data</h1>
      <p className="muted-note">Editing income, bills, cards, money and goals here comes in a later version.</p>

      <section className="block">
        <h2 className="section-title">Export</h2>
        <p className="field-help">Download everything in this space as a JSON file.</p>
        <button type="button" className="button-secondary" onClick={download}>Export JSON</button>
      </section>

      <section className="block">
        <h2 className="section-title">Import</h2>
        {isDemo ? (
          <p className="field-help">Exit the demo to import your own data. Demo information and your own space are never mixed.</p>
        ) : <>
          <p className="field-help">Replace this space with a JSON file. The file is checked first, and nothing changes until you confirm.</p>
          <label className="form-field">Choose a JSON file
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
              <p>Replace everything in this space with “{pending.space.name}” from the file? This cannot be undone. Export first if you want a copy.</p>
              <div className="inline-actions">
                <button type="button" className="button-small button-small-primary" onClick={() => { onReplace(pending); setPending(null); setDone(true) }}>Replace</button>
                <button type="button" className="button-small" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}
          {done && <p className="muted-note" role="status">Your space was replaced with the file.</p>}
        </>}
      </section>
    </div>
  )
}
