import { screen, within } from '@testing-library/react'
import { fire } from './space'

const mainTab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })

/** Opens one block of Money from its heading, unless it is already open. */
export async function openMoneyBlock(name: 'Income' | 'Accounts & Savings' | 'Cards & Loans') {
  const toggle = screen.getByRole('button', { name: new RegExp(`^${name.replace(/[&]/g, '\\$&')}`) })
  if (toggle.getAttribute('aria-expanded') !== 'true') await fire.click(toggle)
}

/** Cards & Loans (once the Cards tab): the Money tab, with its Cards & Loans block open. */
export async function openCardsAndLoans() {
  await fire.click(mainTab('Money'))
  await openMoneyBlock('Cards & Loans')
}
