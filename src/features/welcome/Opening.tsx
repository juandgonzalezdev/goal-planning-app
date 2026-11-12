import { useEffect, useState } from 'react'
import { useT } from '../../i18n'

/** After this long, a real wait shows the shape of Home (a skeleton); a quick open shows nothing, so nothing flashes. */
export const SKELETON_AFTER_MS = 400

/**
 * Shown while the own space is being opened, so nothing can start a new
 * space over one still being read. The only skeleton in the app: it is for
 * this real wait (reading the space from the browser), never for a screen
 * that already has its information. It shows no amounts and no shapes of
 * figures, and it doesn't move.
 */
export function Opening({ onRetry }: { onRetry: () => void }) {
  const { t } = useT()
  const [slow, setSlow] = useState(false)
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000)
    const skeleton = setTimeout(() => setWaiting(true), SKELETON_AFTER_MS)
    return () => { clearTimeout(timer); clearTimeout(skeleton) }
  }, [])
  return (
    <div className="screen-column">
      <h1 className="screen-title" role="status">{t('opening.title')}</h1>
      {waiting && !slow && (
        <div className="skeleton" aria-hidden="true">
          <span className="skeleton-bar is-short" />
          <span className="skeleton-card" />
          <span className="skeleton-card" />
          <span className="skeleton-card is-low" />
        </div>
      )}
      {slow && <>
        <p className="screen-lead">{t('opening.slow')}</p>
        <div className="screen-actions">
          <button type="button" className="button-secondary" onClick={onRetry}>{t('notice.tryAgain')}</button>
        </div>
      </>}
    </div>
  )
}
