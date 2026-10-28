import { useState } from 'react'
import type { EraseOutcome, SpaceProblem } from '../../app/useSpace'
import { Icon, type IconName } from '../../components/Icon'

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'idea', title: 'Start with an idea', text: 'Big or small, every goal starts somewhere.' },
  { icon: 'plan', title: 'Make a plan', text: 'Find an approach that fits your life.' },
  { icon: 'lock', title: 'Stay in control', text: 'Your goals and choices are yours.' },
]

type Props = {
  onCreateAccount: () => void
  onLogIn: () => void
  onExplore: () => void
  /**
   * Why the own space is not open, if something is saved: it could not be
   * opened, this browser cannot save, or an erase left a copy behind.
   * Starting a new space is blocked while saved data could be lost or
   * could not be saved.
   */
  problem: SpaceProblem | null
  /** A change is being saved: Erase waits. */
  busy: boolean
  onErase: () => Promise<EraseOutcome>
  onRetry: () => void
}

const ERASE_TEXT: Partial<Record<EraseOutcome, string>> = {
  'failed': 'This browser did not allow erasing. Nothing was changed.',
  'read-only': 'This browser cannot erase it right now. Nothing was changed.',
  'busy': 'Still saving. Try again in a moment.',
}

export function Welcome({ onCreateAccount, onLogIn, onExplore, problem, busy, onErase, onRetry }: Props) {
  const [eraseText, setEraseText] = useState('')
  const erase = async () => {
    setEraseText('')
    const outcome = await onErase()
    setEraseText(ERASE_TEXT[outcome] ?? '')
  }
  // Nothing new can start while saved data could not be opened, or while nothing could be saved.
  const blocked = problem?.kind === 'unreadable' || problem?.kind === 'read-only' || problem?.kind === 'conflict'
  return (
    <div className="screen-column welcome">
      <div className="welcome-hero">
        <span className="welcome-mark"><Icon name="target" size={34} /></span>
        <h1 className="screen-title">Your goals, your way.</h1>
        <p className="screen-lead">Make plans for what matters to you, one step at a time.</p>
      </div>
      <ul className="welcome-points">
        {POINTS.map(point => (
          <li key={point.title}>
            <Icon name={point.icon} />
            <div><strong>{point.title}</strong><span>{point.text}</span></div>
          </li>
        ))}
      </ul>
      {problem?.kind === 'unreadable' && (
        <div className="callout callout-warning" role="alert">
          {problem.reason === 'newer-version' ? <>
            <p>Your space was saved by a newer version of the app, so this version cannot open it. It has not been changed.</p>
            <p>Reload the page, or open the app where you used it last.</p>
            <button type="button" className="button-secondary" onClick={onRetry}>Try Again</button>
          </> : <>
            <p>Saved information on this device could not be opened. It has not been changed.</p>
            <p>To start a new space here, erase it first.</p>
            <div className="inline-actions">
              <button type="button" className="button-secondary" onClick={onRetry}>Try Again</button>
              <button type="button" className="button-secondary" aria-disabled={busy || undefined} onClick={() => void erase()}>Erase Saved Information</button>
            </div>
          </>}
        </div>
      )}
      {problem?.kind === 'read-only' && (problem.takenOver ? (
        <div className="callout callout-warning" role="alert">
          <p>A newer version of the app was opened in another tab. Reload this page to keep using your space here. You can still explore the demo.</p>
        </div>
      ) : (
        <div className="callout callout-warning" role="alert">
          <p>This browser cannot save safely here, so a new space cannot be started. You can still explore the demo.</p>
          <button type="button" className="button-secondary" onClick={onRetry}>Try Again</button>
        </div>
      ))}
      {problem?.kind === 'conflict' && (
        <div className="callout callout-warning" role="alert">
          <p>A space was started on this device in another tab.</p>
          <button type="button" className="button-secondary" onClick={onRetry}>Open It</button>
        </div>
      )}
      {problem?.kind === 'partly-erased' && (
        <div className="callout callout-warning" role="alert">
          <p>Erase is not finished. Your space was removed from the app, but this browser kept an older copy of it. It will not be opened again.</p>
          <p>To remove it, try again, or clear this site's data in your browser settings.</p>
          <button type="button" className="button-secondary" aria-disabled={busy || undefined} onClick={() => void erase()}>Try Again</button>
        </div>
      )}
      {eraseText && <p className="field-error" role="alert">{eraseText}</p>}
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onCreateAccount} disabled={blocked}>Create Account <Icon name="arrowRight" size={18} /></button>
        <button type="button" className="button-secondary" onClick={onLogIn} disabled={blocked}>Log In</button>
        <button type="button" className="button-quiet" onClick={onExplore}>Explore the App</button>
      </div>
    </div>
  )
}
