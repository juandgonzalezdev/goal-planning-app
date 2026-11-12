// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedChanges, useUnsavedRegistry, UnsavedChangesContext } from '../../app/unsavedChanges'
import { createAlexDemo } from '../../data/fixtures/demoAlex'
import type { FinanceData } from '../../domain/finance/types'
import { AccountForm } from './AccountForm'
import { accountFormTitle, accountTypedFields, editAccountDraft, newAccountDraft, prepareAccountSave, type AccountDraft } from './accountDraft'
import { IncomeSourceForm } from './IncomeSourceForm'
import { editIncomeDraft, incomeFormTitle, incomeTypedFields, newIncomeDraft, prepareIncomeSave, type IncomeSourceDraft } from './incomeDraft'

// GS-2: the Account and Income forms on their own, outside Money (no Money blocks, no navigation), as
// Getting Started will use them; and their drafts and checks, which Money and Getting Started share.
afterEach(() => { cleanup() })

const TODAY = '2026-10-25'
const alex = createAlexDemo()
const person = alex.space.members[0].id
const empty: FinanceData = { ...alex, incomeSources: [], income: [], moneyAccounts: [], balances: [], expenses: [], transfers: [], billMonths: [], goalMovements: [] }
const duo: FinanceData = { ...empty, space: { ...empty.space, mode: 'duo', members: [...empty.space.members, { id: 'second', name: 'Sam', color: '#000000' }] } }
const ids = () => { let next = 0; return vi.fn(() => `id-${++next}`) }
const applied = <T,>(result: { error: string } | { apply: (data: FinanceData) => T }, data: FinanceData) => {
  if ('error' in result) throw new Error(result.error)
  return result.apply(data)
}

describe('Account draft (accountDraft.ts)', () => {
  it('starts as Money did: Savings, no balance, dated today; Edit has the name and kind only', () => {
    expect(newAccountDraft(TODAY)).toEqual({ id: null, name: '', kind: 'savings', balance: '', asOf: TODAY })
    const account = alex.moneyAccounts[0]
    expect(editAccountDraft(account, TODAY)).toEqual({ id: account.id, name: account.name, kind: account.kind, balance: '', asOf: TODAY })
    expect(accountFormTitle(null)).toBe('Add account')
    expect(accountFormTitle(newAccountDraft(TODAY))).toBe('Add account')
    expect(accountFormTitle(editAccountDraft(account, TODAY))).toBe('Edit account')
    expect(accountTypedFields(null)).toBeNull()
    expect(accountTypedFields({ ...newAccountDraft(TODAY), name: 'Bank' })).toEqual({ 'Name': 'Bank', 'Kind': 'savings', 'Balance': '', 'As of': TODAY })
  })

  it('an empty balance records nothing; 0 is a balance; nothing else changes', () => {
    const newId = ids()
    const none = applied(prepareAccountSave(empty, { ...newAccountDraft(TODAY), name: 'Shoebox' }, { today: TODAY, owner: person, newId }), empty)!
    expect(none.moneyAccounts).toEqual([{ id: 'id-1', kind: 'savings', name: 'Shoebox', owner: person, currency: empty.space.currency }])
    expect(none.balances).toEqual([])
    const zero = applied(prepareAccountSave(empty, { ...newAccountDraft(TODAY), name: 'Wallet', balance: '0' }, { today: TODAY, owner: 'shared', newId: ids() }), empty)!
    expect(zero.moneyAccounts[0].owner).toBe('shared')
    expect(zero.balances).toEqual([{ id: 'id-2', accountId: 'id-1', asOf: TODAY, amount: 0, currency: empty.space.currency, source: 'entered' }])
    expect({ ...zero, moneyAccounts: empty.moneyAccounts, balances: empty.balances }).toEqual(empty)
  })

  it('returns the same messages, and takes no id until the balance and date are valid', () => {
    const newId = ids()
    const context = { today: TODAY, owner: person, newId }
    expect(prepareAccountSave(empty, { ...newAccountDraft(TODAY), name: 'Bank', balance: 'abc' }, context)).toEqual({ error: 'Enter a balance such as 820, or leave it empty.' })
    expect(prepareAccountSave(empty, { ...newAccountDraft(TODAY), name: 'Bank', balance: '1', asOf: '2026-10-26' }, context)).toEqual({ error: 'Choose a balance date that is not after today.' })
    expect(prepareAccountSave(empty, { ...newAccountDraft(TODAY), name: 'Bank', balance: '1', asOf: '' }, context)).toEqual({ error: 'Choose a balance date that is not after today.' })
    expect(newId).not.toHaveBeenCalled()
    expect(prepareAccountSave(empty, newAccountDraft(TODAY), context)).toEqual({ error: 'Enter a name (40 characters or fewer). A savings account used by goal movements must stay a savings account.' })
    // A date in the future does not matter when no balance is typed.
    expect('apply' in prepareAccountSave(empty, { ...newAccountDraft(TODAY), name: 'Bank', asOf: '2030-01-01' }, context)).toBe(true)
  })

  it('Edit keeps the owner and the balances; balance fields are ignored', () => {
    const account = alex.moneyAccounts[0]
    const draft = { ...editAccountDraft(account, TODAY), name: 'Renamed', balance: '999' }
    const next = applied(prepareAccountSave(alex, draft, { today: TODAY, owner: 'someone-else', newId: ids() }), alex)!
    expect(next.moneyAccounts.find(a => a.id === account.id)).toMatchObject({ name: 'Renamed', owner: account.owner })
    expect(next.balances).toBe(alex.balances)
  })
})

describe('Income draft (incomeDraft.ts)', () => {
  it('starts as Money did, and Edit shows what the source has', () => {
    expect(newIncomeDraft('2026-10')).toEqual({ id: null, name: '', amount: '', payDay: '', startMonth: '2026-10', endMonth: '' })
    const source = alex.incomeSources[0]
    expect(editIncomeDraft(source)).toMatchObject({ id: source.id, name: source.name, payDay: String(source.payDay), startMonth: source.startMonth, endMonth: source.endMonth ?? '' })
    expect(incomeFormTitle(null)).toBe('Add income')
    expect(incomeFormTitle(editIncomeDraft(source))).toBe('Edit income')
    expect(incomeTypedFields(null)).toBeNull()
    expect(incomeTypedFields({ ...newIncomeDraft('2026-10'), name: 'Salary' })).toEqual({ 'Name': 'Salary', 'Usual amount': '', 'Pay day': '', 'Start month': '2026-10', 'End month': '' })
  })

  it('needs an amount (0 is one), a name, a pay day from 1 to 31 and months in order', () => {
    const context = { owner: person, newId: ids() }
    const draft = { ...newIncomeDraft('2026-10'), name: 'Salary', amount: '4000,50', payDay: '10' }
    expect(prepareIncomeSave(empty, { ...draft, amount: '' }, context)).toEqual({ error: 'Enter the usual net amount, such as 6500.' })
    expect(context.newId).not.toHaveBeenCalled()
    const months = 'Check the name, the pay day (1 to 31) and the months.'
    expect(prepareIncomeSave(empty, { ...draft, name: ' ' }, context)).toEqual({ error: months })
    expect(prepareIncomeSave(empty, { ...draft, payDay: '0' }, context)).toEqual({ error: months })
    expect(prepareIncomeSave(empty, { ...draft, payDay: '32' }, context)).toEqual({ error: months })
    expect(prepareIncomeSave(empty, { ...draft, endMonth: '2026-09' }, context)).toEqual({ error: months })
    const next = applied(prepareIncomeSave(empty, { ...draft, amount: '0' }, { owner: person, newId: ids() }), empty)
    expect(next.incomeSources).toEqual([{ id: 'id-1', memberId: person, name: 'Salary', amount: 0, currency: empty.space.currency, payDay: 10, startMonth: '2026-10', endMonth: null }])
    // Nothing is recorded as received, and nothing else changes.
    expect({ ...next, incomeSources: [] }).toEqual(empty)
  })

  it('a new income in a Duo space is the first person\'s; an edited one keeps its person', () => {
    const draft = { ...newIncomeDraft('2026-10'), name: 'Salary', amount: '3000', payDay: '1' }
    const added = applied(prepareIncomeSave(duo, draft, { owner: 'shared', newId: ids() }), duo)
    expect(added.incomeSources.map(source => source.memberId)).toEqual([duo.space.members[0].id])
    const theirs = { ...added, incomeSources: added.incomeSources.map(source => ({ ...source, memberId: 'second' })) }
    const edited = applied(prepareIncomeSave(theirs, { ...editIncomeDraft(theirs.incomeSources[0]), name: 'Pay' }, { owner: 'shared', newId: ids() }), theirs)
    expect(edited.incomeSources.map(source => [source.name, source.memberId])).toEqual([['Pay', 'second']])
  })
})

/** A host outside Money: it keeps the draft and registers it, as Money does and Getting Started will. */
function AccountHost({ onSave, onCancel }: { onSave: (draft: AccountDraft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<AccountDraft>(newAccountDraft(TODAY))
  const form = useUnsavedChanges(accountFormTitle(draft), accountTypedFields(draft))
  return <>
    <p data-testid="modified">{String(form.modified)}</p>
    <AccountForm draft={draft} onDraftChange={setDraft} currency="PLN" today={TODAY} saving={false} blocked={false} onSave={() => onSave(draft)} onCancel={onCancel} />
  </>
}

function IncomeHost({ onSave }: { onSave: (draft: IncomeSourceDraft) => void }) {
  const [draft, setDraft] = useState<IncomeSourceDraft>({ ...newIncomeDraft('2026-10'), error: 'Old message' })
  const form = useUnsavedChanges(incomeFormTitle(draft), incomeTypedFields(draft))
  return <>
    <p data-testid="modified">{String(form.modified)}</p>
    <IncomeSourceForm draft={draft} onDraftChange={setDraft} currency="EUR" saving blocked onSave={() => onSave(draft)} onCancel={() => undefined} />
  </>
}

function Registry({ children, onRegistry }: { children: React.ReactNode; onRegistry: (registry: ReturnType<typeof useUnsavedRegistry>) => void }) {
  const unsaved = useUnsavedRegistry()
  onRegistry(unsaved)
  return <UnsavedChangesContext.Provider value={unsaved.registry}>{children}</UnsavedChangesContext.Provider>
}

describe('The forms outside Money', () => {
  it('AccountForm mounts without Money, reports typed changes, and Save and Cancel only call the host', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    let registry!: ReturnType<typeof useUnsavedRegistry>
    render(<Registry onRegistry={value => { registry = value }}><AccountHost onSave={onSave} onCancel={onCancel} /></Registry>)
    expect(screen.getByLabelText('Account Name')).toBeTruthy()
    expect((screen.getByLabelText('Kind') as HTMLSelectElement).value).toBe('savings')
    expect(screen.getByLabelText('Balance (PLN, optional)')).toBeTruthy()
    expect(screen.getByTestId('modified').textContent).toBe('false')
    expect(registry.hasUnsaved()).toBe(false)
    fireEvent.change(screen.getByLabelText('Account Name'), { target: { value: 'Bank' } })
    fireEvent.change(screen.getByLabelText('Balance (PLN, optional)'), { target: { value: '0' } })
    expect(screen.getByTestId('modified').textContent).toBe('true')
    expect(registry.typedText()).toContain('Bank')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save Account' }))
    expect(onSave).toHaveBeenCalledWith({ id: null, name: 'Bank', kind: 'savings', balance: '0', asOf: TODAY, error: undefined })
  })

  it('IncomeSourceForm mounts without Money, with its labels, Saving… and a blocked Save; typing clears the message, months do not', () => {
    const onSave = vi.fn()
    render(<IncomeHost onSave={onSave} />)
    expect(screen.getByLabelText('Usual Net Amount per Month (EUR)')).toBeTruthy()
    expect(screen.getByText('Day of the month it usually arrives.')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Saving…' })
    expect(save.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('Old message')
    fireEvent.change(screen.getByLabelText('Last Month (optional)'), { target: { value: '2026-12' } })
    expect(screen.getByRole('alert').textContent).toBe('Old message')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Salary' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('modified').textContent).toBe('true')
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Salary', endMonth: '2026-12' }))
  })

  it('Edit forms show no balance fields', () => {
    const account = alex.moneyAccounts[0]
    render(<AccountForm draft={editAccountDraft(account, TODAY)} onDraftChange={() => undefined} currency="PLN" today={TODAY} saving={false} blocked={false} onSave={() => undefined} onCancel={() => undefined} />)
    expect((screen.getByLabelText('Account Name') as HTMLInputElement).value).toBe(account.name)
    expect(screen.queryByLabelText(/^Balance/)).toBeNull()
  })
})
