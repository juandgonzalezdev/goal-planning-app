// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { describeTyped, UnsavedChangesContext, useUnsavedChanges, useUnsavedRegistry, type TypedFields } from './unsavedChanges'

describe('describeTyped', () => {
  it('lists every field that holds something, one per line, under the form name', () => {
    expect(describeTyped('Add bill', { 'Name': 'Rent', 'Amount': '1200,00', 'Note': '', 'Card': null, 'Known': false }))
      .toBe('Add bill\nName: Rent\nAmount: 1200,00\nKnown: No')
  })
})

describe('the registry of unsaved changes', () => {
  function setUp(initial: TypedFields | null, empty?: TypedFields) {
    const registry = renderHook(() => useUnsavedRegistry())
    const wrapper = ({ children }: { children: ReactNode }) =>
      <UnsavedChangesContext.Provider value={registry.result.current.registry}>{children}</UnsavedChangesContext.Provider>
    const form = renderHook(({ fields }: { fields: TypedFields | null }) => useUnsavedChanges('Add bill', fields, empty), { initialProps: { fields: initial }, wrapper })
    return { registry, form }
  }

  it('counts a form only once it differs from what it showed when it opened', () => {
    const { registry, form } = setUp({ 'Name': 'Rent' })
    expect(registry.result.current.hasUnsaved()).toBe(false)
    form.rerender({ fields: { 'Name': 'Rent!' } })
    expect(registry.result.current.hasUnsaved()).toBe(true)
    expect(registry.result.current.typedText()).toBe('Add bill\nName: Rent!')
    form.rerender({ fields: { 'Name': 'Rent' } })
    expect(registry.result.current.hasUnsaved()).toBe(false)
  })

  it('starts again from what an editor shows when it opens, and forgets it when it closes as usual', () => {
    const { registry, form } = setUp(null)
    form.rerender({ fields: { 'Amount': '10' } })
    expect(registry.result.current.hasUnsaved()).toBe(false)
    form.rerender({ fields: { 'Amount': '12' } })
    expect(registry.result.current.hasUnsaved()).toBe(true)
    form.rerender({ fields: null })
    expect(registry.result.current.hasUnsaved()).toBe(false)
  })

  it('while saving is blocked, keeps what a closed form had, marked closed, until discarded', () => {
    const { registry, form } = setUp({ 'Name': 'Rent' })
    form.rerender({ fields: { 'Name': 'Rent!' } })
    act(() => registry.result.current.setKeepClosed(true))
    form.rerender({ fields: null })
    expect(registry.result.current.forms).toEqual([expect.objectContaining({ title: 'Add bill', closed: true })])
    form.unmount()
    expect(registry.result.current.typedText()).toBe('Add bill\nName: Rent!')
    act(() => registry.result.current.discardAll())
    expect(registry.result.current.hasUnsaved()).toBe(false)
  })

  it('compares a draft the app keeps with an empty form', () => {
    const { registry, form } = setUp({ 'Name': 'Trip' }, { 'Name': '' })
    expect(registry.result.current.hasUnsaved()).toBe(true)
    form.rerender({ fields: { 'Name': '' } })
    expect(registry.result.current.hasUnsaved()).toBe(false)
  })
})
