import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { activityLog, filterActivity, groupByMonth, NO_FILTER, type HistoryFilter } from '../../domain/finance/history'
import { firstFilter, INITIAL_HISTORY_VIEW, isNarrowed, MONTH_PAGE, openMonthsOf, secondaryFilters, setAllMonths, showMore, shownIn, tagOf, toggleMonth, withFilter } from './historyView'

const groupsFor = (filter: HistoryFilter) => groupByMonth(filterActivity(activityLog(createAlexDemo()), filter))

describe('History view', () => {
  it('starts on the year of the month shown, with Year Overview and More Filters closed', () => {
    expect(firstFilter('2026-12')).toEqual({ ...NO_FILTER, period: { kind: 'year', year: 2026 } })
    expect(INITIAL_HISTORY_VIEW).toMatchObject({ filter: null, overviewOpen: false, moreFilters: false, openMonths: null, shown: {} })
  })

  it('opens a one-month period, else only the newest month with results', () => {
    const year = firstFilter('2026-12')
    expect(openMonthsOf(INITIAL_HISTORY_VIEW, year, groupsFor(year))).toEqual(['2026-12'])
    const july = { ...NO_FILTER, period: { kind: 'month', month: '2026-07' } } as const
    expect(openMonthsOf(INITIAL_HISTORY_VIEW, july, groupsFor(july))).toEqual(['2026-07'])
    const onlyMay = { ...year, search: 'tax refund' }
    expect(openMonthsOf(INITIAL_HISTORY_VIEW, { ...year, type: 'income', search: '' }, groupsFor({ ...year, type: 'income' }))).toEqual(['2026-12'])
    expect(openMonthsOf(INITIAL_HISTORY_VIEW, onlyMay, groupsFor(onlyMay))).toEqual(['2026-05'])
  })

  it('opens every month with results after a search, and the first rule again once cleared', () => {
    const search = { ...firstFilter('2026-12'), search: 'christmas' }
    const searched = withFilter({ ...INITIAL_HISTORY_VIEW, shown: { '2026-12': 40 } }, search, groupsFor(search))
    expect(searched.openMonths).toEqual(['2026-12', '2026-11', '2026-10'])
    expect(searched.shown).toEqual({})
    const cleared = withFilter(searched, firstFilter('2026-12'), groupsFor(firstFilter('2026-12')))
    expect(cleared.openMonths).toBeNull()
  })

  it('then keeps what was opened or closed by hand', () => {
    const filter = firstFilter('2026-12')
    const groups = groupsFor(filter)
    const view = toggleMonth(INITIAL_HISTORY_VIEW, openMonthsOf(INITIAL_HISTORY_VIEW, filter, groups), '2026-12')
    expect(openMonthsOf(view, filter, groups)).toEqual([])
    const both = toggleMonth(view, [], '2026-03')
    expect(openMonthsOf(both, filter, groups)).toEqual(['2026-03'])
  })

  it('opens or closes every month with Expand All and Collapse All, and nothing else', () => {
    const filter = firstFilter('2026-12')
    const groups = groupsFor(filter)
    const view = { ...INITIAL_HISTORY_VIEW, overviewOpen: true, moreFilters: true }
    const all = setAllMonths(view, groups, true)
    expect(all.openMonths).toHaveLength(12)
    expect(all).toMatchObject({ overviewOpen: true, moreFilters: true })
    expect(setAllMonths(all, groups, false)).toMatchObject({ openMonths: [], overviewOpen: true, moreFilters: true })
  })

  it('shows a month a page at a time', () => {
    expect(shownIn(INITIAL_HISTORY_VIEW, '2026-12')).toBe(MONTH_PAGE)
    const more = showMore(showMore(INITIAL_HISTORY_VIEW, '2026-12'), '2026-12')
    expect(shownIn(more, '2026-12')).toBe(MONTH_PAGE * 3)
    expect(shownIn(more, '2026-11')).toBe(MONTH_PAGE)
  })

  it('counts the filters inside More Filters only', () => {
    const filter = { ...NO_FILTER, search: 'gift', type: 'spending', accountId: 'everyday' } as HistoryFilter
    expect(secondaryFilters(filter)).toEqual(['type', 'accountId'])
    expect(isNarrowed(filter)).toBe(true)
    expect(isNarrowed({ ...NO_FILTER, search: '   ', period: { kind: 'year', year: 2026 } })).toBe(false)
  })

  it('names every kind of record apart', () => {
    const log = activityLog(createAlexDemo())
    const tags = new Set(log.map(tagOf))
    for (const tag of ['Income received', 'Bill payment', 'Spending', 'Transfer', 'Assigned to a goal', 'Released from a goal', 'Balance update']) expect(tags).toContain(tag)
  })
})
