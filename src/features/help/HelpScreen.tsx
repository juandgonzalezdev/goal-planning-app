import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { GUIDE, GUIDE_CHAPTERS, type GuideChapter } from './guideContent'

type Props = {
  isDemo: boolean
  /** The chapter to open, from a "?" note's "Read more in the guide". */
  chapter: GuideChapter | null
  /** Whether Getting Started shows on Home now. */
  guideOnHome: boolean
  onShowGuide: () => void
  onBack: () => void
}

/**
 * Help & Guide (Settings › Help & Guide; on wide screens also Help in the
 * sidebar): the guide in short chapters that open and close, Getting
 * Started (shown on Home again from here) and the Monthly Check-in. A
 * chapter asked for opens, and the app puts the keyboard on its title.
 */
export function HelpScreen({ isDemo, chapter, guideOnHome, onShowGuide, onBack }: Props) {
  const [open, setOpen] = useState<ReadonlySet<GuideChapter>>(() => new Set(chapter ? [chapter] : []))
  const [shown, setShown] = useState(false)
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
        {guideOnHome
          ? <p className="field-help">{shown ? 'Getting Started is on Home again.' : 'Getting Started is on Home, at the top.'}</p>
          : <>
            <p className="field-help">A short guide on Home, one step at a time: Income, Accounts, Cards and Loans, Bills, Goals (optional), then day to day. Skipped steps come back.</p>
            <button type="button" className="button-secondary align-start" onClick={() => { onShowGuide(); setShown(true) }}>Show Getting Started on Home</button>
          </>}
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
