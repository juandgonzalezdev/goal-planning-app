import { Icon, type IconName } from '../components/Icon'

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'idea', title: 'Start with an idea', text: 'Big or small, every goal starts somewhere.' },
  { icon: 'plan', title: 'Make a plan', text: 'Find an approach that fits your life.' },
  { icon: 'lock', title: 'Stay in control', text: 'Your goals and choices are yours.' },
]

type Props = { onGetStarted: () => void; onExplore: () => void }

export function Welcome({ onGetStarted, onExplore }: Props) {
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
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onGetStarted}>Get Started <Icon name="arrowRight" size={18} /></button>
        <button type="button" className="button-quiet" onClick={onExplore}>Explore the App</button>
      </div>
    </div>
  )
}
