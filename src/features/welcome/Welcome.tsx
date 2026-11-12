import { useState } from 'react'
import type { EraseOutcome, SpaceProblem } from '../../app/useSpace'
import { Icon, type IconName } from '../../components/Icon'
import { useT, type MessageKey } from '../../i18n'

const POINTS: { icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { icon: 'idea', title: 'welcome.point1Title', text: 'welcome.point1Text' },
  { icon: 'plan', title: 'welcome.point2Title', text: 'welcome.point2Text' },
  { icon: 'lock', title: 'welcome.point3Title', text: 'welcome.point3Text' },
]

type Props = {
  onCreateAccount: () => void
  onLogIn: () => void
  onExplore: () => void
  /**
   * Why the own space is not open, if something is saved: this browser
   * cannot save, or an erase left a copy behind. (Saved information that
   * cannot be opened has its own screen, Recovery.)
   * Starting a new space is blocked while saved data could be lost or
   * could not be saved.
   */
  problem: SpaceProblem | null
  /** A change is being saved: Erase waits. */
  busy: boolean
  onErase: () => Promise<EraseOutcome>
  onRetry: () => void
  /** The space was just erased in another tab. */
  erasedElsewhere?: boolean
}

const ERASE_TEXT: Partial<Record<EraseOutcome, MessageKey>> = {
  'failed': 'erase.failed',
  'read-only': 'erase.readOnly',
  'busy': 'erase.busy',
}

export function Welcome({ onCreateAccount, onLogIn, onExplore, problem, busy, onErase, onRetry, erasedElsewhere = false }: Props) {
  const { t } = useT()
  const [eraseText, setEraseText] = useState('')
  const erase = async () => {
    setEraseText('')
    const outcome = await onErase()
    setEraseText(ERASE_TEXT[outcome] ? t(ERASE_TEXT[outcome]!) : '')
  }
  // Nothing new can start while saved data could not be opened, or while nothing could be saved.
  const blocked = problem?.kind === 'unreadable' || problem?.kind === 'read-only' || problem?.kind === 'conflict'
  return (
    <div className="screen-column welcome">
      <div className="welcome-hero">
        <span className="welcome-mark"><Icon name="target" size={34} /></span>
        <h1 className="screen-title">{t('welcome.title')}</h1>
        <p className="screen-lead">{t('welcome.lead')}</p>
      </div>
      <ul className="welcome-points">
        {POINTS.map(point => (
          <li key={point.title}>
            <Icon name={point.icon} />
            <div><strong>{t(point.title)}</strong><span>{t(point.text)}</span></div>
          </li>
        ))}
      </ul>
      {erasedElsewhere && (
        <div className="callout" role="status">
          <p>{t('welcome.erasedElsewhere')}</p>
        </div>
      )}
      {problem?.kind === 'read-only' && (problem.takenOver ? (
        <div className="callout callout-warning" role="alert">
          <p>{t('welcome.takenOver')}</p>
        </div>
      ) : (
        <div className="callout callout-warning" role="alert">
          <p>{t('welcome.cannotSave')}</p>
          <button type="button" className="button-secondary" onClick={onRetry}>{t('notice.tryAgain')}</button>
        </div>
      ))}
      {problem?.kind === 'conflict' && (
        <div className="callout callout-warning" role="alert">
          <p>{t('welcome.conflict')}</p>
          <button type="button" className="button-secondary" onClick={onRetry}>{t('welcome.openIt')}</button>
        </div>
      )}
      {problem?.kind === 'partly-erased' && (
        <div className="callout callout-warning" role="alert">
          <p>{t('welcome.partlyErased')}</p>
          <p>{t('welcome.partlyErasedHelp')}</p>
          <button type="button" className="button-secondary" aria-disabled={busy || undefined} onClick={() => void erase()}>{t('notice.tryAgain')}</button>
        </div>
      )}
      {eraseText && <p className="field-error" role="alert">{eraseText}</p>}
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onCreateAccount} disabled={blocked}>{t('welcome.createAccount')} <Icon name="arrowRight" size={18} /></button>
        <button type="button" className="button-secondary" onClick={onLogIn} disabled={blocked}>{t('welcome.logIn')}</button>
        <button type="button" className="button-quiet" onClick={onExplore}>{t('welcome.explore')}</button>
      </div>
    </div>
  )
}
