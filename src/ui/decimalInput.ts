/**
 * Reads a typed decimal amount, e.g. '12345.67', '12.345,67', '12,345.67'
 * or '9,49'. Returns NaN for anything malformed: it never guesses.
 */
export function parseDecimalInput(raw: string): number {
  const text = raw.trim().replace(/\s/g, '').replace(/\u00a0/g, '')
  if (!text || !/^[0-9.,]+$/.test(text)) return NaN
  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  const separator = Math.max(comma, dot)
  if (separator < 0) return /^\d+$/.test(text) ? Number(text) : NaN
  const fractional = text.slice(separator + 1)
  const integer = text.slice(0, separator)
  const decimalChar = text[separator]
  const groupingChar = decimalChar === ',' ? '.' : ','
  if (!/^\d{1,2}$/.test(fractional)) return NaN
  if (!(new RegExp(`^\\d+$`).test(integer) || new RegExp(`^\\d{1,3}(\\${groupingChar}\\d{3})+$`).test(integer))) return NaN
  const normalized = integer.replaceAll(groupingChar, '') + '.' + fractional
  return Number(normalized)
}
