import { screen, within } from '@testing-library/react'
import { fire } from './space'

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
