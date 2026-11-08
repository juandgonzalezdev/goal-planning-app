// @vitest-environment jsdom
import { chooseMonth } from './test/monthPicker'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { memoryStorage } from './test/memoryStorage'
import { fire, settle, freshDatabaseForEachTest } from './test/space'
import { markNotPaid, markPaid } from './test/bills'

freshDatabaseForEachTest()

// Mark as Paid (M1): the same short form on Home, in the Bills list and on the bill. It records
// the month's amount, the date, the account (or Not sure) and a loan's interest as one change,
// never guesses interest and never changes a Remaining Balance. Mark as Not Paid asks first.
// No partial payments and no Undo. Alex's demo is shown on its own date, 31 Dec 2026.
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const regionOf = (name: string) => screen.getByRole('region', { name })
const pickMonth = async (month: string) => await chooseMonth(month)
const form = (bill: string, month: string) => screen.getByRole('group', { name: `Mark as paid: ${bill}, ${month}` })
const inForm = (bill: string, month: string) => within(form(bill, month))
const spent = () => text(document.querySelector('[data-return-key="stat-spent"]'))

async function openAlex() {
  render(<App getToday={() => '2026-10-25'} storage={memoryStorage()} />)
  await settle()
  await fire.click(button('Explore the App'))
}

async function showBillsList() {
  await fire.click(tab('Bills'))
  await fire.click(button('List'))
}

describe('Mark as Paid on Home', () => {
  it('asks before replacing a changed payment with another bill and never saves the first draft', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await fire.click(button('Mark as Paid: Gym Membership, January 2027'))
    await fire.change(inForm('Gym Membership', 'January 2027').getByLabelText(/^Amount/), { target: { value: '77.70' } })
    await fire.change(inForm('Gym Membership', 'January 2027').getByLabelText('Paid on'), { target: { value: '2026-12-30' } })
    await fire.change(inForm('Gym Membership', 'January 2027').getByLabelText('Paid from'), { target: { value: 'not-sure' } })
    await fire.click(button('Mark as Paid: Transit Pass, January 2027'))
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect((inForm('Gym Membership', 'January 2027').getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('77.70')
    expect((inForm('Gym Membership', 'January 2027').getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-30')
    expect((inForm('Gym Membership', 'January 2027').getByLabelText('Paid from') as HTMLSelectElement).value).toBe('not-sure')
    expect(screen.queryByRole('group', { name: 'Mark as paid: Transit Pass, January 2027' })).toBeNull()
    await fire.click(button('Mark as Paid: Transit Pass, January 2027'))
    await fire.click(button('Discard and Leave'))
    expect(screen.queryByRole('group', { name: 'Mark as paid: Gym Membership, January 2027' })).toBeNull()
    expect((inForm('Transit Pass', 'January 2027').getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('110.00')
    await fire.click(inForm('Transit Pass', 'January 2027').getByRole('button', { name: 'Cancel' }))
    await fire.click(button('Mark as Paid: Gym Membership, January 2027'))
    expect((inForm('Gym Membership', 'January 2027').getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('129.00')
    expect((inForm('Gym Membership', 'January 2027').getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-31')
    expect((inForm('Gym Membership', 'January 2027').getByLabelText('Paid from') as HTMLSelectElement).value).toBe('everyday')
  })
  it('explains why an account with history cannot be deleted before saving', async () => {
    await openAlex()
    await fire.click(tab('Money'))
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Accounts & Savings/ }))
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Everyday Account/ }))
    const remove = button('Delete: Everyday Account')
    expect(remove.getAttribute('aria-disabled')).toBe('true')
    expect(text(regionOf('Accounts & Savings'))).toContain('linked records')
    await fire.click(remove)
    expect(button('Delete: Everyday Account')).toBeTruthy()
  })
  it('asks before Show Fewer hides a changed payment below the first five', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await fire.click(button(/^Show All \d+/))
    const buttons = screen.getAllByRole('button', { name: /^Mark as Paid:/ })
    await fire.click(buttons[5])
    const group = screen.getByRole('group', { name: /^Mark as paid:/ })
    await fire.change(within(group).getByLabelText(/^Amount/), { target: { value: '321' } })
    await fire.click(button('Show Fewer'))
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect((within(group).getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('321')
    await fire.click(button('Show Fewer'))
    await fire.click(button('Discard and Leave'))
    expect(screen.queryByRole('group', { name: /^Mark as paid:/ })).toBeNull()
  })
  it('opens the short form with the due date and the only Daily Spending account; once saved, the bill leaves Left to Pay', async () => {
    await openAlex()
    await fire.click(button('Mark as Paid: Phone & Internet, December 2026'))
    const fields = inForm('Phone & Internet', 'December 2026')
    expect((fields.getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('69.99')
    expect((fields.getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-31')
    expect((fields.getByLabelText('Paid from') as HTMLSelectElement).value).toBe('everyday')
    // Not a loan: no interest field, and nothing about a Remaining Balance.
    expect(fields.queryByLabelText(/^Interest/)).toBeNull()
    await fire.click(fields.getByRole('button', { name: 'Save as Paid' }))
    const area = regionOf('Left to Pay')
    expect(text(area)).toContain('All your December bills are paid.')
    expect(text(area)).toContain('Phone & Internet marked as paid for December 2026. Demo only: not saved.')
    expect(document.activeElement?.textContent).toContain('marked as paid')
    // History shows where it was paid from.
    await fire.click(tab('History'))
    expect(text(screen.getAllByRole('button', { name: /^Bill payment\s*Phone & Internet/ })[0])).toContain('From Everyday Account')
  })

  it('keeps a hidden amount hidden, and still saves it', async () => {
    await openAlex()
    await fire.click(button('Hide amounts in Left to Pay'))
    await fire.click(button('Mark as Paid: Phone & Internet, December 2026'))
    const fields = inForm('Phone & Internet', 'December 2026')
    expect(fields.queryByLabelText(/^Amount/)).toBeNull()
    expect(text(form('Phone & Internet', 'December 2026'))).toContain('Amount: hidden with the amounts')
    expect(text(form('Phone & Internet', 'December 2026'))).not.toMatch(/\d,\d\d/)
    await fire.click(fields.getByRole('button', { name: 'Save as Paid' }))
    expect(text(regionOf('Left to Pay'))).toContain('All your December bills are paid.')
  })

  it('asks before leaving a form that was changed, and Cancel closes it without asking', async () => {
    await openAlex()
    await fire.click(button('Mark as Paid: Phone & Internet, December 2026'))
    await fire.change(inForm('Phone & Internet', 'December 2026').getByLabelText(/^Amount/), { target: { value: '70' } })
    await fire.click(tab('Goals'))
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    await fire.click(inForm('Phone & Internet', 'December 2026').getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: /^Mark as paid/ })).toBeNull()
  })
})

describe('Mark as Paid in the Bills list', () => {
  it('asks before toggling a changed payment closed; Cancel explicitly discards it', async () => {
    await openAlex()
    await showBillsList()
    const toggle = () => button('Mark as Paid: Phone & Internet, December 2026')
    await fire.click(toggle())
    await fire.change(inForm('Phone & Internet', 'December 2026').getByLabelText(/^Amount/), { target: { value: '321' } })
    await fire.click(toggle())
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect((inForm('Phone & Internet', 'December 2026').getByLabelText(/^Amount/) as HTMLInputElement).value).toBe('321')
    await fire.click(inForm('Phone & Internet', 'December 2026').getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('group', { name: /^Mark as paid:/ })).toBeNull()
  })

  it.each(['list', 'detail'])('protects changes in both directions between payment and amount on the %s', async place => {
    await openAlex()
    await showBillsList()
    if (place === 'detail') await fire.click(button('Phone & Internet details'))
    const changeAmount = () => button(place === 'list' ? 'Change Amount for December 2026: Phone & Internet' : 'Change Amount for December 2026')
    await fire.click(button('Mark as Paid: Phone & Internet, December 2026'))
    await fire.change(inForm('Phone & Internet', 'December 2026').getByLabelText(/^Amount/), { target: { value: '321' } })
    await fire.click(changeAmount())
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect(screen.queryByLabelText('Amount for December 2026 (PLN)')).toBeNull()
    await fire.click(changeAmount())
    await fire.click(button('Discard and Leave'))
    expect(screen.queryByRole('group', { name: /^Mark as paid:/ })).toBeNull()
    await fire.change(screen.getByLabelText('Amount for December 2026 (PLN)'), { target: { value: '456' } })
    await fire.click(button('Mark as Paid: Phone & Internet, December 2026'))
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect((screen.getByLabelText('Amount for December 2026 (PLN)') as HTMLInputElement).value).toBe('456')
    await fire.click(button('Mark as Paid: Phone & Internet, December 2026'))
    await fire.click(button('Discard and Leave'))
    expect(screen.queryByLabelText('Amount for December 2026 (PLN)')).toBeNull()
    expect(form('Phone & Internet', 'December 2026')).toBeTruthy()
  })

  it('includes the visible Paid status in the accessible name', async () => {
    await openAlex()
    await showBillsList()
    const toggle = screen.getAllByText('Gym Membership').find(element => element.closest('.bill-item'))!.closest('.bill-item')!.querySelector('button.paid-toggle')
    expect(toggle?.textContent).toBe('✓ Paid')
    expect(screen.getByRole('button', { name: /^Paid.*Gym Membership/ })).toBe(toggle)
  })
  it('needs an amount when the month’s amount is unknown, and saves it for that month only', async () => {
    await openAlex()
    await showBillsList()
    await fire.click(button('Change Amount for December 2026: Phone & Internet'))
    await fire.click(button('Not Known Yet'))
    await markPaid('Phone & Internet', 'December 2026', { amount: '' })
    expect(text(form('Phone & Internet', 'December 2026'))).toContain('Enter the amount paid in December 2026: it isn’t known yet.')
    await fire.change(inForm('Phone & Internet', 'December 2026').getByLabelText(/^Amount/), { target: { value: '72.10' } })
    await fire.click(inForm('Phone & Internet', 'December 2026').getByRole('button', { name: 'Save as Paid' }))
    const toggle = button('Paid. Mark as Not Paid: Phone & Internet, December 2026')
    expect(toggle.textContent).toBe('✓ Paid')
    expect(document.activeElement).toBe(toggle)
    expect(text(toggle.closest('.bill-item'))).toContain('72,10 zł')
    expect(text(toggle.closest('.bill-item'))).toContain('Paid on 31 Dec 2026 · Everyday Account')
    await pickMonth('2026-11')
    expect(text(button('Paid. Mark as Not Paid: Phone & Internet, November 2026').closest('.bill-item'))).toContain('69,99 zł')
  })

  it('refuses a date after today and an empty account choice, and Not sure says it will not match the balances', async () => {
    await openAlex()
    await pickMonth('2027-01')
    await showBillsList()
    // A bill of a later month: the form suggests today, never a date to come.
    await fire.click(button('Mark as Paid: Phone & Internet, January 2027'))
    const fields = inForm('Phone & Internet', 'January 2027')
    expect((fields.getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-31')
    await fire.change(fields.getByLabelText('Paid on'), { target: { value: '2027-01-05' } })
    await fire.click(fields.getByRole('button', { name: 'Save as Paid' }))
    expect(text(form('Phone & Internet', 'January 2027'))).toContain('Choose a date that is not after today.')
    await fire.change(fields.getByLabelText('Paid on'), { target: { value: '2026-12-30' } })
    await fire.change(fields.getByLabelText('Paid from'), { target: { value: 'not-sure' } })
    expect(text(form('Phone & Internet', 'January 2027'))).toContain('Without an account, this payment won’t match your account balances.')
    await fire.click(fields.getByRole('button', { name: 'Save as Paid' }))
    expect(text(button('Paid. Mark as Not Paid: Phone & Internet, January 2027').closest('.bill-item'))).toContain('Paid on 30 Dec 2026 · Account not given')
  })

  it('with Pending chosen, a paid bill leaves the list and the keyboard goes to the message', async () => {
    await openAlex()
    await showBillsList()
    await fire.click(button(/^Pending/))
    await markPaid('Phone & Internet', 'December 2026')
    const note = document.getElementById('bill-list-paid-note')!
    await settle()
    expect(text(note)).toContain('Phone & Internet marked as paid for December 2026.')
    expect(document.activeElement).toBe(note)
  })
})

describe('A loan on its own screen', () => {
  it('asks before Mark as Not Paid, records the interest from the statement, and leaves the Remaining Balance alone', async () => {
    await openAlex()
    const owed = text(regionOf('Cards & Loans'))
    const spentBefore = spent()
    await showBillsList()
    await fire.click(button('Small Loan details'))
    await fire.click(button('Mark as Not Paid: Small Loan, December 2026'))
    const question = screen.getByRole('group', { name: 'Mark as not paid?' })
    expect(text(question)).toContain('The date, the account and the interest saved for December 2026 are removed. The amount stays.')
    await fire.click(within(question).getByRole('button', { name: 'Keep as Paid' }))
    expect(button('Mark as Not Paid: Small Loan, December 2026')).toBe(document.activeElement)
    await markNotPaid('Small Loan', 'December 2026')
    expect(screen.getByRole('status').textContent).toContain('Small Loan marked as not paid for December 2026.')
    await fire.click(button('Mark as Paid: Small Loan, December 2026'))
    const fields = inForm('Small Loan', 'December 2026')
    expect((fields.getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-15')
    expect(text(form('Small Loan', 'December 2026'))).toContain('Paying doesn’t change the Remaining Balance.')
    await fire.change(fields.getByLabelText(/^Interest in this payment/), { target: { value: '300' } })
    await fire.click(fields.getByRole('button', { name: 'Save as Paid' }))
    expect(text(form('Small Loan', 'December 2026'))).toContain('The interest can’t be more than the amount paid.')
    await fire.change(fields.getByLabelText(/^Interest in this payment/), { target: { value: '18.40' } })
    await fire.click(fields.getByRole('button', { name: 'Save as Paid' }))
    expect(text(screen.getByRole('main'))).toContain('Interest in this payment: 18,40 zł')
    await fire.click(button('Back'))
    await fire.click(tab('Home'))
    // What is owed does not move; Spent counts the interest given (it was not known before).
    expect(text(regionOf('Cards & Loans'))).toBe(owed)
    expect(spent()).not.toBe(spentBefore)
  })
})
