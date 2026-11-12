import { useState } from 'react'
import { guideKept, type GuideOutcome } from '../../app/useSpace'
import { progressNotSaved } from '../guide/guideText'
import { Icon } from '../../components/Icon'
import { GUIDE, GUIDE_CHAPTERS, type GuideChapter } from './guideContent'

type Props = {
  isDemo: boolean
  /** The chapter to open, from a "?" note's "Read more in the guide". */
  chapter: GuideChapter | null
  /** Whether Getting Started shows on Home now. */
  guideOnHome: boolean
  /** Shows Getting Started on Home again; the answer says whether that was saved (GS-6A.1). */
  onShowGuide: () => Promise<GuideOutcome>
  /** Opens the Getting Started screens (GS-3), on the stage to do now. */
  onOpenSetup: () => void
  /** Getting Started was finished (GS-6B): this section offers Review Setup, and nothing starts the guide again (D-GS6-24). */
  guideFinished?: boolean
  /** Review Setup: the summary of the five stages, opened from here (D-GS6-12); Close comes back here (D-GS6-16). */
  onReviewSetup?: () => void
  onBack: () => void
}

/**
 * Help & Guide (Settings › Help & Guide; on wide screens also Help in the
 * sidebar): the guide in short chapters that open and close, Getting
 * Started (shown on Home again from here) and the Monthly Check-in. A
 * chapter asked for opens, and the app puts the keyboard on its title.
 */
export function HelpScreen({ isDemo, chapter, guideOnHome, onShowGuide, onOpenSetup, guideFinished = false, onReviewSetup, onBack }: Props) {
  const [open, setOpen] = useState<ReadonlySet<GuideChapter>>(() => new Set(chapter ? [chapter] : []))
  const [shown, setShown] = useState(false)
  const [notSaved, setNotSaved] = useState('')
  const toggle = (id: GuideChapter) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }
  return (
    <div className="tab-screen help-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="arrowLeft" size={18} /> Back</button>
      <h1 className="tab-title">Help &amp; Guide</h1>
      <p className="muted-note">What the app does and how to use it. {isDemo ? 'In the demo, Alex’s information is invented.' : 'Everything here also works in the demo.'}</p>

      <section className="block" aria-labelledby="help-getting-started">
        <h2 id="help-getting-started" className="section-title">Getting Started</h2>
        {guideFinished && onReviewSetup ? <>
          <p className="field-help">You finished Getting Started. Review Setup shows where each stage stands, and you can open any stage to check it or make changes.</p>
          <button type="button" className="button-secondary align-start" onClick={onReviewSetup}>Review Setup</button>
        </> : <>
        <p className="field-help">A guided setup in six stages: Accounts, Income, Debts, Bills, Goals and Finish. You can skip a stage, go back to any stage you reached, and come back later. Nothing you added is lost.</p>
        <button type="button" className="button-secondary align-start" onClick={onOpenSetup}>Open Getting Started</button>
        {guideOnHome
          ? <p className="field-help">{shown ? 'Getting Started is on Home again.' : 'Getting Started is on Home, at the top.'}</p>
          : <button type="button" className="button-secondary align-start" onClick={() => void onShowGuide().then(outcome => {
            if (guideKept(outcome)) { setShown(true); setNotSaved('') } else setNotSaved(outcome === 'stale' ? '' : progressNotSaved(outcome))
          })}>Show Getting Started on Home</button>}
        </>}
        {notSaved && <p className="field-error" role="alert">{notSaved}</p>}
      </section>

      <section className="block help-chapters" aria-label="Guide">
        {GUIDE_CHAPTERS.map(id => {
          const isOpen = open.has(id)
          const text = GUIDE[id]
          return (
            <div key={id} className={`help-chapter${isOpen ? ' is-open' : ''}`}>
              <h2 className="help-chapter-title">
                <button type="button" className="block-toggle" aria-expanded={isOpen} aria-controls={`help-${id}`} id={`help-toggle-${id}`} onClick={() => toggle(id)}>
                  <span className="block-chevron"><Icon name="chevronDown" size={18} /></span>
                  <span className="block-name">{text.title}</span>
                </button>
              </h2>
              <div id={`help-${id}`} hidden={!isOpen}>
                {isOpen && blocks(text.body).map(block => typeof block === 'string'
                  ? <p key={block}>{block}</p>
                  : <ul key={block[0]}>{block.map(line => <li key={line}>{line}</li>)}</ul>)}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

/** Paragraphs as they are, and lines that start with "• " grouped into lists, in their order. */
function blocks(body: readonly string[]): (string | string[])[] {
  const out: (string | string[])[] = []
  for (const line of body) {
    if (!line.startsWith('• ')) { out.push(line); continue }
    const last = out[out.length - 1]
    if (Array.isArray(last)) last.push(line.slice(2))
    else out.push([line.slice(2)])
  }
  return out
}
