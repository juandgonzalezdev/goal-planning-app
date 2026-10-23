import { characterCount } from '../goal'
import type { CurrencyCode } from '../money'
import type { FinanceData, Owner, Space, SpaceMode, Theme } from './types'

/** Chart colours of the approved design: first member blue, second green, shared purple. */
export const MEMBER_COLORS = ['#3B82F6', '#10B981'] as const
export const SHARED_COLOR = '#8B5CF6'

export const MEMBER_NAME_MAX_LENGTH = 40

/** The space types people can choose now. Group is shown but not available yet. */
export const AVAILABLE_MODES: readonly SpaceMode[] = ['individual', 'duo']

export interface SpaceSetup {
  mode: SpaceMode
  /** One name for Individual, two for Duo. The first one is the person setting up. */
  names: string[]
  currency: CurrencyCode
  theme: Theme
}

export type SetupError = 'name-required' | 'name-too-long' | 'second-name-required' | 'second-name-too-long' | 'mode-not-available'

const MEMBER_COUNT: Record<SpaceMode, number> = { individual: 1, duo: 2, group: 3 }

export function validateSetup(setup: SpaceSetup): SetupError[] {
  const errors: SetupError[] = []
  if (!AVAILABLE_MODES.includes(setup.mode)) return ['mode-not-available']
  const [first = '', second = ''] = setup.names.map(name => name.trim())
  if (first === '') errors.push('name-required')
  else if (characterCount(first) > MEMBER_NAME_MAX_LENGTH) errors.push('name-too-long')
  if (setup.mode === 'duo') {
    if (second === '') errors.push('second-name-required')
    else if (characterCount(second) > MEMBER_NAME_MAX_LENGTH) errors.push('second-name-too-long')
  }
  return errors
}

/**
 * The user's own space, as Welcome Setup creates it: the members and
 * preferences, and nothing else. No income, bills, loans, accounts or
 * goals are added: the space starts empty.
 */
export function createSpaceData(setup: SpaceSetup): { status: 'created'; data: FinanceData } | { status: 'invalid'; errors: SetupError[] } {
  const errors = validateSetup(setup)
  if (errors.length > 0) return { status: 'invalid', errors }
  const names = setup.names.slice(0, MEMBER_COUNT[setup.mode]).map(name => name.trim())
  const space: Space = {
    id: 'my-space',
    name: names.join(' & '),
    mode: setup.mode,
    currency: setup.currency,
    members: names.map((name, index) => ({ id: `member-${index + 1}`, name, color: MEMBER_COLORS[index] })),
  }
  return {
    status: 'created',
    data: {
      schemaVersion: 1,
      space,
      preferences: { language: 'en', theme: setup.theme, displayCurrency: setup.currency },
      income: [], bills: [], billMonths: [], debts: [], moneyAccounts: [], balances: [], goals: [], goalMovements: [],
    },
  }
}

/** The colour of an owner in charts and lists. */
export function ownerColor(space: Space, owner: Owner): string {
  if (owner === 'shared') return SHARED_COLOR
  return space.members.find(member => member.id === owner)?.color ?? SHARED_COLOR
}

/** The name of an owner as the screen shows it. */
export function ownerName(space: Space, owner: Owner): string {
  if (owner === 'shared') return 'Shared'
  return space.members.find(member => member.id === owner)?.name ?? 'Unknown'
}
