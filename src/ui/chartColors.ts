import type { BillCategory, MoneyAccountKind } from '../domain/finance/types'

/** Category colours of the approved Demo v5.9 bills chart. */
export const CATEGORY_COLORS: Record<BillCategory, string> = {
  Housing: '#8874ce',
  Loans: '#c09662',
  Education: '#55a6a4',
  Subscriptions: '#c183a8',
  Utilities: '#7299c5',
  Other: '#8c949e',
  Transport: '#5f9e6e',
  Cards: '#c97a6b',
}

/** My Money colours and names, from Demo v5.9 ("Other" is only shown when used). Savings takes the old Emergency Fund colour. */
export const MONEY_KINDS: Record<MoneyAccountKind, { label: string; color: string }> = {
  'daily-spending': { label: 'Daily Spending', color: '#7299c9' },
  investment: { label: 'Investments', color: '#947aca' },
  savings: { label: 'Savings', color: '#55a58f' },
  other: { label: 'Other', color: '#8c949e' },
}
