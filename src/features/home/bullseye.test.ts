import { describe, expect, it, vi } from 'vitest'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import { billsForMonth, markBillPaid } from '../../domain/finance/bills'
import type { FinanceData } from '../../domain/finance/types'
import { createBillCelebrationChannel } from '../../app/writeStatus'
import { completesBillMonth, pulseAt } from './bullseye'
import { DEFAULT_LAYOUT, keepCelebratedMonths, layoutToSave, normalizeLayout } from './homeLayout'

const MONTH = '2026-12'
const pay = (data: FinanceData, billId: string) => {
  const occurrence = billsForMonth(data, MONTH).find(item => item.bill.id === billId)!
  return markBillPaid(data, billId, MONTH, { amount: occurrence.amount ?? 0, paidOn: '2026-12-31', paidFrom: null, interest: null }, '2026-12-31')
}
const unpaid = (data: FinanceData) => billsForMonth(data, MONTH).filter(item => !item.paid)

describe('Bills completion (Pulse trigger)', () => {
  it('is true only for the payment that pays the month’s last unpaid bill', () => {
    const data = createAlexDemo()
    const open = unpaid(data)
    expect(open.length).toBeGreaterThan(0)
    let current = data
    for (const [index, item] of open.entries()) {
      const next = pay(current, item.bill.id)
      expect(completesBillMonth(current, next, MONTH)).toBe(index === open.length - 1)
      current = next
    }
    // Already complete: nothing new to celebrate, and other months are never affected.
    expect(completesBillMonth(current, current, MONTH)).toBe(false)
    expect(completesBillMonth(data, current, '2027-01')).toBe(false)
  })

  it('is never true for a month without bills', () => {
    const data = { ...createAlexDemo(), bills: [], billMonths: [] }
    expect(completesBillMonth(data, data, MONTH)).toBe(false)
  })
})

describe('Celebration channel', () => {
  it('claims a month once, then reports it as already celebrated; listeners say whether the pulse was shown', () => {
    const channel = createBillCelebrationChannel()
    const claimed = new Set<string>()
    channel.setClaimer(event => !claimed.has(event.month) && !!claimed.add(event.month))
    expect(channel.publish({ month: MONTH, spaceId: 's' })).toEqual({ claimed: true, shown: false })
    expect(channel.publish({ month: MONTH, spaceId: 's' })).toEqual({ claimed: false, shown: false })
    const listener = vi.fn(() => true)
    const stop = channel.subscribe(listener)
    expect(channel.publish({ month: '2027-01', spaceId: 's' })).toEqual({ claimed: true, shown: true })
    // An already celebrated month never reaches Home.
    expect(channel.publish({ month: '2027-01', spaceId: 's' })).toEqual({ claimed: false, shown: false })
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
  })

  it('keeps no event: a listener added later never replays an earlier completion', () => {
    const channel = createBillCelebrationChannel()
    channel.publish({ month: MONTH, spaceId: 's' })
    const listener = vi.fn(() => true)
    channel.subscribe(listener)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('Celebrated months in the Home layout (this device, not data)', () => {
  it('are saved and read back with the layout, keeping only unique YYYY-MM months', () => {
    const layout = { ...DEFAULT_LAYOUT, celebratedBillMonths: [MONTH] }
    expect(normalizeLayout(JSON.parse(JSON.stringify(layoutToSave(layout)))).celebratedBillMonths).toEqual([MONTH])
    expect(normalizeLayout({ version: 2, order: [], open: [], celebratedBillMonths: [MONTH, MONTH, '2026-13', 'x', 7] }).celebratedBillMonths).toEqual([MONTH])
    expect(layoutToSave(DEFAULT_LAYOUT)).not.toHaveProperty('celebratedBillMonths')
  })

  it('only grow: a change made from an older layout (a selection, Reset Layout) never brings a celebration back', () => {
    const current = { ...DEFAULT_LAYOUT, celebratedBillMonths: [MONTH] }
    const fromOlderCopy = { ...DEFAULT_LAYOUT, ringSelection: 'income' as const }
    expect(keepCelebratedMonths(current, fromOlderCopy)).toEqual({ ...fromOlderCopy, celebratedBillMonths: [MONTH] })
    const both = keepCelebratedMonths(current, { ...DEFAULT_LAYOUT, celebratedBillMonths: ['2027-01'] })
    expect(both.celebratedBillMonths).toEqual([MONTH, '2027-01'])
    expect(keepCelebratedMonths(DEFAULT_LAYOUT, fromOlderCopy)).toBe(fromOlderCopy)
  })
})

describe('Pulse timing', () => {
  it('waits for the Bills fill, beats once and ends at rest', () => {
    const start = pulseAt(0)
    expect(start).toMatchObject({ beat: 1, waveOpacity: 0, glowOpacity: 0 })
    expect(start.arcs.every(arc => arc.scale === 1 && arc.brightness === 1)).toBe(true)
    // The beat dips, then overshoots, within the approved range.
    const beats = Array.from({ length: 140 }, (_, i) => pulseAt(i * 20).beat)
    expect(Math.min(...beats)).toBeCloseTo(.91, 2)
    expect(Math.max(...beats)).toBeLessThanOrEqual(1.06 + 1e-9)
    // The wave grows from the centre to radius 222 and fades; arcs stay within +3.5 % and +22 %.
    const fronts = Array.from({ length: 50 }, (_, i) => pulseAt(540 + i * 20).front)
    expect(fronts.every((value, i) => i === 0 || value >= fronts[i - 1])).toBe(true)
    for (let t = 0; t <= 2980; t += 10) {
      const frame = pulseAt(t)
      expect(frame.waveOpacity).toBeLessThanOrEqual(.55); expect(frame.glowOpacity).toBeLessThanOrEqual(1)
      for (const arc of frame.arcs) { expect(arc.scale).toBeLessThanOrEqual(1.035); expect(arc.brightness).toBeLessThanOrEqual(1.22) }
    }
    const end = pulseAt(2980)
    expect(end).toMatchObject({ beat: 1, front: 222, waveOpacity: 0, glowOpacity: 0 })
    expect(end.arcs.every(arc => arc.scale === 1 && arc.brightness === 1)).toBe(true)
  })

  it('pulses the arcs clockwise, Income first, 55 ms apart', () => {
    const peak = (index: number) => {
      let best = 0, at = 0
      for (let t = 0; t <= 2980; t += 5) { const amp = pulseAt(t).arcs[index].scale; if (amp > best) { best = amp; at = t } }
      return at
    }
    const peaks = [0, 1, 2, 3].map(peak)
    expect(peaks).toEqual([...peaks].sort((a, b) => a - b))
    expect(peaks[1] - peaks[0]).toBeGreaterThanOrEqual(50)
  })
})
