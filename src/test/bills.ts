import { screen, within } from '@testing-library/react'
import { fire } from './space'

/**
 * Mark as Paid (M1) on Home, in the Bills list or on a bill: opens the short form of that bill and
 * month, changes the fields given (the rest keep what the form suggests) and saves it.
 */
export async function markPaid(bill: string, month: string, fields: { amount?: string; paidOn?: string; account?: string; interest?: string } = {}) {
  await fire.click(screen.getByRole('button', { name: `Mark as Paid: ${bill}, ${month}` }))
  const form = within(screen.getByRole('group', { name: `Mark as paid: ${bill}, ${month}` }))
  if (fields.amount !== undefined) await fire.change(form.getByLabelText(/^Amount/), { target: { value: fields.amount } })
  if (fields.paidOn !== undefined) await fire.change(form.getByLabelText('Paid on'), { target: { value: fields.paidOn } })
  if (fields.account !== undefined) await fire.change(form.getByLabelText('Paid from'), { target: { value: fields.account } })
  if (fields.interest !== undefined) await fire.change(form.getByLabelText(/^Interest in this payment/), { target: { value: fields.interest } })
  await fire.click(form.getByRole('button', { name: 'Save as Paid' }))
}

/** Mark as Not Paid, then its confirmation. */
export async function markNotPaid(bill: string, month: string) {
  await fire.click(screen.queryByRole('button', { name: `Mark as Not Paid: ${bill}, ${month}` }) ?? screen.getByRole('button', { name: `Paid. Mark as Not Paid: ${bill}, ${month}` }))
  await fire.click(within(screen.getByRole('group', { name: 'Mark as not paid?' })).getByRole('button', { name: 'Mark as Not Paid' }))
}
