import { useEffect, useRef, useState } from 'react'
import { useNavigation, type Screen } from './app/navigation'
import { Icon } from './components/Icon'
import type { ConfirmedGoal } from './domain/goal'
import type { CalendarDate } from './domain/goalTime'
import { GoalPlanner } from './GoalPlanner'
import { MyMoney } from './MyMoney'
import { ChooseSpace, type Space } from './screens/ChooseSpace'
import { MySpace } from './screens/MySpace'
import { Welcome } from './screens/Welcome'
import { todayString } from './ui/planFields'
import './styles/tokens.css'
import './styles/app.css'

/**
 * The app shell: header, the current screen and the moves between screens.
 *
 * My Goals and My Money stay on the page once the app starts and are only
 * hidden while another screen shows. Hidden content is not displayed, cannot
 * be reached with the keyboard and is skipped by screen readers, and
 * everything typed in it is still there when the user comes back.
 */
function App({ getToday = todayString }: { getToday?: () => CalendarDate }) {
  const { screen, direction, go, back } = useNavigation()
  const [space] = useState<Space>('personal')
  // A copy for My Space to show. The goal itself is owned by GoalPlanner.
  const [confirmedGoal, setConfirmedGoal] = useState<ConfirmedGoal | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstScreen = useRef(true)

  // After each move, focus goes to the new screen's title so keyboard and
  // screen reader users know where they are.
  useEffect(() => {
    if (firstScreen.current) { firstScreen.current = false; return }
    const heading = mainRef.current?.querySelector<HTMLElement>('[data-screen]:not([hidden]) :is(h1, h2)')
    if (!heading) return
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus()
  }, [screen])

  const shows = (name: Screen) => screen === name

  return (
    <div className="shell" data-direction={direction}>
      <header className="shell-header">
        <div className="shell-brand">
          <span className="shell-brand-mark"><Icon name="target" size={20} /></span>
          <span className="shell-brand-name">Goal Planning<small>Prototype 0.1</small></span>
        </div>
      </header>
      <main className="shell-main" ref={mainRef}>
        {shows('welcome') && <div className="screen" data-screen="welcome"><Welcome onGetStarted={() => go('choose-space')} onExplore={() => go('home')} /></div>}
        {shows('choose-space') && <div className="screen" data-screen="choose-space"><ChooseSpace space={space} onBack={back} onContinue={() => go('home')} /></div>}
        {shows('home') && <div className="screen" data-screen="home"><MySpace confirmedGoal={confirmedGoal} today={getToday()} onOpenGoals={() => go('goals')} onOpenMoney={() => go('money')} /></div>}
        <div className="screen screen-section" data-screen="goals" hidden={!shows('goals')}>
          <button type="button" className="back-link" onClick={back}><Icon name="arrowLeft" size={18} /> My Space</button>
          <GoalPlanner getToday={getToday} onConfirmedGoalChange={setConfirmedGoal} />
        </div>
        <div className="screen screen-section" data-screen="money" hidden={!shows('money')}>
          <MyMoney onBack={back} />
        </div>
      </main>
      <footer className="shell-footer">Preview only · No account needed · Nothing saved after you close or refresh the page</footer>
    </div>
  )
}

export default App
