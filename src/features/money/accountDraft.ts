import { recordBalance } from '../../domain/finance/debts'
import { saveAccount } from '../../domain/finance/moneyAccounts'
import type { FinanceData, Id, MoneyAccount, MoneyAccountKind, Owner } from '../../domain/finance/types'
import type { TypedFields } from '../../app/unsavedChanges'
import { parseMoneyInput } from '../../ui/moneyInput'

/**
 * Add Account and Edit (GS-2): the draft, its starting values, its checks
 * and the change it makes, in one place for Money (Accounts & Savings) and,
 * later, Getting Started. The fields are `AccountForm.tsx`. The host keeps
 * the draft, registers it as a form with unsaved changes (`accountFormTitle`
 * and `accountTypedFields`), saves the change `prepareAccountSave` returns
 * and decides where the focus goes. Nothing here needs Money's blocks or the
 * app's navigation.
 */

/** What the form shows. `id` null: a new account, with an optional first balance. */
export type AccountDraft = { id: Id | null; name: string; kind: MoneyAccountKind; balance: string; asOf: string; error?: string }

/** A new account: Savings, no balance (not entered, never 0), dated today. */
export const newAccountDraft = (today: string): AccountDraft => ({ id: null, name: '', kind: 'savings', balance: '', asOf: today })

/** Edit: the name and kind only (balances change with Update Balance). */
export const editAccountDraft = (account: MoneyAccount, today: string): AccountDraft =>
  ({ id: account.id, name: account.name, kind: account.kind, balance: '', asOf: today })

/** The title of the form in "Leave without saving?". */
export const accountFormTitle = (draft: AccountDraft | null) => (draft?.id ? 'Edit account' : 'Add account')

/** What the form shows, for unsaved changes and Copy What I Typed (null: closed). */
export const accountTypedFields = (draft: AccountDraft | null): TypedFields | null =>
  (draft ? { 'Name': draft.name, 'Kind': draft.kind, 'Balance': draft.balance, 'As of': draft.asOf } : null)

/**
 * Checks the draft and returns the change to save, or the message to show.
 * An empty balance is "not entered" (no balance is recorded); 0 is a balance.
 * Ids are taken only once the balance and its date are valid, as before.
 */
export function prepareAccountSave(data: FinanceData, draft: AccountDraft, context: { today: string; owner: Owner; newId: () => Id }):
  { error: string } | { apply: (current: FinanceData) => FinanceData | null } {
  const balance = draft.balance.trim() === '' ? null : parseMoneyInput(draft.balance)
  if (draft.id === null && draft.balance.trim() !== '' && balance === null) return { error: 'Enter a balance such as 820, or leave it empty.' }
  if (draft.id === null && balance !== null && (!draft.asOf || draft.asOf > context.today)) return { error: 'Choose a balance date that is not after today.' }
  const id = draft.id ?? context.newId()
  const balanceId = context.newId()
  const { kind, name, asOf } = draft
  const apply = (current: FinanceData) => {
    const result = saveAccount(current, id, { kind, name, owner: current.moneyAccounts.find(a => a.id === id)?.owner ?? context.owner })
    if (result.status !== 'ok') return null
    return draft.id === null && balance !== null ? recordBalance(result.data, balanceId, id, balance, asOf) ?? result.data : result.data
  }
  if (!apply(data)) return { error: 'Enter a name (40 characters or fewer). A savings account used by goal movements must stay a savings account.' }
  return { apply }
}
