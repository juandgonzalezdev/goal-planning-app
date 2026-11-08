import { screen, within } from '@testing-library/react'
import { formatYearMonth } from '../ui/format'
import { fire } from './space'

/** Select through the same disclosure and month grid as a keyboard/touch user. */
export async function chooseMonth(month: string) {
  await fire.click(screen.getByRole('button', { name: /^Choose month:/ }))
  const dialog = screen.getByRole('dialog', { name: 'Choose month' })
  await fire.change(within(dialog).getByRole('spinbutton', { name: 'Year' }), { target: { value: month.slice(0, 4) } })
  await fire.click(within(dialog).getByRole('button', { name: formatYearMonth(month) }))
}
