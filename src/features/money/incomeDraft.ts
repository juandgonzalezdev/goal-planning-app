import { saveIncomeSource } from '../../domain/finance/income'
import type { FinanceData, Id, IncomeSource, Owner } from '../../domain/finance/types'
import type { TypedFields } from '../../app/unsavedChanges'
import { amountText } from '../../ui/labels'
import { parseMoneyInput } from '../../ui/moneyInput'

/**
 * Add Income and Edit (GS-2): the draft of an expected income, its starting
 * values, its checks and the change it makes, in one place for Money
 * (Income) and, later, Getting Started. The fields are `IncomeSourceForm.tsx`.
 * The host keeps the draft, registers it as a form with unsaved changes
 * (`incomeFormTitle` and `incomeTypedFields`), saves the change
 * `prepareIncomeSave` returns and decides where the focus goes. Nothing here
 * needs Money's blocks or the app's navigation.
 */

/** What the form shows. `id` null: a new income. Months are YYYY-MM; an empty last month means no end. */
export type IncomeSourceDraft = { id: Id | null; name: string; amount: string; payDay: string; startMonth: string; endMonth: string; error?: string }

/** A new income: empty, starting in `startMonth` (today's month in Money), with no end. */
export const newIncomeDraft = (startMonth: string): IncomeSourceDraft => ({ id: null, name: '', amount: '', payDay: '', startMonth, endMonth: '' })

/** Edit: what the source has now. */
export const editIncomeDraft = (source: IncomeSource): IncomeSourceDraft => ({
  id: source.id, name: source.name, amount: amountText(source.amount), payDay: String(source.payDay), startMonth: source.startMonth, endMonth: source.endMonth ?? '',
})

/** The title of the form in "Leave without saving?". */
export const incomeFormTitle = (draft: IncomeSourceDraft | null) => (draft?.id ? 'Edit income' : 'Add income')

/** What the form shows, for unsaved changes and Copy What I Typed (null: closed). */
export const incomeTypedFields = (draft: IncomeSourceDraft | null): TypedFields | null => (draft ? {
  'Name': draft.name, 'Usual amount': draft.amount, 'Pay day': draft.payDay, 'Start month': draft.startMonth, 'End month': draft.endMonth,
} : null)

/**
 * Checks the draft and returns the change to save, or the message to show.
 * The amount is required (0 is an amount). A source keeps its person when
 * edited; a new one belongs to `owner`, and in a shared space (Duo) to the
 * first person, as before (choosing the person is a later step, D-GS5).
 */
export function prepareIncomeSave(data: FinanceData, draft: IncomeSourceDraft, context: { owner: Owner; newId: () => Id }):
  { error: string } | { apply: (current: FinanceData) => FinanceData } {
  const amount = parseMoneyInput(draft.amount)
  const payDay = /^\d{1,2}$/.test(draft.payDay.trim()) ? Number(draft.payDay) : NaN
  if (amount === null) return { error: 'Enter the usual net amount, such as 6500.' }
  const id = draft.id ?? context.newId()
  const memberId = data.incomeSources.find(s => s.id === id)?.memberId ?? (context.owner === 'shared' ? data.space.members[0].id : context.owner)
  const fields = { name: draft.name, amount, payDay, startMonth: draft.startMonth, endMonth: draft.endMonth || null }
  if (saveIncomeSource(data, id, memberId, fields).status !== 'ok') return { error: 'Check the name, the pay day (1 to 31) and the months.' }
  return {
    apply: current => {
      const result = saveIncomeSource(current, id, memberId, fields)
      return result.status === 'ok' ? result.data : current
    },
  }
}
