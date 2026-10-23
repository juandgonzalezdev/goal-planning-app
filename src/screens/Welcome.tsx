import { Icon, type IconName } from '../components/Icon'

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'idea', title: 'Start with an idea', text: 'Big or small, every goal starts somewhere.' },
  { icon: 'plan', title: 'Make a plan', text: 'Find an approach that fits your life.' },
  { icon: 'lock', title: 'Stay in control', text: 'Your goals and choices are yours.' },
]

type Props = {
  onCreateAccount: () => void
  onLogIn: () => void
  onExplore: () => void
  /** Saved data exists that could not be opened. Creating a new space is blocked until it is erased. */
  unreadable: boolean
  onEraseUnreadable: () => void
}

export function Welcome({ onCreateAccount, onLogIn, onExplore, unreadable, onEraseUnreadable }: Props) {
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
      {unreadable && (
        <div className="callout callout-warning" role="alert">
          <p>Saved information on this device could not be opened. It has not been changed.</p>
          <p>To start a new space here, erase it first.</p>
          <button type="button" className="button-secondary" onClick={onEraseUnreadable}>Erase Saved Information</button>
        </div>
      )}
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onCreateAccount} disabled={unreadable}>Create Account <Icon name="arrowRight" size={18} /></button>
        <button type="button" className="button-secondary" onClick={onLogIn} disabled={unreadable}>Log In</button>
        <button type="button" className="button-quiet" onClick={onExplore}>Explore the App</button>
      </div>
    </div>
  )
}
