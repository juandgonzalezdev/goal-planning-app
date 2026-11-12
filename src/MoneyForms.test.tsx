// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { classicHome, memoryStorage } from './test/memoryStorage'
import { fire, settle, storedData, freshDatabaseForEachTest } from './test/space'

freshDatabaseForEachTest()

// GS-2: the Add Account and Add Income forms in Money, as the user sees them. Written before the forms
// were taken out of their sections, and run on the base too, so the same behaviour is checked before and after.
afterEach(() => { cleanup() })
beforeEach(() => { window.history.replaceState(null, '') })

const TODAY = '2026-10-25'
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const text = (element: Element | null) => (element?.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name })
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement
const regionOf = (name: string) => screen.getByRole('region', { name })
const question = () => screen.queryByRole('alertdialog') ?? screen.queryByRole('dialog')
const errors = () => [...document.querySelectorAll('.field-error')].map(element => text(element))

/** Welcome → Create Account → Welcome Setup → Money, as one person or a Duo. */
async function ownSpace(duo = false) {
  render(<App getToday={() => TODAY} storage={classicHome(memoryStorage())} />)
  await settle()
  await fire.click(button(/Create Account/))
  await fire.click(button(/Continue Without an Account/))
  await fire.change(field('Display Name'), { target: { value: 'Robin' } })
  await fire.click(button(/Continue/))
  if (duo) {
    await fire.click(screen.getByRole('radio', { name: /Duo/ }))
    await fire.change(field("Second Person's Name"), { target: { value: 'Sam' } })
  }
  await fire.click(button(/Continue/))
  await fire.click(button(/Continue/))
  await fire.click(button('Create My Space'))
  await fire.click(tab('Money'))
}

async function addAccount() {
  await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Accounts & Savings/ }))
  await fire.click(button(/Add Account/))
}

async function addIncome() {
  await fire.click(within(regionOf('Income')).getByRole('button', { name: /^Income/ }))
  await fire.click(button(/Add Income/))
}

describe('Add Account in Money', () => {
  it('opens with its defaults and the focus in the name; an empty balance is "not entered", 0 is a balance', async () => {
    await ownSpace()
    await addAccount()
    expect(document.activeElement?.id).toBe('account-name')
    expect(field('Account Name').value).toBe('')
    expect((screen.getByLabelText('Kind') as HTMLSelectElement).value).toBe('savings')
    expect(field(/^Balance \(PLN, optional\)/).value).toBe('')
    expect(field('Balance Date').value).toBe(TODAY)
    await fire.change(field('Account Name'), { target: { value: 'Shoebox' } })
    await fire.click(button('Save Account'))
    expect(screen.queryByLabelText('Account Name')).toBeNull()
    await fire.click(button(/Add Account/))
    await fire.change(field('Account Name'), { target: { value: 'Wallet' } })
    await fire.change(screen.getByLabelText('Kind'), { target: { value: 'daily-spending' } })
    await fire.change(field(/^Balance \(/), { target: { value: '0' } })
    await fire.click(button('Save Account'))
    const data = (await storedData())!
    expect(data.moneyAccounts.map(account => [account.name, account.kind, account.owner])).toEqual([['Shoebox', 'savings', data.space.members[0].id], ['Wallet', 'daily-spending', data.space.members[0].id]])
    const shoebox = data.moneyAccounts[0].id
    const wallet = data.moneyAccounts[1].id
    expect(data.balances.filter(balance => balance.accountId === shoebox)).toEqual([])
    expect(data.balances.filter(balance => balance.accountId === wallet).map(balance => [balance.amount, balance.asOf, balance.source])).toEqual([[0, TODAY, 'entered']])
    expect(text(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Shoebox/ }))).toContain('Not entered')
    expect(text(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Wallet/ }))).toContain('0,00 zł')
  })

  it('keeps the same checks and messages, and saves nothing while one fails', async () => {
    await ownSpace()
    await addAccount()
    await fire.click(button('Save Account'))
    expect(errors()).toEqual(['Enter a name (40 characters or fewer). A savings account used by goal movements must stay a savings account.'])
    await fire.change(field('Account Name'), { target: { value: 'Bank' } })
    expect(errors()).toEqual([])
    await fire.change(field(/^Balance \(/), { target: { value: 'abc' } })
    await fire.click(button('Save Account'))
    expect(errors()).toEqual(['Enter a balance such as 820, or leave it empty.'])
    await fire.change(field(/^Balance \(/), { target: { value: '820' } })
    await fire.change(field('Balance Date'), { target: { value: '2026-10-26' } })
    await fire.click(button('Save Account'))
    expect(errors()).toEqual(['Choose a balance date that is not after today.'])
    expect((await storedData())!.moneyAccounts).toEqual([])
    // What was typed is still there.
    expect(field('Account Name').value).toBe('Bank')
    expect(field(/^Balance \(/).value).toBe('820')
  })

  it('Cancel saves nothing; typed changes are protected, an untouched form is not', async () => {
    await ownSpace()
    await addAccount()
    await fire.change(field('Account Name'), { target: { value: 'Never saved' } })
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Account Name')).toBeNull()
    expect((await storedData())!.moneyAccounts).toEqual([])
    await fire.click(button(/Add Account/))
    await fire.click(tab('Home'))
    expect(question()).toBeNull()
    await fire.click(tab('Money'))
    await fire.click(button(/Add Account/))
    await fire.change(field('Account Name'), { target: { value: 'Typed' } })
    await fire.click(tab('Home'))
    expect(text(question())).toContain('Add account')
    expect(text(question())).toContain('Typed')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    expect(field('Account Name').value).toBe('Typed')
  })

  it('Edit shows the name and kind, no balance fields, and keeps the account\'s balances', async () => {
    await ownSpace()
    await addAccount()
    await fire.change(field('Account Name'), { target: { value: 'Bank' } })
    await fire.change(field(/^Balance \(/), { target: { value: '100' } })
    await fire.click(button('Save Account'))
    await fire.click(within(regionOf('Accounts & Savings')).getByRole('button', { name: /^Bank/ }))
    await fire.click(button('Edit: Bank'))
    expect(document.activeElement?.id).toBe('account-name')
    expect(field('Account Name').value).toBe('Bank')
    expect(screen.queryByLabelText(/^Balance \(/)).toBeNull()
    await fire.change(field('Account Name'), { target: { value: 'Main bank' } })
    await fire.click(tab('Home'))
    expect(text(question())).toContain('Edit account')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    await fire.click(button('Save Account'))
    const data = (await storedData())!
    expect(data.moneyAccounts.map(account => account.name)).toEqual(['Main bank'])
    expect(data.balances.map(balance => balance.amount)).toEqual([10000])
  })
})

describe('Add Income in Money', () => {
  it('opens with its defaults and the focus in the name, and saves what was typed', async () => {
    await ownSpace()
    await addIncome()
    expect(document.activeElement?.id).toBe('income-name')
    expect([field('Name').value, field(/^Usual Net Amount/).value, field('Pay Day').value, field('First Month').value, field('Last Month (optional)').value])
      .toEqual(['', '', '', '2026-10', ''])
    await fire.change(field('Name'), { target: { value: 'Salary' } })
    await fire.change(field(/^Usual Net Amount/), { target: { value: '4000,50' } })
    await fire.change(field('Pay Day'), { target: { value: '10' } })
    await fire.click(button('Save Income'))
    expect(screen.queryByLabelText('Pay Day')).toBeNull()
    const data = (await storedData())!
    expect(data.incomeSources.map(({ name, amount, payDay, startMonth, endMonth, memberId }) => ({ name, amount, payDay, startMonth, endMonth, memberId })))
      .toEqual([{ name: 'Salary', amount: 400050, payDay: 10, startMonth: '2026-10', endMonth: null, memberId: data.space.members[0].id }])
    // Nothing was recorded as received.
    expect(data.income).toEqual([])
  })

  it('keeps the same checks and messages; 0 is an amount, empty is not', async () => {
    await ownSpace()
    await addIncome()
    await fire.click(button('Save Income'))
    expect(errors()).toEqual(['Enter the usual net amount, such as 6500.'])
    await fire.change(field(/^Usual Net Amount/), { target: { value: '0' } })
    await fire.click(button('Save Income'))
    expect(errors()).toEqual(['Check the name, the pay day (1 to 31) and the months.'])
    await fire.change(field('Name'), { target: { value: 'Grant' } })
    await fire.change(field('Pay Day'), { target: { value: '32' } })
    await fire.click(button('Save Income'))
    expect(errors()).toEqual(['Check the name, the pay day (1 to 31) and the months.'])
    await fire.change(field('Pay Day'), { target: { value: '5' } })
    await fire.change(field('Last Month (optional)'), { target: { value: '2026-09' } })
    await fire.click(button('Save Income'))
    expect(errors()).toEqual(['Check the name, the pay day (1 to 31) and the months.'])
    expect((await storedData())!.incomeSources).toEqual([])
    await fire.change(field('Last Month (optional)'), { target: { value: '2026-12' } })
    await fire.click(button('Save Income'))
    expect((await storedData())!.incomeSources.map(source => [source.amount, source.endMonth])).toEqual([[0, '2026-12']])
  })

  it('Cancel saves nothing; typed changes are protected, and Edit keeps the source\'s person', async () => {
    await ownSpace()
    await addIncome()
    await fire.change(field('Name'), { target: { value: 'Typed' } })
    await fire.click(tab('Bills'))
    expect(text(question())).toContain('Add income')
    await fire.click(within(question()!).getByRole('button', { name: 'Keep Editing' }))
    await fire.click(within(regionOf('Income')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Pay Day')).toBeNull()
    expect((await storedData())!.incomeSources).toEqual([])
  })

  it('in a Duo space, a new income is still the first person\'s, as before', async () => {
    await ownSpace(true)
    await addIncome()
    await fire.change(field('Name'), { target: { value: 'Salary' } })
    await fire.change(field(/^Usual Net Amount/), { target: { value: '3000' } })
    await fire.change(field('Pay Day'), { target: { value: '1' } })
    await fire.click(button('Save Income'))
    await addAccount()
    await fire.change(field('Account Name'), { target: { value: 'Joint' } })
    await fire.click(button('Save Account'))
    const data = (await storedData())!
    expect(data.space.mode).toBe('duo')
    expect(data.incomeSources.map(source => source.memberId)).toEqual([data.space.members[0].id])
    expect(data.moneyAccounts.map(account => account.owner)).toEqual(['shared'])
  })
})
