import { useEffect, useState } from 'react'

/** Shown while the own space is being opened, so nothing can start a new space over one still being read. */
export function Opening({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="screen-column">
      <h1 className="screen-title" role="status">Opening your space…</h1>
      {slow && <>
        <p className="screen-lead">This is taking longer than usual.</p>
        <div className="screen-actions">
          <button type="button" className="button-secondary" onClick={onRetry}>Try Again</button>
        </div>
      </>}
    </div>
  )
}
