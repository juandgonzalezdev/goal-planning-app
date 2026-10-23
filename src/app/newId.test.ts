import { describe, expect, it } from 'vitest'
import { newId } from './newId'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('uses randomUUID when the page has it', () => {
    expect(newId({ randomUUID: () => 'from-random-uuid', getRandomValues: array => array })).toBe('from-random-uuid')
  })

  // Regression: on http://<computer address> (not a secure page) Safari has no
  // randomUUID, so saving a contribution or creating a goal used to fail silently.
  it('still makes a valid, different id on a page without randomUUID', () => {
    const insecure = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) }
    const ids = new Set(Array.from({ length: 200 }, () => newId(insecure)))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(UUID)
  })

  it('works with the browser crypto as it is', () => {
    expect(newId()).toMatch(UUID)
  })
})
