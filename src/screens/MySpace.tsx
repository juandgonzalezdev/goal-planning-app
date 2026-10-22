import { Icon, type IconName } from '../components/Icon'
import { evaluateConfirmedGoal, type ConfirmedGoal } from '../domain/goal'
import type { CalendarDate } from '../domain/goalTime'
import { progressPercent } from '../ui/planStatus'

type Props = {
  confirmedGoal: ConfirmedGoal | null
  today: CalendarDate
  onOpenGoals: () => void
  onOpenMoney: () => void
}

function SectionCard({ icon, title, text, onOpen, badge }: { icon: IconName; title: string; text: string; onOpen?: () => void; badge?: string }) {
  const body = <>
    <Icon name={icon} />
    <span className="section-card-title">{title}{badge && <span className="badge">{badge}</span>}</span>
    <span className="section-card-text">{text}</span>
  </>
  // A card without an action is plain content, so it is never focusable or announced as a button.
  return onOpen
    ? <button type="button" className="section-card" onClick={onOpen}>{body}</button>
    : <div className="section-card is-unavailable">{body}</div>
}

export function MySpace({ confirmedGoal, today, onOpenGoals, onOpenMoney }: Props) {
  const progress = confirmedGoal
    ? progressPercent(confirmedGoal.input.targetAmount, evaluateConfirmedGoal(confirmedGoal, today).remainingAmount)
    : 0

  return (
    <div className="screen-wide">
      <div className="space-head">
        <div>
          <h1 className="screen-title">My Space</h1>
          <p className="screen-lead">Your plans start here.</p>
        </div>
        <span className="space-label"><Icon name="person" size={16} /> Personal space</span>
      </div>

      {confirmedGoal ? (
        <section className="space-goal" aria-labelledby="space-goal-name">
          <span className="eyebrow-label">Your goal</span>
          <h2 id="space-goal-name">{confirmedGoal.details.name}</h2>
          <div className="space-progress-head"><span>Progress</span><span>{progress.toFixed(1)}%</span></div>
          <div className="space-progress" role="progressbar" aria-label={`${confirmedGoal.details.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div style={{ width: `${progress}%` }} /></div>
          <button type="button" className="button-secondary" onClick={onOpenGoals}>View goal <Icon name="arrowRight" size={18} /></button>
        </section>
      ) : (
        <section className="space-empty" aria-labelledby="space-empty-title">
          <Icon name="flag" size={28} />
          <h2 id="space-empty-title">No goals yet</h2>
          <p>What would you like to work towards?</p>
          <button type="button" className="button-primary" onClick={onOpenGoals}><Icon name="plus" size={18} /> Create a Goal</button>
        </section>
      )}

      <div className="section-grid">
        <SectionCard icon="target" title="My Goals" text={confirmedGoal ? 'See or edit your goal' : 'Start a new plan'} onOpen={onOpenGoals} />
        <SectionCard icon="wallet" title="My Money" text="Loans, cards and what you have each month" onOpen={onOpenMoney} />
        <SectionCard icon="assistant" title="Assistant" text="Will explain your numbers in simple words. You always decide." badge="Coming soon" />
      </div>
    </div>
  )
}
