import { screen, within } from '@testing-library/react'
import { fire } from './space'
import type { ADD_LABELS } from '../app/addMenu'

/** Home options (the three-dots menu above the Home blocks): opens it and chooses Expand All, Collapse All or Customize Home. */
export async function chooseHomeOption(name: 'Expand All' | 'Collapse All' | 'Customize Home') {
  await fire.click(screen.getByRole('button', { name: 'Home options' }))
  await fire.click(within(screen.getByRole('menu', { name: 'Home options' })).getByRole('menuitem', { name }))
}

/** The demo strip's own menu: opens it and chooses Reset Demo (which then asks "Reset demo?"). */
export async function startDemoReset() {
  await fire.click(within(screen.getByRole('note')).getByRole('button', { name: 'Demo options' }))
  await fire.click(within(screen.getByRole('group', { name: 'About the demo' })).getByRole('button', { name: 'Reset Demo' }))
}

/** + Add in the header (on any tab): opens it and chooses one of its options. */
export async function addFromHome(name: (typeof ADD_LABELS)[keyof typeof ADD_LABELS]) {
  await fire.click(screen.getByRole('button', { name: 'Add' }))
  await fire.click(within(screen.getByRole('menu', { name: 'Add' })).getByRole('menuitem', { name }))
}

/** The Goals link in Money & Goals (Our Money & Goals in a Duo): opens the Goals tab. */
export async function openGoalsFromHome() {
  const area = screen.getByRole('region', { name: /Money & Goals$/ })
  await fire.click(within(area).getByRole('button', { name: /^Open Goals/ }))
}

/** Opens one part of a Home area (Spending by Category, Year Summary, Accounts & Savings, Cards & Loans, Goals), unless it is open. */
export async function openHomePart(name: 'Spending by Category' | 'Year Summary' | 'Accounts & Savings' | 'Cards & Loans' | 'Goals') {
  const part = screen.getByRole('region', { name })
  const toggle = part.querySelector<HTMLButtonElement>('.block-toggle')!
  if (toggle.getAttribute('aria-expanded') !== 'true') await fire.click(toggle)
}
