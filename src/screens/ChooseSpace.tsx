import { Icon, type IconName } from '../components/Icon'

/** Only Personal works in this prototype. Duo and Group are shown so people can see what is planned. */
export type Space = 'personal'

const OPTIONS: { id: string; icon: IconName; name: string; text: string; privacy: string; available: boolean }[] = [
  { id: 'personal', icon: 'person', name: 'Personal', text: 'Make plans just for yourself.', privacy: 'Only you see your plans.', available: true },
  { id: 'duo', icon: 'duo', name: 'Duo', text: 'Work towards goals with one other person.', privacy: 'You would choose what to share with them.', available: false },
  { id: 'group', icon: 'group', name: 'Group', text: 'Plan together with a group.', privacy: 'Each person would choose what to share.', available: false },
]

type Props = { space: Space; onBack: () => void; onContinue: () => void }

export function ChooseSpace({ space, onBack, onContinue }: Props) {
  return (
    <div className="screen-column">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <h1 className="screen-title">How would you like to plan?</h1>
      <p className="screen-lead">Choose who will be part of your plans. You can change this later.</p>
      <fieldset className="choice-list">
        <legend className="visually-hidden">Planning space</legend>
        {OPTIONS.map(option => (
          <label key={option.id} className={`choice-card${option.available ? '' : ' is-unavailable'}`}>
            <input type="radio" name="space" value={option.id} checked={option.id === space} disabled={!option.available} readOnly aria-describedby={`space-${option.id}-text`} />
            <Icon name={option.icon} size={22} />
            <span className="choice-body">
              <span className="choice-name">{option.name}{!option.available && <span className="badge">Coming soon</span>}</span>
              <span id={`space-${option.id}-text`} className="choice-text">{option.text} {option.privacy}</span>
            </span>
            <span className="choice-check" aria-hidden="true">{option.id === space && <Icon name="check" size={16} />}</span>
          </label>
        ))}
      </fieldset>
      <p className="screen-note">Nothing is shared. Personal plans stay private, and Duo and Group are not available yet.</p>
      <div className="screen-actions">
        <button type="button" className="button-primary" onClick={onContinue}>Continue <Icon name="arrowRight" size={18} /></button>
      </div>
    </div>
  )
}
