/**
 * Saved data carries a schemaVersion. When the shape of the data changes,
 * a new step is added here that turns version N into N + 1, so data saved
 * by an older version of the app still loads. Steps never delete what the
 * user entered.
 */
export const CURRENT_SCHEMA_VERSION = 3

type Step = (data: Record<string, unknown>) => Record<string, unknown>
type Rec = Record<string, unknown>

const list = (value: unknown): Rec[] => (Array.isArray(value) ? value : []) as Rec[]

/**
 * Version 1 to 2 (the Savings model):
 * - Expected income gets its own list, empty to start with.
 * - An "emergency" money account becomes a Savings account. Its name and
 *   balance stay: it is saved money, now shown inside Savings.
 * - Every balance entered so far is marked as entered by the user.
 * - Every pot is a goal. Its movements only moved money between purposes
 *   (in version 1 goals were not part of any account), so they are
 *   recorded as assigned or unassigned savings. No balance changes.
 * - A loan whose installment is also a bill keeps the amount in the bill
 *   only, so it can never be counted twice.
 */
export function migrateV1toV2(data: Rec): Rec {
  const bills = list(data.bills)
  const paidByBill = new Set(bills.map(bill => bill.debtId).filter((id): id is string => typeof id === 'string'))
  return {
    ...data,
    incomeSources: [],
    moneyAccounts: list(data.moneyAccounts).map(account => (account.kind === 'emergency' ? { ...account, kind: 'savings' } : account)),
    balances: list(data.balances).map(balance => ({ ...balance, source: 'entered' })),
    goals: list(data.goals).map(goal => ({ ...goal, kind: 'goal' })),
    goalMovements: list(data.goalMovements).map(movement => ({
      ...movement, effect: typeof movement.amount === 'number' && movement.amount < 0 ? 'unassigned' : 'assigned',
    })),
    debts: list(data.debts).map(debt => {
      if (typeof debt.id !== 'string' || !paidByBill.has(debt.id)) return debt
      const rest = { ...debt }
      delete rest.monthlyPayment
      return rest
    }),
  }
}

/**
 * Version 2 to 3 (real spending and transfers):
 * - Two new lists start empty: expenses (money spent that is not a bill)
 *   and transfers (money moved between the user's own accounts).
 * - Everything else stays exactly as it was. The new optional fields
 *   (where a bill was paid from, a loan installment's interest, yearly
 *   bills, paused months, subscription details, income notes) are simply
 *   absent, which means "not known".
 */
export function migrateV2toV3(data: Rec): Rec {
  return { ...data, expenses: [], transfers: [] }
}

/** STEPS[n] turns version n into version n + 1. */
const STEPS: Record<number, Step> = { 1: migrateV1toV2, 2: migrateV2toV3 }

export type MigrationResult =
  | { status: 'migrated'; data: Record<string, unknown>; fromVersion: number }
  | { status: 'not-data' }
  | { status: 'no-version' }
  /** Saved by a newer app version: loading it could lose data, so it is refused. */
  | { status: 'newer-version'; version: number }
  | { status: 'unknown-version'; version: number }

export function migrateToCurrent(input: unknown, steps: Record<number, Step> = STEPS, current = CURRENT_SCHEMA_VERSION): MigrationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { status: 'not-data' }
  const version = (input as Record<string, unknown>).schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { status: 'no-version' }
  if (version > current) return { status: 'newer-version', version }

  let data = structuredClone(input as Record<string, unknown>)
  for (let from = version; from < current; from++) {
    const step = steps[from]
    if (!step) return { status: 'unknown-version', version }
    data = { ...step(data), schemaVersion: from + 1 }
  }
  return { status: 'migrated', data, fromVersion: version }
}
