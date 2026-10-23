/**
 * Saved data carries a schemaVersion. When the shape of the data changes,
 * a new step is added here that turns version N into N + 1, so data saved
 * by an older version of the app still loads. Steps never delete what the
 * user entered.
 */
export const CURRENT_SCHEMA_VERSION = 1

type Step = (data: Record<string, unknown>) => Record<string, unknown>

/** STEPS[n] turns version n into version n + 1. There are none yet: version 1 is the first. */
const STEPS: Record<number, Step> = {}

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
