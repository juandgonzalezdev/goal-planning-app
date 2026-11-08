/** Continuous visual calendar motion, independent of React and financial data.
 * Physics follows the approved Month Wheel Lab v2; only rest emits selection. */
export const WHEEL_MIN = 12 // 0001-01
export const WHEEL_MAX = 9999 * 12 + 11
export const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1
export const indexMonth = (index: number) => String(Math.floor(index / 12)).padStart(4, '0') + '-' + String(index % 12 + 1).padStart(2, '0')
const clamp = (n: number) => Math.max(WHEEL_MIN, Math.min(WHEEL_MAX, n))
export type WheelClock = {
  now: () => number
  frame: (callback: (time: number) => void) => number
  cancel: (id: number) => void
  delay: (callback: () => void, ms: number) => number
  clear: (id: number) => void
}
export const browserWheelClock: WheelClock = {
  now: () => performance.now(),
  frame: callback => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : window.setTimeout(() => callback(performance.now()), 16),
  cancel: id => typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : window.clearTimeout(id),
  delay: (callback, ms) => window.setTimeout(callback, ms),
  clear: id => window.clearTimeout(id),
}
type Gesture = { x: number; y: number; start: number; dragging: boolean; caught: boolean; samples: { x: number; t: number }[]; timer: number }
export class MonthWheelMotion {
  position: number
  target: number
  private confirmed: number
  private frame = 0
  private lastTime = 0
  private tau = .085
  private gesture: Gesture | null = null
  private hold: { dir: number; interval: number; timer: number } | null = null
  private suppress = false
  private disposed = false
  private reduced: boolean
  private width: () => number
  private draw: (position: number, reduced: boolean) => void
  private select: (index: number) => void
  private clock: WheelClock
  constructor(value: number, reduced: boolean, width: () => number,
    draw: (position: number, reduced: boolean) => void, select: (index: number) => void,
    clock: WheelClock = browserWheelClock) {
    this.reduced = reduced; this.width = width; this.draw = draw; this.select = select; this.clock = clock
    this.position = this.target = this.confirmed = clamp(value)
  }
  private paint() { if (!this.disposed) this.draw(this.position, this.reduced) }
  private stopFrame() { if (this.frame) this.clock.cancel(this.frame); this.frame = 0 }
  private rest() {
    if (this.gesture || this.hold || this.disposed) return
    const n = clamp(Math.round(this.position))
    if (this.position !== n) { this.animate(n, .085); return }
    if (n !== this.confirmed) { this.confirmed = n; this.select(n) }
  }
  private loop = (now: number) => {
    if (this.disposed) return
    const dt = Math.min(.05, Math.max(0, (now - this.lastTime) / 1000)); this.lastTime = now
    const tau = Math.abs(this.target - this.position) < .35 ? Math.min(this.tau, .085 * 1.4) : this.tau
    this.position += (this.target - this.position) * (1 - Math.exp(-dt / tau))
    if (Math.abs(this.target - this.position) < .003) {
      this.frame = 0; this.position = this.target; this.paint(); this.rest(); return
    }
    this.paint(); this.frame = this.clock.frame(this.loop)
  }
  private animate(target: number, tau: number) {
    if (this.disposed) return
    this.target = clamp(target); this.tau = tau
    if (this.reduced) { this.stopFrame(); this.position = this.target; this.paint(); this.rest(); return }
    if (!this.frame) { this.lastTime = this.clock.now(); this.frame = this.clock.frame(this.loop) }
  }
  step(delta: number) {
    this.clearGesture()
    this.animate(clamp(Math.round(this.target) + delta), .11)
  }
  edge(last: boolean) {
    this.clearGesture()
    this.animate(clamp(Math.floor(Math.round(this.target) / 12) * 12 + (last ? 11 : 0)), .12)
  }
  private clearGesture() {
    if (this.gesture) this.clock.clear(this.gesture.timer)
    if (this.hold) this.clock.clear(this.hold.timer)
    this.gesture = null; this.hold = null
  }
  /** Safety cancellation restores the owner-confirmed period, never writes data. */
  halt() {
    this.clearGesture(); this.stopFrame()
    this.suppress = true
    this.position = this.target = this.confirmed; this.paint()
  }
  /** Finger cancellation retains visible progress without velocity projection. */
  cancelGesture() {
    if (!this.gesture) return
    this.clearGesture(); this.stopFrame(); this.suppress = true
    this.animate(Math.round(this.position), .085)
  }
  sync(value: number) {
    if (value === this.confirmed) return
    this.clearGesture(); this.stopFrame(); this.confirmed = clamp(value); this.position = this.target = this.confirmed; this.paint()
  }
  reconcile(value: number) { this.sync(value) }
  setReduced(reduced: boolean) { if (this.reduced !== reduced) { this.reduced = reduced; this.halt() } }
  keyboard() { this.suppress = false }
  consumeClick(detail: number) {
    const skip = this.suppress && detail > 0
    this.suppress = false
    return skip
  }
  down(x: number, y: number, t: number, zone: -1 | 0 | 1) {
    if (this.disposed) return
    // Like the lab, an almost-settled detent still accepts a normal tap.
    const caught = !!this.hold || (this.frame !== 0 && Math.abs(this.target - this.position) > .15)
    this.clearGesture(); this.stopFrame(); this.target = this.position; this.suppress = caught
    const g: Gesture = { x, y, start: this.position, dragging: false, caught, samples: [{ x, t }], timer: 0 }
    this.gesture = g
    if (!caught && zone) g.timer = this.clock.delay(() => { if (this.gesture === g && !g.dragging) this.startHold(zone) }, 380)
  }
  private startHold(dir: number) {
    this.suppress = true
    this.hold = { dir, interval: 300, timer: 0 }
    const tick = () => {
      const h = this.hold
      if (!h || this.disposed) return
      const next = clamp(Math.round(this.target) + h.dir)
      if (next === this.target) return
      this.animate(next, .07)
      h.interval = Math.max(110, h.interval * .9)
      h.timer = this.clock.delay(tick, h.interval)
    }
    tick()
  }
  move(x: number, y: number, t: number) {
    const g = this.gesture
    if (!g) return false
    const dx = x - g.x, dy = y - g.y
    if (!g.dragging) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.dragging = true; this.clock.clear(g.timer)
        if (this.hold) this.clock.clear(this.hold.timer)
        this.hold = null; this.stopFrame(); this.suppress = true
        g.x = x; g.start = this.position
      } else if (Math.abs(dy) > 10) { this.cancelGesture(); return false }
      else return false
    }
    g.samples.push({ x, t })
    while (g.samples.length > 2 && t - g.samples[0].t > 100) g.samples.shift()
    let position = g.start - (x - g.x) / (this.width() * .34)
    if (this.reduced) position = Math.round(position)
    this.position = this.target = clamp(position); this.paint()
    return true
  }
  up(t: number) {
    const g = this.gesture
    if (!g) return
    this.clock.clear(g.timer); this.gesture = null
    if (this.hold) {
      this.clock.clear(this.hold.timer); this.hold = null
      this.animate(Math.round(this.target), .07); return
    }
    if (!g.dragging) { if (g.caught) this.animate(Math.round(this.position), .085); return }
    const a = g.samples[0], b = g.samples[g.samples.length - 1]
    const velocity = t - b.t < 60 ? -(b.x - a.x) / Math.max(.016, (b.t - a.t) / 1000) / (this.width() * .34) : 0
    if (this.reduced || Math.abs(velocity) < 1.4) { this.animate(Math.round(this.position), .085); return }
    const travel = Math.max(-12, Math.min(12, velocity * .34))
    let destination = clamp(Math.round(this.position + travel))
    if (destination === Math.round(this.position) && Math.abs(velocity) > 2.5) destination = clamp(destination + Math.sign(velocity))
    this.animate(destination, Math.max(.14, Math.min(.45, Math.abs((destination - this.position) / velocity) || .34)))
  }
  destroy() { this.clearGesture(); this.stopFrame(); this.disposed = true }
}

const SLOTS = [
  { x: 0, z: 0, r: 0, s: 1, o: 1 }, { x: .34, z: -60, r: 32, s: .74, o: .92 },
  { x: .6, z: -150, r: 60, s: .6, o: .2 }, { x: .72, z: -230, r: 78, s: .5, o: 0 },
]
export function wheelSlot(position: number, flat: boolean) {
  const p = Math.min(Math.abs(position), 3), i = Math.floor(p), f = p - i
  const a = SLOTS[i], b = SLOTS[Math.min(i + 1, 3)], sign = position < 0 ? -1 : 1
  const lerp = (key: keyof typeof a) => a[key] + (b[key] - a[key]) * f
  return { x: lerp('x') * sign, z: flat ? 0 : lerp('z'), r: flat ? 0 : -lerp('r') * sign, s: lerp('s'), o: flat && p >= 2 ? 0 : lerp('o') }
}
