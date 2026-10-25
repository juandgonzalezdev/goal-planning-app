import type { DebtKind, MovementEffect } from '../domain/finance/types'

/** Amounts are shown in forms with two decimals and a dot, e.g. "1800.00". Empty when not known. */
export const amountText = (minor: number | null | undefined) => (minor === null || minor === undefined ? '' : (minor / 100).toFixed(2))

export const DEBT_KIND_NAMES: Record<DebtKind, string> = { card: 'Credit Card', loan: 'Loan' }

/** What a goal movement did to Savings, in plain words. */
export const EFFECT_NAMES: Record<MovementEffect, string> = {
  'new-savings': 'New savings',
  assigned: 'From unassigned savings',
  unassigned: 'Back to unassigned savings',
  'taken-out': 'Taken out of savings',
}
