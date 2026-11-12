// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { browserSpaceStore } from './app/useSpace'
import type { SpaceStore } from './data/spaceStore'
import { createSpaceData } from './domain/finance/space'
import type { FinanceData } from './domain/finance/types'
import { memoryStorage, storedKeys } from './test/memoryStorage'
import { openMoneyBlock } from './test/money'
import { fire, freshDatabaseForEachTest, heldStore, refuseWrites, settle, storedData, storedProgress } from './test/space'

freshDatabaseForEachTest()

// GS-4: the Debts and Bills stages of Getting Started host the card or loan form and the bill form that
// already exist (DebtForm, BillForm): the same checks and save, the user stays on the stage after a save,
// "I don't have any debts" is not Skip for now, and a debt payment that already is a bill is never added twice.
afterEach(() => { cleanup(); vi.restoreAllMocks() })
beforeEach(() => { window.history.replaceState(null, '') })

const TODAY = '2026-10-25'
const PROGRESS_KEY = 'goal-planning-app.getting-started'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const card = () => screen.queryByRole('region', { name: 'Getting Started' })
const stages = () => within(screen.getByRole('navigation', { name: 'Getting Started stages' }))
const stage = (name: string) => stages().getByRole('button', { name: new RegExp(`^${name}, step`) }) as HTMLButtonElement
const stageStates = () => stages().getAllByRole('button').map(item => (item.getAttribute('aria-label') ?? '').replace(/, step \d of 6: /, ': '))
const title = () => screen.getByRole('heading', { level: 1 }).textContent
const question = () => screen.queryByRole('alertdialog')
const shownScreen = () => document.querySelector('[data-screen]')?.getAttribute('data-screen')
// GS-6A.1: the progress is saved in the database, with its own revision (no longer in localStorage).
const savedProgress = () => storedProgress()
const main = () => text(screen.getByRole('main'))
const listItems = (name: string) => within(screen.getByRole('list', { name })).getAllByRole('listitem').map(item => text(item))
const moves = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 5)) })

function space(duo = false): FinanceData {
  const made = createSpaceData({ mode: duo ? 'duo' : 'individual', names: duo ? ['Robin', 'Sam'] : ['Robin'], currency: 'PLN', theme: 'light' })
  if (made.status !== 'created') throw new Error('invalid setup')
  return made.data
}

async function ownSpace(options: { duo?: boolean; storage?: Storage; store?: SpaceStore } = {}) {
  const storage = options.storage ?? memoryStorage()
  await browserSpaceStore(memoryStorage()).create(space(options.duo))
  render(<App getToday={() => TODAY} storage={storage} createStore={options.store ? () => options.store! : undefined} />)
  await settle()
  return storage
}

/** Opens Getting Started from Home and goes to a stage with Skip for now. */
async function openStage(name: 'Debts' | 'Bills & Subscriptions') {
  await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
  while (title() !== name) await fire.click(button('Skip for now'))
}

/** Fills the card or loan form of the stage (it opens it first). */
async function typeDebt(debt: { kind?: 'loan' | 'card'; name: string; interest?: string; balance?: string; payment?: string; addBill?: boolean }) {
  if (!screen.queryByRole('group', { name: 'Add a Debt' })) await fire.click(button(/^Add (a|Another) Debt$/))
  if (debt.kind) await fire.change(field('Type'), { target: { value: debt.kind } })
  await fire.change(field('Name'), { target: { value: debt.name } })
  if (debt.balance !== undefined) await fire.change(field(/^Remaining Balance/), { target: { value: debt.balance } })
  if (debt.interest !== undefined) await fire.change(field('Yearly Interest (%)'), { target: { value: debt.interest } })
  if (debt.payment !== undefined) await fire.change(field(/Monthly Payment \(PLN\)$/), { target: { value: debt.payment } })
  if (debt.addBill === false) await fire.click(field(/^Add this payment to my monthly bills/))
  await fire.change(field('Payment Due Day'), { target: { value: '15' } })
}

/** Fills the bill form of the stage (it opens it first). */
async function typeBill(bill: { name: string; amount?: string; unknown?: boolean; frequency?: 'monthly' | 'yearly' | 'once'; debt?: string }) {
  if (!screen.queryByRole('group', { name: 'Add a Bill' })) await fire.click(button(/^Add (a|Another) Bill$/))
  await fire.change(field('Bill name'), { target: { value: bill.name } })
  if (bill.unknown) await fire.click(field('Amount not known yet'))
  else if (bill.amount !== undefined) await fire.change(field('Amount (PLN)'), { target: { value: bill.amount } })
  await fire.change(field('Due day'), { target: { value: '5' } })
  if (bill.frequency) await fire.change(field('Frequency'), { target: { value: bill.frequency } })
  if (bill.debt) {
    await fire.click(button('More details'))
    const select = field('Pays a card or loan') as unknown as HTMLSelectElement
    const option = [...select.options].find(item => item.textContent === bill.debt)!
    await fire.change(select, { target: { value: option.value } })
  }
}

describe('Debts stage', () => {
  it('adds a loan and a card from the stage, stays there, and they are the same records Money shows', async () => {
    await ownSpace()
    await openStage('Debts')
    expect(main()).toContain('What do you owe?')
    expect(main()).toContain('No debts yet.')
    await typeDebt({ name: 'Car loan', balance: '12000', interest: '7.5', payment: '450' })
    await fire.click(button('Add'))
    expect(shownScreen()).toBe('guide')
    expect(title()).toBe('Debts')
    expect(main()).toContain('Debt added. Saved on this device.')
    expect(document.activeElement?.id).toBe('gs-add-debt')
    expect(document.activeElement?.textContent).toContain('Add Another Debt')
    expect(stageStates()[2]).toBe('Debts: Completed, current')
    // With a debt, "I don't have any debts" is not offered: it would contradict the records.
    expect(screen.queryByRole('button', { name: 'I don’t have any debts' })).toBeNull()
    expect(button(/^Continue/)).toBeTruthy()
    // Another one, a card with 0% interest and no payment: 0 is a rate, as in the card or loan screen.
    await typeDebt({ kind: 'card', name: 'Visa', interest: '0' })
    await fire.click(button('Add'))
    expect(listItems('Your debts')).toEqual(['Car loanLoan · Already in your bills12 000,00 zł', 'VisaCredit CardNot entered'])
    const data = (await storedData())!
    expect(data.debts.map(debt => [debt.name, debt.kind, debt.yearlyInterestBasisPoints, debt.monthlyPayment, debt.owner]))
      .toEqual([['Car loan', 'loan', 750, undefined, data.space.members[0].id], ['Visa', 'card', 0, undefined, data.space.members[0].id]])
    // The loan's payment went to one linked bill, as it does from Money; the card added none.
    expect(data.bills.map(bill => [bill.name, bill.amount, bill.debtId, bill.startMonth, bill.category]))
      .toEqual([['Car loan', 45000, data.debts[0].id, '2026-10', 'Loans']])
    await fire.click(tab('Money'))
    await openMoneyBlock('Cards & Loans')
    expect(listItems('Cards and loans').map(item => item.split('Remaining')[0])).toEqual(['Car loanLoan12 000,00 zł ', 'VisaCredit CardBalance needed '])
  })

  it('keeps the form’s checks: the interest is still required, the form stays as typed, and Cancel saves nothing', async () => {
    await ownSpace()
    await openStage('Debts')
    await typeDebt({ name: 'Phone plan' })
    await fire.click(button('Add'))
    expect(main()).toContain('Enter the yearly interest in percent, such as 9.9 or 0.')
    expect(field('Name').value).toBe('Phone plan')
    await fire.click(button('Cancel'))
    expect(screen.queryByRole('group', { name: 'Add a Debt' })).toBeNull()
    expect(main()).toContain('No debts yet.')
    expect((await storedData())!.debts).toEqual([])
  })

  it('a save the browser refuses keeps the form as typed and says so', async () => {
    await ownSpace()
    await openStage('Debts')
    await typeDebt({ name: 'Car loan', interest: '5' })
    refuseWrites()
    await fire.click(button('Add'))
    expect(field('Name').value).toBe('Car loan')
    expect(main()).toContain('This browser did not save it.')
    expect(stageStates()[2]).toBe('Debts: Not started, current')
    vi.restoreAllMocks()
    expect((await storedData())!.debts).toEqual([])
  })

  it('two quick taps on Add add one debt, here and in Money (also in the demo)', async () => {
    await ownSpace()
    await openStage('Debts')
    await typeDebt({ name: 'Car loan', interest: '5', payment: '300' })
    const add = button('Add')
    fireEvent.click(add)
    fireEvent.click(add)
    await settle()
    const data = (await storedData())!
    expect([data.debts.length, data.bills.length]).toEqual([1, 1])
    expect(listItems('Your debts')).toHaveLength(1)
  })

  it('"I don’t have any debts" saves none, Skip for now saves skipped; a debt added later wins over none', async () => {
    const storage = await ownSpace()
    await openStage('Debts')
    await fire.click(button('Skip for now'))
    expect(await savedProgress()).toMatchObject({ skipped: ['accounts', 'income', 'debts'], none: [] })
    // GS-6A.1: the own space no longer writes progress to localStorage.
    expect(storage.getItem(PROGRESS_KEY)).toBeNull()
    expect(stageStates()[2]).toBe('Debts: Skipped')
    await fire.click(stage('Debts'))
    await fire.click(button('I don’t have any debts'))
    expect(title()).toBe('Bills & Subscriptions')
    expect(await savedProgress()).toMatchObject({ skipped: ['accounts', 'income'], none: ['debts'] })
    expect(stageStates()[2]).toBe('Debts: No debts')
    expect((await storedData())!.debts).toEqual([])
    // Kept after Close and a new start.
    await fire.click(button('Close Getting Started'))
    await moves()
    cleanup()
    render(<App getToday={() => TODAY} storage={storage} />)
    await settle()
    await fire.click(within(card()!).getByRole('button', { name: /setup$/ }))
    expect(stageStates()[2]).toBe('Debts: No debts')
    // The answer never blocks a real debt; once there is one, the records decide.
    await fire.click(stage('Debts'))
    await typeDebt({ name: 'Family loan', interest: '0' })
    await fire.click(button('Add'))
    expect(stageStates()[2]).toBe('Debts: Completed, current')
    expect((await storedData())!.debts.map(debt => debt.name)).toEqual(['Family loan'])
    expect((await savedProgress())?.none).toEqual(['debts'])
  })

  it('in a Duo, a new debt is shared, as in Money', async () => {
    await ownSpace({ duo: true })
    await openStage('Debts')
    await typeDebt({ name: 'Mortgage', interest: '6' })
    await fire.click(button('Add'))
    expect((await storedData())!.debts.map(debt => debt.owner)).toEqual(['shared'])
  })
})

describe('Bills & Subscriptions stage', () => {
  it('adds a bill and a yearly subscription with an unknown amount, stays there, and Bills shows them', async () => {
    await ownSpace()
    await openStage('Bills & Subscriptions')
    expect(main()).toContain('No bills yet.')
    await typeBill({ name: 'Rent', amount: '2100' })
    await fire.click(button('Save'))
    expect(shownScreen()).toBe('guide')
    expect(title()).toBe('Bills & Subscriptions')
    expect(main()).toContain('Bill added. Saved on this device.')
    expect(document.activeElement?.textContent).toContain('Add Another Bill')
    expect(stageStates()[3]).toBe('Bills: Completed, current')
    await typeBill({ name: 'Streaming', unknown: true, frequency: 'yearly' })
    await fire.click(button('Save'))
    // Unknown stays unknown, never 0.
    expect(listItems('Your bills')).toEqual(['RentOther2100,00 zł', 'StreamingOtherUnknown'])
    const data = (await storedData())!
    expect(data.bills.map(bill => [bill.name, bill.amount, bill.frequency ?? 'monthly', bill.startMonth, bill.endMonth, bill.dueDay]))
      .toEqual([['Rent', 210000, 'monthly', '2026-10', null, 5], ['Streaming', null, 'yearly', '2026-10', null, 5]])
    expect(data.billMonths).toEqual([])
    // The same records in Bills, on the month it already showed.
    await fire.click(tab('Bills'))
    await fire.click(button('All Bills'))
    expect(main()).toContain('Rent')
    expect(main()).toContain('Streaming')
  })

  it('a one-month bill keeps its dates; the form’s checks and Cancel work as in Bills', async () => {
    await ownSpace()
    await openStage('Bills & Subscriptions')
    await typeBill({ name: 'Car repair', amount: '' })
    await fire.click(button('Save'))
    expect(main()).toContain('Enter the amount, or select Amount not known yet.')
    expect(document.activeElement?.id).toBe('bill-amount')
    await fire.change(field('Amount (PLN)'), { target: { value: '800' } })
    await fire.change(field('Frequency'), { target: { value: 'once' } })
    await fire.click(button('Save'))
    expect((await storedData())!.bills.map(bill => [bill.startMonth, bill.endMonth])).toEqual([['2026-10', '2026-10']])
    await typeBill({ name: 'Gym', amount: '99' })
    await fire.click(button('Cancel'))
    expect((await storedData())!.bills.map(bill => bill.name)).toEqual(['Car repair'])
  })

  it('two quick taps on Save add one bill', async () => {
    await ownSpace()
    await openStage('Bills & Subscriptions')
    await typeBill({ name: 'Rent', amount: '2100' })
    const save = button('Save')
    fireEvent.click(save)
    fireEvent.click(save)
    await settle()
    expect((await storedData())!.bills).toHaveLength(1)
  })
})

describe('Debt payments already in the bills', () => {
  it('a payment a debt added is shown as "Already in your bills" and is never added again by going through the stages', async () => {
    await ownSpace()
    await openStage('Debts')
    await typeDebt({ name: 'Car loan', interest: '5', payment: '450' })
    await fire.click(button('Add'))
    await typeDebt({ kind: 'card', name: 'Visa', interest: '20', payment: '200', addBill: false })
    await fire.click(button('Add'))
    await fire.click(button(/^Continue/))
    expect(title()).toBe('Bills & Subscriptions')
    // The linked bill is listed apart and does not complete the stage.
    expect(listItems('Debt payments already in your bills')).toEqual(['Car loanPays Car loan · Already in your bills450,00 zł'])
    expect(main()).toContain('This debt payment is already included in your bills.')
    expect(stageStates()[3]).toBe('Bills: Not started, current')
    // The card's payment is held by the card, not by a bill: it is never said to be in the bills.
    expect(main()).toContain('Not in your bills yet: the monthly payment you entered for Visa.')
    expect(listItems('Debt payments already in your bills').join()).not.toContain('Visa')
    // Back and forth through the stages adds nothing.
    await fire.click(button('Back'))
    await fire.click(button(/^Continue/))
    await fire.click(button('Skip for now'))
    await fire.click(stage('Bills'))
    const data = (await storedData())!
    expect(data.bills.map(bill => [bill.name, bill.debtId])).toEqual([['Car loan', data.debts[0].id]])
    expect(data.debts.map(debt => debt.monthlyPayment)).toEqual([undefined, 20000])
    // A bill with the card's name, without the link, is not "already in your bills".
    await typeBill({ name: 'Visa', amount: '200' })
    await fire.click(button('Save'))
    expect(listItems('Your bills')).toEqual(['VisaOther200,00 zł'])
    expect(listItems('Debt payments already in your bills')).toHaveLength(1)
    expect(main()).toContain('Not in your bills yet: the monthly payment you entered for Visa.')
  })

  it('the "not in your bills" hint is only for a payment entered on the debt; a debt with no payment gets none', async () => {
    await ownSpace()
    await openStage('Debts')
    // A card with no payment and no bill: nothing to add to the bills.
    await typeDebt({ kind: 'card', name: 'Visa', interest: '20' })
    await fire.click(button('Add'))
    // A loan whose payment stays on the loan (not a bill): the hint is for it.
    await typeDebt({ name: 'Student loan', interest: '3', payment: '250', addBill: false })
    await fire.click(button('Add'))
    // A loan whose payment is a linked bill: "Already in your bills", never the hint.
    await typeDebt({ name: 'Car loan', interest: '5', payment: '450' })
    await fire.click(button('Add'))
    await fire.click(button(/^Continue/))
    const hint = () => screen.queryByText(/^Not in your bills yet/)?.textContent ?? ''
    expect(hint()).toContain('the monthly payment you entered for Student loan.')
    expect(hint()).not.toMatch(/Visa|Car loan/)
    expect(listItems('Debt payments already in your bills')).toEqual(['Car loanPays Car loan · Already in your bills450,00 zł'])
    // A bill with the card's name but no link is not linked, and the card still gets no hint.
    await typeBill({ name: 'Visa', amount: '90' })
    await fire.click(button('Save'))
    expect(listItems('Your bills')).toEqual(['VisaOther90,00 zł'])
    expect(listItems('Debt payments already in your bills')).toHaveLength(1)
    expect(hint()).not.toContain('Visa')
    // Hide amounts still hides every amount, and the hint never had one.
    await fire.click(button('Hide amounts'))
    expect(main()).not.toMatch(/450|250|90,00/)
    expect(hint()).toContain('Student loan')
    await fire.click(button('Amounts hidden. Show amounts'))
    // Going back and forth adds no bill.
    await fire.click(button('Back'))
    await fire.click(button(/^Continue/))
    await fire.click(button(/^Continue/))
    await fire.click(stage('Bills'))
    const data = (await storedData())!
    expect(data.bills.map(bill => [bill.name, bill.debtId ?? null])).toEqual([['Car loan', data.debts[2].id], ['Visa', null]])
    expect(data.debts.map(debt => debt.monthlyPayment)).toEqual([undefined, 25000, undefined])
  })

  it('a bill that pays a card is linked by the form’s own choice; the card offered once, never two bills for it', async () => {
    await ownSpace()
    await openStage('Debts')
    await typeDebt({ kind: 'card', name: 'Visa', interest: '20', payment: '200', addBill: false })
    await fire.click(button('Add'))
    await fire.click(button(/^Continue/))
    await typeBill({ name: 'Visa payment', amount: '200', debt: 'Visa' })
    await fire.click(button('Save'))
    expect(listItems('Debt payments already in your bills')).toEqual(['Visa paymentPays Visa · Already in your bills200,00 zł'])
    expect(screen.queryByRole('list', { name: 'Your bills' })).toBeNull()
    expect(main()).not.toContain('Not in your bills yet')
    // The bill now holds the payment (counted once), as in Bills.
    const data = (await storedData())!
    expect(data.debts[0].monthlyPayment).toBeUndefined()
    expect(data.bills.map(bill => [bill.debtId, bill.amount])).toEqual([[data.debts[0].id, 20000]])
    // The card is no longer offered for another bill.
    await fire.click(button('Add a Bill'))
    await fire.click(button('More details'))
    const options = [...(field('Pays a card or loan') as unknown as HTMLSelectElement).options].map(option => option.textContent)
    expect(options).toEqual(['None'])
    await fire.click(stage('Debts'))
    expect(listItems('Your debts')).toEqual(['VisaCredit Card · Already in your billsNot entered'])
  })
})

describe('Unsaved changes in the Debts and Bills forms', () => {
  it('Back, Skip for now, the stage list, a tab and Close ask first; Keep Editing keeps it; Discard and Leave moves once', async () => {
    await ownSpace()
    await openStage('Debts')
    // An untouched form asks nothing.
    await fire.click(button('Add a Debt'))
    await fire.click(button('Back'))
    expect(question()).toBeNull()
    expect(title()).toBe('Income')
    await fire.click(button(/^Skip for now/))
    await typeDebt({ name: 'Car loan', interest: '5' })
    for (const move of [() => button('Back'), () => button('Skip for now'), () => button('I don’t have any debts'), () => stage('Accounts'), () => tab('Home'), () => button('Close Getting Started')]) {
      await fire.click(move())
      expect(text(question())).toContain('Add card or loan')
      await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
      expect(question()).toBeNull()
      expect(title()).toBe('Debts')
      expect(field('Name').value).toBe('Car loan')
      expect(field('Yearly Interest (%)').value).toBe('5')
    }
    await fire.click(button('Skip for now'))
    await fire.click(within(question()!).getByRole('button', { name: 'Discard and Leave' }))
    await moves()
    expect(title()).toBe('Bills & Subscriptions')
    await fire.click(button('Back'))
    expect(title()).toBe('Debts')
    expect(screen.queryByRole('group', { name: 'Add a Debt' })).toBeNull()
    expect((await storedData())!.debts).toEqual([])
  })

  it('the bill form asks first too, also on the browser Back button', async () => {
    await ownSpace()
    await openStage('Bills & Subscriptions')
    await typeBill({ name: 'Rent', amount: '2100' })
    await fire.click(stage('Debts'))
    expect(text(question())).toContain('Add Bill')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    expect(field('Bill name').value).toBe('Rent')
    act(() => window.history.back())
    await moves()
    expect(text(question())).toContain('Add Bill')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    await moves()
    expect(shownScreen()).toBe('guide')
    expect(field('Amount (PLN)').value).toBe('2100')
  })

  it('while a save is under way, Skip for now waits for it and never drops what is being saved', async () => {
    const held = heldStore()
    await ownSpace({ store: held.store })
    await openStage('Debts')
    await typeDebt({ name: 'Car loan', interest: '5' })
    held.hold()
    await act(async () => { button('Add').click() })
    await act(async () => { button('Skip for now').click() })
    expect(question()).toBeNull()
    expect(title()).toBe('Debts')
    await held.release()
    await settle()
    await moves()
    expect(question()).toBeNull()
    expect(title()).toBe('Bills & Subscriptions')
    expect((await storedData())!.debts.map(debt => debt.name)).toEqual(['Car loan'])
  })
})

describe('Hide amounts on Debts and Bills', () => {
  it('hides balances and bill amounts, on screen and for screen readers, keeps Unknown and Not entered, and shows them again', async () => {
    await ownSpace()
    await openStage('Debts')
    await typeDebt({ name: 'Car loan', balance: '12345', interest: '5', payment: '678' })
    await fire.click(button('Add'))
    await fire.click(button('Hide amounts'))
    const debt = within(screen.getByRole('list', { name: 'Your debts' })).getByRole('listitem')
    expect(text(debt)).toBe('Car loanLoan · Already in your bills••••amount hidden')
    expect(main()).not.toMatch(/12345|12 345|678/)
    // A save while hidden says nothing about amounts; a balance not entered still says so.
    await typeDebt({ kind: 'card', name: 'Visa', interest: '0' })
    await fire.click(button('Add'))
    expect(main()).toContain('Debt added.')
    expect(main()).toContain('Not entered')
    expect(main()).not.toMatch(/12345|12 345|678/)
    await fire.click(button(/^Continue/))
    await typeBill({ name: 'Rent', amount: '2468' })
    // What is typed stays visible, so it can be checked.
    expect(field('Amount (PLN)').value).toBe('2468')
    await fire.click(button('Save'))
    await typeBill({ name: 'Water', unknown: true })
    await fire.click(button('Save'))
    expect(listItems('Your bills')).toEqual(['RentOther••••amount hidden', 'WaterOtherUnknown'])
    expect(listItems('Debt payments already in your bills')).toEqual(['Car loanPays Car loan · Already in your bills••••amount hidden'])
    expect(main()).not.toMatch(/2468|2 468|678|12 345/)
    await fire.click(button('Amounts hidden. Show amounts'))
    expect(listItems('Your bills')).toEqual(['RentOther2468,00 zł', 'WaterOtherUnknown'])
    await fire.click(stage('Debts'))
    expect(listItems('Your debts')[0]).toBe('Car loanLoan · Already in your bills12 345,00 zł')
  })
})

describe('Outside Getting Started and in the demo', () => {
  it('Add Card or Loan in Money and Add Bill in Bills still open their own screens and never Getting Started', async () => {
    await ownSpace()
    await fire.click(tab('Money'))
    await openMoneyBlock('Cards & Loans')
    await fire.click(button(/Add Card or Loan/))
    expect(shownScreen()).toBe('debt')
    expect(title()).toBe('Add Card or Loan')
    await fire.change(field('Name'), { target: { value: 'Car loan' } })
    await fire.change(field('Yearly Interest (%)'), { target: { value: '5' } })
    await fire.change(field('Payment Due Day'), { target: { value: '15' } })
    await fire.click(button('Add'))
    // As before: the new card or loan's own screen.
    expect(shownScreen()).toBe('debt')
    expect(title()).toBe('Car loan')
    await fire.click(tab('Bills'))
    await fire.click(button(/^Add Bill/))
    expect(shownScreen()).toBe('bill')
    await fire.click(button('Cancel'))
    await moves()
    expect(shownScreen()).toBe('bills')
  })

  it('in the demo, the stages work and keep nothing; two quick taps on Add in Money add one card or loan', async () => {
    const storage = memoryStorage()
    render(<App getToday={() => TODAY} storage={storage} />)
    await settle()
    await fire.click(button('Explore the App'))
    await fire.click(button('Settings'))
    await fire.click(button('Open Help & Guide'))
    await fire.click(button('Open Getting Started'))
    await fire.click(stage('Debts'))
    const before = listItems('Your debts').length
    await typeDebt({ name: 'Demo loan', interest: '3' })
    await fire.click(button('Add'))
    expect(listItems('Your debts')).toHaveLength(before + 1)
    expect(main()).toContain('Debt added.')
    await fire.click(stage('Bills'))
    await typeBill({ name: 'Demo bill', amount: '10' })
    await fire.click(button('Save'))
    expect(listItems('Your bills').some(item => item.startsWith('Demo bill'))).toBe(true)
    expect(storedKeys(storage).some(key => key.includes('getting-started'))).toBe(false)
    expect(await storedData()).toBeNull()
    // The demo keeps changes in memory at once: the form's own guard stops a second tap from adding a second one.
    await fire.click(button('Close Getting Started'))
    await moves()
    await fire.click(tab('Money'))
    await openMoneyBlock('Cards & Loans')
    const cards = () => within(screen.getByRole('list', { name: 'Cards and loans' })).getAllByRole('listitem').length
    const count = cards()
    await fire.click(button(/Add Card or Loan/))
    await fire.change(field('Name'), { target: { value: 'Twice' } })
    await fire.change(field('Yearly Interest (%)'), { target: { value: '5' } })
    await fire.change(field('Payment Due Day'), { target: { value: '5' } })
    const add = button('Add')
    fireEvent.click(add)
    fireEvent.click(add)
    await settle()
    await fire.click(button('Back'))
    await moves()
    expect(cards()).toBe(count + 1)
  })
})
