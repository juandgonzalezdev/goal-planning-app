type IdCrypto = Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string }

/**
 * A new random id for a goal or a goal movement, in the usual UUID shape.
 *
 * `crypto.randomUUID()` only exists on secure pages (https or localhost).
 * Opening the app on a phone through the computer's network address
 * (`npm run dev -- --host`, http://192.168…) is not secure, so Safari has
 * no randomUUID there. `getRandomValues` works on every page, so it builds
 * the id when randomUUID is missing.
 */
export function newId(source: IdCrypto = globalThis.crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID()
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
