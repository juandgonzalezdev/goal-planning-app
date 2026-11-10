import { billsForMonth, summarizeBills } from '../../domain/finance/bills'
import type { FinanceData } from '../../domain/finance/types'
import type { YearMonth } from '../../domain/calendar'

/**
 * True only when this change is the one that pays the month's last unpaid bill. Pure: it writes nothing.
 * Whether the month was already celebrated is a Home preference on this device (HomeLayout), not data.
 */
export function completesBillMonth(before: FinanceData, after: FinanceData, month: YearMonth): boolean {
  const prior = summarizeBills(billsForMonth(before, month))
  const next = summarizeBills(billsForMonth(after, month))
  return prior.count > prior.paidCount && next.count > 0 && next.paidCount === next.count
}

const ease = (x: number) => 1 - (1 - x) ** 3
export function pulseAt(elapsed: number) {
  const t = elapsed - 480 - 60
  const lerp = (a: number, b: number, n: number) => a + (b - a) * n
  const beat = t < 0 ? 1 : t < 90 ? lerp(1, .91, ease(t / 90)) : t < 270 ? lerp(.91, 1.06, Math.sin((t - 90) / 180 * Math.PI / 2)) : t < 480 ? lerp(1.06, .985, ease((t - 270) / 210)) : t < 640 ? lerp(.985, 1, ease((t - 480) / 160)) : 1
  const frontAt = (time: number) => lerp(114, 222, ease(Math.min(1, Math.max(0, time / 900))))
  const p = Math.min(1, Math.max(0, t / 900))
  return {
    beat, front: frontAt(t), waveOpacity: t < 0 || p === 1 ? 0 : p < .08 ? p / .08 * .55 : .55 * (1 - p) ** 1.4,
    glowOpacity: t < 0 || p === 1 ? 0 : p < .1 ? p / .1 : (1 - p) ** 1.6,
    waveWidth: 2.8 - 2.2 * p,
    arcs: [0, 1, 2, 3].map(i => {
      const time = t - i * 55, q = Math.min(1, Math.max(0, time / 900)), d = (frontAt(time) - 160) / 34
      const amp = time > 0 && time < 1100 ? Math.exp(-1.6 * d * d) * (1 - q * .3) : 0
      return { scale: 1 + .035 * amp, brightness: 1 + .22 * amp }
    }),
  }
}
