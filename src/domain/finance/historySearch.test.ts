import { describe, expect, it } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { activityLog, filterActivity, groupByDay, groupByMonth, matchesSearch, NO_FILTER, newestFirst, typeHasCategory, type ActivityEntry } from './history'

// History's search, filters and groups. Alex's year: 401 records, 392 of them in 2026.
const log = () => activityLog(createAlexDemo())
const year = { kind: 'year', year: 2026 } as const

describe('History search', () => {
  it('finds a name or a note, in any case, without the spaces around it', () => {
    const entries = log()
    const found = filterActivity(entries, { ...NO_FILTER, search: '  CHRISTMAS ' })
    expect(found.length).toBe(7)
    expect(found.every(entry => matchesSearch(entry, 'christmas'))).toBe(true)
    // "Spent on Christmas gifts" is only in the note of a goal movement.
    expect(found.some(entry => !entry.label.toLowerCase().includes('christmas') && entry.note?.toLowerCase().includes('christmas'))).toBe(true)
    expect(filterActivity(entries, { ...NO_FILTER, search: '   ' })).toHaveLength(entries.length)
  })

  it('does not search the app’s own explanations', () => {
    // "Savings total unchanged" is what the app says, not a name or a note.
    expect(filterActivity(log(), { ...NO_FILTER, search: 'savings total unchanged' })).toEqual([])
  })

  it('keeps the user’s note apart from what the app says', () => {
    const movement = log().find(entry => entry.note === 'Spent on Christmas gifts')!
    expect(movement.detail).toBe('Back to unassigned savings · Savings total unchanged')
    expect(movement.effect).toBe('unassigned')
    const transfer = log().find(entry => entry.key === 'transfer:save-2026-01')!
    expect([transfer.label, transfer.detail, transfer.note]).toEqual(['Everyday Account → Savings Account', 'Not income or spending', 'Monthly saving'])
    const salary = log().find(entry => entry.key === 'income:salary-2026-12')!
    expect([salary.label, salary.detail, salary.note]).toEqual(['Salary', 'Into Everyday Account', 'Paid early for the holidays'])
    // Without an income source, the user's words are its name.
    expect(log().find(entry => entry.key === 'income:freelance-2026-12')!.label).toBe('Freelance · Holiday cards')
  })

  it('combines the period, the search and every filter', () => {
    const entries = log()
    const all = filterActivity(entries, { ...NO_FILTER, period: year, search: 'super', type: 'spending', category: 'Groceries', accountId: 'everyday' })
    expect(all.length).toBeGreaterThan(0)
    expect(all.every(e => e.type === 'spending' && e.category === 'Groceries' && e.accountIds.includes('everyday') && e.month.startsWith('2026-') && /super/i.test(e.label))).toBe(true)
    expect(filterActivity(entries, { ...NO_FILTER, type: 'income', category: 'Groceries' })).toEqual([])
    expect([typeHasCategory('income'), typeHasCategory('spending'), typeHasCategory('bill'), typeHasCategory('all')]).toEqual([false, true, true, true])
  })
})

describe('History groups', () => {
  it('groups by the month each record counts for, newest month first, keeping the order inside', () => {
    const entries = filterActivity(log(), { ...NO_FILTER, period: year })
    const groups = groupByMonth(entries)
    expect(groups.map(g => g.month)).toEqual(['2026-12', '2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01'])
    expect(groups.reduce((sum, g) => sum + g.entries.length, 0)).toBe(entries.length)
    expect(groups.flatMap(g => g.entries)).toEqual([...entries].sort((a, b) => b.month.localeCompare(a.month) || entries.indexOf(a) - entries.indexOf(b)))
    for (const group of groups) {
      const days = groupByDay(group.entries)
      expect(days.flatMap(d => d.entries)).toEqual(group.entries)
      expect(new Set(days.map(d => d.date)).size).toBe(days.length)
    }
  })

  it('keeps the same order every time, with or without entry times', () => {
    const first = log().map(e => e.key)
    expect(log().map(e => e.key)).toEqual(first)
    const day = (key: string, sequence: number, recordedAt?: string): ActivityEntry => ({
      key, type: 'spending', date: '2026-12-01', month: '2026-12', amount: -1, label: key, detail: '', category: null, accountIds: [], ref: { kind: 'expense', id: key }, sequence, ...(recordedAt ? { recordedAt } : {}),
    })
    const list = [day('a', 0), day('b', 1), day('c', 2, '2026-12-01T10:00:00Z'), day('d', 3, '2026-12-01T09:00:00Z')]
    expect([...list].sort(newestFirst).map(e => e.key)).toEqual(['c', 'd', 'b', 'a'])
    expect([...list].reverse().sort(newestFirst).map(e => e.key)).toEqual(['c', 'd', 'b', 'a'])
  })
})
