// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { BillCelebrationContext, createBillCelebrationChannel } from './app/writeStatus'
import { createAlexDemo } from './data/fixtures/demoAlex'
import { billsForMonth } from './domain/finance/bills'
import type { FinanceData } from './domain/finance/types'
import { GoalRings } from './features/home/GoalRings'
import { RingCard } from './features/home/RingCard'
import { isKept, type ChangeSpace, type SaveOutcome } from './ui/saveOutcome'
import { memoryStorage } from './test/memoryStorage'
import { chooseMonth } from './test/monthPicker'
import { startDemoReset } from './test/homeControls'
import { fire, freshDatabaseForEachTest, settle } from './test/space'

/*
 * UX-04.1, Ring-first Home (A+C, Card with Next Step). Alex's demo is shown on
 * its own date, 31 Dec 2026: in December, 9 of 10 bills are paid and Phone &
 * Internet (69.99 zł, due 31 Dec) is the last one; January 2027 has every bill to pay.
 */
freshDatabaseForEachTest()
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const RINGS_KEY = 'goal-planning-app.home-rings'
const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(`^Select ${name.replace('&', '\\&')},`) })
const card = (name: string) => screen.getByRole('region', { name })
const reviewForm = (bill: string, month = 'December 2026') => screen.getByRole('group', { name: `Review payment: ${bill}, ${month}` })

async function openDemo(storage = memoryStorage(), createDemo?: () => { data: FinanceData; today: string }) {
  render(<App getToday={() => '2026-10-25'} storage={storage} createDemo={createDemo} />)
  await settle()
  await fire.click(button('Explore the App'))
  return storage
}

describe('Ring-first Home layout and preferences', () => {
  it('shows the ring and the Bills card first for someone who never chose, with the rest in a closed More for December', async () => {
    await openDemo()
    expect(screen.getByRole('radiogroup', { name: 'Select an area' })).toBeTruthy()
    expect(radio('Bills').getAttribute('aria-checked')).toBe('true')
    expect(card('Bills · December')).toBeTruthy()
    // Left to Pay is the Bills card now: it is not on Home twice.
    expect(screen.queryByRole('region', { name: 'Left to Pay' })).toBeNull()
    const more = button(/^More for December/)
    expect(more.getAttribute('aria-expanded')).toBe('false')
    // Reading order: the ring, then its card, then More.
    const ring = document.querySelector('.four-stage')!, bills = card('Bills · December'), fold = more.closest('section')!
    expect(ring.compareDocumentPosition(bills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bills.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await fire.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    for (const name of ['This Month', 'Money & Goals']) expect(screen.getByRole('region', { name })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Spending by Category' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Year Summary' })).toBeTruthy()
  })

  it('keeps the classic Home for a device that turned the rings off, and the ring for one that turned them on', async () => {
    const off = memoryStorage()
    off.setItem(RINGS_KEY, 'no')
    await openDemo(off)
    expect(screen.queryByRole('radiogroup', { name: 'Select an area' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Left to Pay' })).toBeTruthy()
    cleanup()
    const on = memoryStorage()
    on.setItem(RINGS_KEY, 'yes')
    await openDemo(on)
    expect(card('Bills · December')).toBeTruthy()
  })

  it('turning the rings off in Settings is remembered on this device as an explicit choice', async () => {
    const storage = await openDemo()
    await fire.click(button('Settings'))
    await fire.click(screen.getByRole('checkbox', { name: /Show rings on Home/ }))
    expect(storage.getItem(RINGS_KEY)).toBe('no')
  })

  it('selects all four sections without leaving Home, each with its own card and a way to its page', async () => {
    await openDemo()
    for (const [name, title] of [['Income', 'Income · December'], ['Cards & Loans', 'Cards & Loans'], ['Goals', 'Goals'], ['Bills', 'Bills · December']]) {
      await fire.click(radio(name))
      expect(radio(name).getAttribute('aria-checked')).toBe('true')
      expect(card(title)).toBeTruthy()
      expect(document.querySelector('[data-screen="home"]')).toBeTruthy()
    }
    await fire.click(within(card('Bills · December')).getByRole('button', { name: /^Open Bills/ }))
    expect(document.querySelector('[data-screen="bills"]')).toBeTruthy()
  })

  it('keeps the UX-03 centre: it opens the selected section’s details, and the card has no fake actions', async () => {
    await openDemo()
    await fire.click(radio('Income'))
    await fire.click(screen.getByRole('button', { name: /^Income centre,/ }))
    expect(screen.getByRole('heading', { name: 'Income' })).toBeTruthy()
    expect(button('← All areas')).toBeTruthy()
    await fire.click(button('← All areas'))
    // Income, Cards & Loans and Goals only open what already exists: no Record, Pay or Update button of their own.
    const income = card('Income · December')
    expect(within(income).queryByRole('button', { name: /^Record|^Confirm|^Update/ })).toBeNull()
    await fire.click(radio('Cards & Loans'))
    expect(within(card('Cards & Loans')).queryByRole('button', { name: /^Pay|^Update a Balance|^Confirm/ })).toBeNull()
  })
})

describe('Bills card: next step, payment review and states', () => {
  it('shows the next bill with its expected amount and due date, and reviews it with today’s date and the only Daily Spending account', async () => {
    await openDemo()
    const bills = card('Bills · December')
    expect(text(bills)).toContain('9 of 10 paid')
    expect(text(bills)).toContain('Pay Phone & Internet')
    expect(text(bills)).toContain('69,99 zł')
    expect(text(bills)).toContain('31 Dec 2026')
    expect(text(bills)).toContain('This is the last bill for December.')
    await fire.click(within(bills).getByRole('button', { name: 'Review payment: Phone & Internet' }))
    const form = within(reviewForm('Phone & Internet'))
    expect((form.getByLabelText(/^Amount paid/) as HTMLInputElement).value).toBe('69.99')
    expect((form.getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-31')
    expect((form.getByLabelText('Paid from') as HTMLSelectElement).value).toBe('everyday')
    expect(form.queryByLabelText(/^Interest/)).toBeNull()
    expect(form.getByRole('button', { name: 'Confirm Payment' })).toBeTruthy()
  })

  it('dates the review today even when the bill was due earlier in the month (Mark as Paid elsewhere keeps the due date)', async () => {
    const data = createAlexDemo()
    data.bills = data.bills.map(bill => bill.id === 'phone' ? { ...bill, dueDay: 10 } : bill)
    await openDemo(memoryStorage(), () => ({ data, today: '2026-12-31' }))
    await fire.click(button('Review payment: Phone & Internet'))
    expect((within(reviewForm('Phone & Internet')).getByLabelText('Paid on') as HTMLInputElement).value).toBe('2026-12-31')
    expect(text(card('Bills · December'))).toContain('10 Dec 2026')
  })

  it('cancel changes nothing and gives the keyboard back to Review payment', async () => {
    await openDemo()
    await fire.click(button('Review payment: Phone & Internet'))
    await fire.change(within(reviewForm('Phone & Internet')).getByLabelText(/^Amount paid/), { target: { value: '80' } })
    await fire.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: /^Review payment/ })).toBeNull()
    expect(document.activeElement).toBe(button('Review payment: Phone & Internet'))
    expect(text(card('Bills · December'))).toContain('9 of 10 paid')
    expect(radio('Bills').getAttribute('aria-label')).toContain('9 of 10 paid')
  })

  it('rejects an invalid amount and a date after today with the existing messages, without saving', async () => {
    await openDemo()
    await fire.click(button('Review payment: Phone & Internet'))
    const form = within(reviewForm('Phone & Internet'))
    await fire.change(form.getByLabelText(/^Amount paid/), { target: { value: 'abc' } })
    await fire.click(form.getByRole('button', { name: 'Confirm Payment' }))
    expect(text(reviewForm('Phone & Internet'))).toContain('Enter the amount paid, such as 120.45.')
    await fire.change(form.getByLabelText(/^Amount paid/), { target: { value: '70' } })
    await fire.change(form.getByLabelText('Paid on'), { target: { value: '2027-01-02' } })
    await fire.click(form.getByRole('button', { name: 'Confirm Payment' }))
    expect(text(reviewForm('Phone & Internet'))).toContain('Choose a date that is not after today.')
    expect(radio('Bills').getAttribute('aria-label')).toContain('9 of 10 paid')
  })

  it('confirms the last payment: the saved message, then All bills paid! without Left to pay, the Pulse on the ring and no extra notice', async () => {
    await openDemo()
    await fire.click(button('Review payment: Phone & Internet'))
    await fire.change(within(reviewForm('Phone & Internet')).getByLabelText(/^Amount paid/), { target: { value: '72.50' } })
    await fire.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Confirm Payment' }))
    const bills = card('Bills · December')
    const saved = bills.querySelector('.ring-saved')!
    expect(text(saved)).toBe('Phone & Internet marked as paid for December 2026. Demo only: not saved.')
    expect(document.activeElement).toBe(saved)
    expect(text(bills)).toContain('All bills paid!')
    expect(text(bills)).toContain('Nothing left to pay this month.')
    expect(text(bills)).toContain('10 of 10 bills paid.')
    expect(text(bills)).toMatch(/Paid this month: [\d ,]+ zł/)
    expect(text(bills)).not.toMatch(/Left to pay/)
    // Home played the Pulse, so the separate "All bills … are paid." notice is not needed.
    expect(bills.querySelector('.paid-completion')).toBeNull()
    expect(document.querySelector('.four-stage')?.getAttribute('data-celebrating')).toBe('true')
    expect(document.querySelector('.four-fx')).toBeTruthy()
    expect(document.querySelector('[class*="dart"],[data-dart]')).toBeNull()
    expect(radio('Bills').getAttribute('aria-label')).toContain('10 of 10 paid')
    // The paid bills stay available, with the amount actually paid.
    await fire.click(within(bills).getByRole('button', { name: 'Paid bills (10)' }))
    const phone = within(bills).getByText('Phone & Internet').closest('li')!
    expect(text(phone)).toContain('72,50 zł')
    expect(text(phone)).toContain('Paid on 31 Dec 2026')
  })

  it('does not celebrate December again after Mark as Not Paid and paying again from Home', async () => {
    await openDemo()
    await fire.click(button('Review payment: Phone & Internet'))
    await fire.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Confirm Payment' }))
    // Undo it from the Bills list, then pay it again from Home.
    await fire.click(within(card('Bills · December')).getByRole('button', { name: /^Open Bills/ }))
    await fire.click(button('List'))
    await fire.click(screen.getByRole('button', { name: /^Paid.*Phone & Internet/ }))
    await fire.click(button('Mark as Not Paid'))
    await fire.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Home' }))
    expect(document.querySelector('.four-fx')).toBeNull()
    await fire.click(button('Review payment: Phone & Internet'))
    await fire.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Confirm Payment' }))
    expect(text(card('Bills · December'))).toContain('All bills paid!')
    expect(document.querySelector('.four-fx')).toBeNull()
    expect(document.querySelector('.four-stage')?.hasAttribute('data-celebrating')).toBe(false)
  })

  it('lists every other bill to pay on demand and pays any of them from Home', async () => {
    await openDemo()
    await chooseMonth('2027-01')
    const january = billsForMonth(createAlexDemo(), '2027-01').filter(item => !item.paid)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name))
    const bills = card('Bills · January')
    expect(text(bills)).toContain(`Pay ${january[0].bill.name}`)
    expect(text(bills)).toContain(`${january.length} bills left`)
    // Progressive disclosure: the others are one tap away, not a long list.
    expect(within(bills).queryByRole('button', { name: `Review payment: ${january[1].bill.name}` })).toBeNull()
    await fire.click(within(bills).getByRole('button', { name: `Other bills to pay (${january.length - 1})` }))
    const last = january[january.length - 1].bill.name
    await fire.click(within(bills).getByRole('button', { name: `Review payment: ${last}` }))
    await fire.click(within(reviewForm(last, 'January 2027')).getByRole('button', { name: 'Confirm Payment' }))
    expect(text(card('Bills · January'))).toContain(`1 of ${january.length} paid`)
    expect(text(card('Bills · January'))).toContain(`Pay ${january[0].bill.name}`)
  })

  it('a linked loan payment takes optional interest, says the Remaining Balance does not change, and counts once', async () => {
    await openDemo()
    await chooseMonth('2027-01')
    await fire.click(radio('Cards & Loans'))
    const balanceOf = () => text(within(card('Cards & Loans')).getByText('Small Loan').closest('li')!.querySelector('b'))
    const before = balanceOf()
    await fire.click(radio('Bills'))
    const bills = card('Bills · January')
    const other = within(bills).queryByRole('button', { name: /^Other bills to pay/ })
    if (other) await fire.click(other)
    await fire.click(within(bills).getByRole('button', { name: 'Review payment: Small Loan' }))
    const form = within(reviewForm('Small Loan', 'January 2027'))
    expect(text(reviewForm('Small Loan', 'January 2027'))).toContain('Linked to')
    expect(text(reviewForm('Small Loan', 'January 2027'))).toContain('Paying doesn’t change the Remaining Balance.')
    expect((form.getByLabelText(/^Interest in this payment/) as HTMLInputElement).value).toBe('')
    await fire.change(form.getByLabelText(/^Interest in this payment/), { target: { value: '999' } })
    await fire.click(form.getByRole('button', { name: 'Confirm Payment' }))
    expect(text(reviewForm('Small Loan', 'January 2027'))).toContain('The interest can’t be more than the amount paid.')
    await fire.change(form.getByLabelText(/^Interest in this payment/), { target: { value: '18.40' } })
    await fire.click(form.getByRole('button', { name: 'Confirm Payment' }))
    expect(screen.queryByRole('group', { name: /^Review payment/ })).toBeNull()
    await fire.click(radio('Cards & Loans'))
    expect(balanceOf()).toBe(before)
    expect(radio('Cards & Loans').getAttribute('aria-label')).toMatch(/^Select Cards & Loans, 1 of \d+/)
  })

  it('asks before another section closes a review with typed changes', async () => {
    await openDemo()
    await fire.click(button('Review payment: Phone & Internet'))
    await fire.change(within(reviewForm('Phone & Internet')).getByLabelText(/^Amount paid/), { target: { value: '80' } })
    await fire.click(radio('Income'))
    expect(screen.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeTruthy()
    await fire.click(button('Keep Editing'))
    expect(radio('Bills').getAttribute('aria-checked')).toBe('true')
    expect((within(reviewForm('Phone & Internet')).getByLabelText(/^Amount paid/) as HTMLInputElement).value).toBe('80')
  })

  it('shows a month without bills as its own empty state, never as all paid, with Add Bill', async () => {
    const data = createAlexDemo()
    await openDemo(memoryStorage(), () => ({ data: { ...data, bills: [], billMonths: [] }, today: '2026-12-31' }))
    const bills = card('Bills · December')
    expect(text(bills)).toContain('No bills this month')
    expect(text(bills)).toContain('This isn’t the same as all bills paid.')
    expect(text(bills)).not.toContain('All bills paid!')
    expect(radio('Bills').getAttribute('aria-label')).toContain('No bills this month')
    await fire.click(within(bills).getByRole('button', { name: 'Add Bill' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Add Bill' })).toBeTruthy()
  })
})

describe('Ring-first privacy and Demo isolation', () => {
  it('hides every amount in the cards and in what screen readers hear, and keeps the reviewed amount without guessing', async () => {
    await openDemo()
    await fire.click(button('Hide amounts'))
    const bills = card('Bills · December')
    expect(text(bills)).not.toContain('zł')
    expect(text(bills)).toContain('Due 31 Dec 2026')
    for (const [name, title] of [['Income', 'Income · December'], ['Cards & Loans', 'Cards & Loans'], ['Goals', 'Goals']]) {
      await fire.click(radio(name))
      // No amount, visible or spoken: only masks, counts and dates.
      expect(text(card(title))).not.toContain('zł')
    }
    await fire.click(radio('Bills'))
    await fire.click(button('Review payment: Phone & Internet'))
    const form = reviewForm('Phone & Internet')
    expect(within(form).queryByLabelText(/^Amount paid/)).toBeNull()
    expect(text(form)).toContain('Amount: hidden with the amounts. The expected amount for December 2026 is kept.')
    expect(text(form)).not.toContain('zł')
    await fire.click(within(form).getByRole('button', { name: 'Confirm Payment' }))
    expect(text(card('Bills · December'))).toContain('All bills paid!')
    expect(text(card('Bills · December'))).toContain('Paid this month: ••••')
    await fire.click(button('Amounts hidden. Show amounts'))
    await fire.click(within(card('Bills · December')).getByRole('button', { name: 'Paid bills (10)' }))
    expect(text(within(card('Bills · December')).getByText('Phone & Internet').closest('li'))).toContain('69,99 zł')
  })

  it('a payment made in the demo is gone after Reset Demo, and the own space never sees it', async () => {
    const storage = await openDemo()
    await fire.click(button('Review payment: Phone & Internet'))
    await fire.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Confirm Payment' }))
    expect(text(card('Bills · December'))).toContain('All bills paid!')
    await startDemoReset()
    await fire.click(within(screen.getByRole('group', { name: 'Reset demo?' })).getByRole('button', { name: 'Reset Demo' }))
    expect(text(card('Bills · December'))).toContain('9 of 10 paid')
    // Nothing of the demo is written to this device's storage, besides screen preferences.
    for (let i = 0; i < storage.length; i++) expect(storage.getItem(storage.key(i)!) ?? '').not.toContain('Phone & Internet')
  })
})

describe('Ring-first save timing (component)', () => {
  function Harness({ outcome, initial }: { outcome: () => Promise<SaveOutcome>; initial: FinanceData }) {
    const [data, setData] = useState(initial)
    const current = useRef(initial)
    const change: ChangeSpace = async update => {
      const next = update(current.current)
      const result = await outcome()
      if (isKept(result)) { current.current = next; setData(next) }
      return result
    }
    return <GoalRings data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" newId={() => 'x'} onChange={async () => 'saved'} onOpen={() => {}}
      card={context => <RingCard key={context.area} context={context} data={data} month="2026-12" today="2026-12-31" asOf="2026-12-31" onChange={change}
        onOpenBills={() => {}} onAddBill={() => {}} onOpenIncome={() => {}} onOpenDebts={() => {}} onOpenGoals={() => {}} />} />
  }

  it('starts the Pulse only after the save is kept, never while saving', async () => {
    let resolve: (outcome: SaveOutcome) => void = () => {}
    const channel = createBillCelebrationChannel()
    render(<BillCelebrationContext.Provider value={channel}><Harness initial={createAlexDemo()} outcome={() => new Promise(done => { resolve = done })} /></BillCelebrationContext.Provider>)
    fireEvent.click(button('Review payment: Phone & Internet'))
    fireEvent.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Confirm Payment' }))
    expect(button('Saving…')).toBeTruthy()
    expect(document.querySelector('.four-fx')).toBeNull()
    expect(radio('Bills').getAttribute('aria-label')).toContain('9 of 10 paid')
    await act(async () => { resolve('saved') })
    expect(document.querySelector('.four-fx')).toBeTruthy()
    expect(text(card('Bills · December'))).toContain('All bills paid!')
  })

  it('a failed save keeps the form and what was typed, says so, and leaves the ring and the card as they were', async () => {
    const channel = createBillCelebrationChannel()
    const publish = vi.spyOn(channel, 'publish')
    render(<BillCelebrationContext.Provider value={channel}><Harness initial={createAlexDemo()} outcome={async () => 'not-saved'} /></BillCelebrationContext.Provider>)
    fireEvent.click(button('Review payment: Phone & Internet'))
    fireEvent.change(within(reviewForm('Phone & Internet')).getByLabelText(/^Amount paid/), { target: { value: '75' } })
    await act(async () => { fireEvent.click(within(reviewForm('Phone & Internet')).getByRole('button', { name: 'Confirm Payment' })) })
    const form = reviewForm('Phone & Internet')
    expect(within(form).getByRole('alert').textContent).toBe('This browser did not save it. Nothing was changed. Try again.')
    expect((within(form).getByLabelText(/^Amount paid/) as HTMLInputElement).value).toBe('75')
    expect(publish).not.toHaveBeenCalled()
    expect(document.querySelector('.four-fx')).toBeNull()
    expect(radio('Bills').getAttribute('aria-label')).toContain('9 of 10 paid')
    expect(document.querySelector('.ring-saved')).toBeNull()
  })
})
