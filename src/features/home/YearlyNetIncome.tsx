import { useId, useState } from 'react'
import { yearlyIncome } from '../../domain/finance/income'
import type { FinanceData, Id } from '../../domain/finance/types'
import { barPercent, sharePercents } from '../../ui/chart'
import { formatAmount, formatYearMonth } from '../../ui/format'

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HOUSEHOLD = 'household'

/**
 * Yearly Net Income, last on Home. It starts closed with the household
 * total. Details shows each person and one bar per month; with Household
 * chosen, each bar is split by person in their colours (blue and green).
 */
export function YearlyNetIncome({ data, year }: { data: FinanceData; year: number }) {
  const [open, setOpen] = useState(false)
  const [who, setWho] = useState<Id>(HOUSEHOLD)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const detailsId = useId()
  const income = yearlyIncome(data, year)
  const money = (minor: number) => formatAmount(minor, data.space.currency)
  const members = data.space.members
  const several = members.length > 1
  const person = members.find(member => member.id === who)
  const householdName = several ? 'Household' : members[0]?.name ?? 'Household'
  const total = person ? income.byMember[person.id] ?? 0 : income.household
  const longest = Math.max(0, ...income.months.map(month => month.household))
  const Row = several ? 'button' : 'div'

  const toggle = () => {
    if (open) { setWho(HOUSEHOLD); setOpenMonth(null) }
    setOpen(!open)
  }

  return (
    <section className="block home-section" aria-labelledby="home-income">
      <div className="section-head">
        <div>
          <h2 id="home-income" className="section-title">Yearly Net Income</h2>
          <small className="section-sub">{year} · Actual income received</small>
        </div>
        <button type="button" className="button-small" aria-expanded={open} aria-controls={detailsId} onClick={toggle}>
          {open ? 'Less ▲' : 'Details ▼'}
        </button>
      </div>
      <div className="year-head">
        <div>
          <b className="year-total">{money(total)}</b>
          <small>{person && several ? person.name : householdName} · Net received</small>
        </div>
        <div className="year-side">
          <div className="twelve" aria-hidden="true">
            {income.months.map(month => <div key={month.month} className={month.recorded ? 'is-recorded' : ''} />)}
          </div>
          <small>{income.recordedMonthCount} / 12 months</small>
        </div>
      </div>
      {open && (
        <div id={detailsId} className="year-details">
          {several && (
            <div className="annual-owners" role="group" aria-label="Show income for">
              {[...members.map(member => ({ id: member.id, name: member.name, color: member.color, amount: income.byMember[member.id] ?? 0 })),
                { id: HOUSEHOLD, name: 'Household', color: 'var(--color-shared)', amount: income.household }].map(option => (
                <button key={option.id} type="button" aria-pressed={who === option.id} className={who === option.id ? 'is-active' : ''} onClick={() => setWho(option.id)}>
                  <span><i className="owner-dot" style={{ background: option.color }} aria-hidden="true" />{option.name}</span>
                  <b>{money(option.amount)}</b>
                </button>
              ))}
            </div>
          )}
          <ul className="month-bars">
            {income.months.map((month, index) => {
              const value = person ? month.byMember[person.id] ?? 0 : month.household
              const shares = sharePercents(members.map(member => month.byMember[member.id] ?? 0))
              const expanded = openMonth === month.month
              return (
                <li key={month.month}>
                  {/* With one person there is nothing more to show, so the row is not a button. */}
                  <Row {...(several ? {
                    type: 'button' as const, 'aria-expanded': expanded, onClick: () => setOpenMonth(expanded ? null : month.month),
                    'aria-label': `${formatYearMonth(month.month)}, ${month.recorded ? money(value) : 'nothing recorded'}`,
                  } : {})} className="monthly-row">
                    <span>{SHORT_MONTHS[index]}</span>
                    <span className="bar" aria-hidden="true">
                      <span className="stack" style={{ width: `${barPercent(value, longest)}%` }}>
                        {person
                          ? <span style={{ background: person.color, flex: 1 }} />
                          : members.map((member, i) => <span key={member.id} style={{ background: member.color, width: `${shares[i]}%` }} />)}
                      </span>
                    </span>
                    <small>{month.recorded ? money(value) : '—'}</small>
                  </Row>
                  {expanded && (
                    <p className="month-split">
                      {members.map(member => (
                        <span key={member.id}>{member.name}: {month.recorded ? money(month.byMember[member.id] ?? 0) : '—'}</span>
                      ))}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
