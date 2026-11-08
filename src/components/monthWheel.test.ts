import { describe, expect, it } from 'vitest'
import { MonthWheelMotion, monthIndex, indexMonth, wheelSlot, WHEEL_MIN, WHEEL_MAX, type WheelClock } from './monthWheel'

class Clock implements WheelClock {
  time = 0
  sequence = 0
  tasks = new Map<number, { at: number; callback: () => void }>()
  now = () => this.time
  delay = (callback: () => void, ms: number) => { const id = ++this.sequence; this.tasks.set(id, { at: this.time + ms, callback }); return id }
  clear = (id: number) => { this.tasks.delete(id) }
  frame = (callback: (time: number) => void) => this.delay(() => callback(this.time), 16)
  cancel = this.clear
  advance(ms: number) {
    const end = this.time + ms
    for (let count = 0; count < 10000; count++) {
      const next = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > end) break
      this.time = next[1].at; this.tasks.delete(next[0]); next[1].callback()
    }
    this.time = end
  }
}
function setup(reduced = false, initial = '2026-12') {
  const clock = new Clock(), selected: number[] = [], frames: number[] = []
  const base = monthIndex(initial)
  const wheel = new MonthWheelMotion(base, reduced, () => 300, p => frames.push(p), n => selected.push(n), clock)
  return { clock, selected, frames, wheel, base }
}
function flick(w: MonthWheelMotion) { w.down(240, 0, 0, 0); w.move(220, 0, 10); w.move(80, 0, 40); w.up(40) }

describe('approved v2 motion with deterministic time', () => {
  it('tracks a slow multi-month drag without selecting until snap has finished', () => {
    const { wheel, base, selected, clock, frames } = setup()
    wheel.down(250, 0, 0, 0); wheel.move(230, 0, 100); wheel.move(40, 0, 600)
    expect(wheel.position).toBeCloseTo(base + 190 / 102)
    expect(selected).toEqual([])
    wheel.up(800); clock.advance(16)
    expect(wheel.position).toBeGreaterThan(frames[0])
    expect(selected).toEqual([])
    clock.advance(3000)
    expect(selected).toEqual([base + 2]); expect(wheel.position).toBe(base + 2)
    expect(clock.tasks.size).toBe(0)
  })
  it('flicks across months with a 12-month projection cap, slows down and snaps once', () => {
    const { wheel, base, selected, clock } = setup()
    flick(wheel)
    const released = wheel.position
    expect(wheel.target).toBeGreaterThan(base + 3)
    expect(wheel.target).toBeLessThanOrEqual(Math.round(released) + 12)
    clock.advance(16); const first = wheel.position - released
    const before = wheel.position; clock.advance(16)
    expect(wheel.position - before).toBeLessThan(first)
    expect(selected).toEqual([])
    clock.advance(6000)
    expect(selected).toEqual([wheel.target]); expect(Number.isInteger(wheel.position)).toBe(true)
    expect(clock.tasks.size).toBe(0)
  })
  it('does not add momentum from a stale release sample', () => {
    const { wheel, clock, base, selected } = setup()
    wheel.down(250, 0, 0, 0); wheel.move(230, 0, 10); wheel.move(40, 0, 40); wheel.up(200)
    expect(wheel.target).toBe(base + 2); clock.advance(3000)
    expect(selected).toEqual([base + 2])
  })
  it('holds after 380ms, accelerates and stops repetition on release', () => {
    const { wheel, clock, selected, base } = setup()
    wheel.down(290, 0, 0, 1); clock.advance(379)
    expect(wheel.target).toBe(base)
    clock.advance(1); expect(wheel.target).toBe(base + 1)
    clock.advance(2000)
    expect(wheel.target).toBeGreaterThan(base + 7); expect(selected).toEqual([])
    wheel.up(clock.time); const target = wheel.target
    clock.advance(6000)
    expect(selected).toEqual([target]); expect(wheel.position).toBe(target)
    expect(wheel.consumeClick(1)).toBe(true)
    clock.advance(6000); expect(wheel.target).toBe(target); expect(clock.tasks.size).toBe(0)
  })
  it('interrupts a glide immediately and accepts a reverse drag without an accidental click', () => {
    const { wheel, clock, selected } = setup()
    flick(wheel); clock.advance(80)
    const caught = wheel.position
    wheel.down(60, 0, 100, 0); clock.advance(1000)
    expect(wheel.position).toBe(caught)
    wheel.move(80, 0, 120); wheel.move(260, 0, 500); wheel.up(700)
    expect(wheel.target).toBeLessThan(caught)
    clock.advance(3000); expect(selected).toHaveLength(1)
    expect(wheel.consumeClick(1)).toBe(true)
    expect(wheel.consumeClick(0)).toBe(false)
  })
  it('accepts a normal tap during the imperceptible final settling, as in the lab', () => {
    const { wheel, clock } = setup()
    wheel.step(1); clock.advance(400)
    expect(Math.abs(wheel.target - wheel.position)).toBeLessThan(.15)
    wheel.down(150, 0, 400, 0); wheel.up(410)
    expect(wheel.consumeClick(1)).toBe(false)
  })
  it('cancels holds and glides without further changes and supports external synchronization', () => {
    const { wheel, clock, selected, base } = setup()
    wheel.down(0, 0, 0, -1); clock.advance(1400); wheel.halt(); clock.advance(6000)
    expect(wheel.position).toBe(base); expect(selected).toEqual([])
    flick(wheel); clock.advance(80); wheel.sync(monthIndex('2040-02')); clock.advance(6000)
    expect(wheel.position).toBe(monthIndex('2040-02')); expect(selected).toEqual([])
    expect(clock.tasks.size).toBe(0)
  })
  it('returns to an owner-rejected month after requesting a settled selection', () => {
    const { wheel, clock, selected, base } = setup()
    wheel.step(1); clock.advance(3000); expect(selected).toEqual([base + 1])
    wheel.reconcile(base); expect(wheel.position).toBe(base)
    expect(selected).toHaveLength(1)
  })
  it('preserves vertical scroll and rejects short drags without a new period', () => {
    const { wheel, clock, selected, base } = setup()
    wheel.down(50, 0, 0, 0); expect(wheel.move(55, 20, 20)).toBe(false)
    wheel.up(100); clock.advance(3000); expect(selected).toEqual([])
    expect(wheel.position).toBe(base)
    expect(wheel.consumeClick(1)).toBe(true)
    expect(wheel.consumeClick(0)).toBe(false)
  })
  it('reduced motion allows multi-month dragging and hold without inertia or frames', () => {
    const { wheel, clock, selected, base } = setup(true)
    wheel.down(250, 0, 0, 0); wheel.move(230, 0, 10); wheel.move(40, 0, 40); wheel.up(40)
    expect(selected).toEqual([base + 2]); expect(clock.tasks.size).toBe(0)
    wheel.down(290, 0, 100, 1); clock.advance(1000); wheel.up(1100)
    expect(selected).toHaveLength(2); expect(clock.tasks.size).toBe(0)
  })
  it('activating reduced motion and destroying stop every scheduled callback', () => {
    const { wheel, clock, selected, base } = setup()
    flick(wheel); clock.advance(100); wheel.setReduced(true); clock.advance(6000)
    expect(wheel.position).toBe(base); expect(selected).toEqual([]); expect(clock.tasks.size).toBe(0)
    wheel.down(290, 0, 0, 1); clock.advance(600); wheel.destroy(); clock.advance(6000)
    expect(selected).toEqual([]); expect(clock.tasks.size).toBe(0)
  })
  it('accumulates button/key targets, crosses years and respects format extremes', () => {
    const { wheel, clock, selected, base } = setup()
    wheel.step(1); wheel.step(12); clock.advance(6000)
    expect(selected).toEqual([base + 13]); expect(indexMonth(wheel.position)).toBe('2028-01')
    wheel.sync(WHEEL_MAX); wheel.step(12); clock.advance(3000); expect(wheel.position).toBe(WHEEL_MAX)
    wheel.sync(WHEEL_MIN); wheel.step(-1); clock.advance(3000); expect(wheel.position).toBe(WHEEL_MIN)
  })
  it('interpolates five visible slots and removes depth for reduced motion', () => {
    expect(wheelSlot(0, false)).toMatchObject({ x: 0, z: 0, o: 1 })
    expect(Math.abs(wheelSlot(0, false).r)).toBe(0)
    expect(wheelSlot(1, false)).toMatchObject({ x: .34, r: -32, z: -60 })
    expect(wheelSlot(-2, false).o).toBe(.2)
    expect(wheelSlot(3, false).o).toBe(0)
    expect(wheelSlot(.5, true)).toMatchObject({ r: 0, z: 0 })
  })
})

describe('review cancellation regressions', () => {
  it.each(['vertical', 'cancel'])('settles a hold on %s without losing progress or adding inertia', kind => {
    const {wheel,clock,selected,base}=setup()
    wheel.down(290,0,0,1); clock.advance(1600)
    const visible=wheel.position, nearest=Math.round(visible)
    expect(visible).toBeGreaterThan(base+4)
    if(kind==='vertical') wheel.move(290,12,1600); else wheel.cancelGesture()
    expect(wheel.position).toBe(visible); expect(wheel.target).toBe(nearest)
    wheel.cancelGesture(); wheel.up(1700); clock.advance(3000)
    expect(selected).toEqual([nearest]); expect(clock.tasks.size).toBe(0)
  })
  it('keeps an interrupted flick when the same finger starts scrolling',()=>{
    const {wheel,clock,selected}=setup(); flick(wheel); clock.advance(120)
    const visible=wheel.position
    wheel.down(150,0,160,0); wheel.move(150,12,180); wheel.cancelGesture()
    expect(wheel.position).toBe(visible); expect(wheel.target).toBe(Math.round(visible))
    clock.advance(4000); expect(selected).toEqual([Math.round(visible)])
  })
  it('never paints the previous confirmed value during external synchronization',()=>{
    const {wheel,frames,base}=setup(); wheel.sync(base+3)
    expect(frames).toEqual([base+3])
  })
})
