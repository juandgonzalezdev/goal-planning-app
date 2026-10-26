import { describe, expect, it } from 'vitest'
import { ALEX_DEMO_TODAY, createAlexDemo } from '../data/fixtures/demoAlex'
import { setBillPaid } from '../domain/finance/bills'
import { createSpaceData } from '../domain/finance/space'
import { PdfDocument, textWidth, toWinAnsi, wrapText } from './pdf'
import { buildReport, pdfMoney, type ReportOptions } from './report'

const options: ReportOptions = { period: { kind: 'month', month: '2026-12' }, today: ALEX_DEMO_TODAY, generatedOn: '2026-10-26', includeAmounts: true, isDemo: true }
/** The text drawn in the file: every (string) before Tj. */
const SPECIALS: Record<number, string> = { 0x85: '…', 0x92: '’', 0x95: '•', 0x96: '–', 0x97: '—' }
const drawn = (pdf: PdfDocument) => [...pdf.toString().matchAll(/\((.*?)\) Tj/g)]
  .map(m => m[1].replace(/\\([()\\])/g, '$1').replace(/\\(\d{3})/g, (_, octal) => SPECIALS[parseInt(octal, 8)] ?? String.fromCharCode(parseInt(octal, 8))))

describe('PDF writer', () => {
  it('writes a valid file: header, objects, cross-reference table and trailer', () => {
    const pdf = new PdfDocument('Test')
    pdf.text(48, 60, 'Hello (world)')
    pdf.addPage()
    pdf.rect(10, 10, 20, 20, [0, 0, 0])
    const out = pdf.toString()
    expect(out.startsWith('%PDF-1.4\n')).toBe(true)
    expect(out.endsWith('%%EOF\n')).toBe(true)
    expect(out).toContain('/Count 2')
    expect(out).toContain('(Hello \\(world\\)) Tj')
    // Each object starts exactly where the table says.
    const table = out.slice(out.indexOf('xref\n')).split('\n').slice(3).filter(line => / n $/.test(line))
    table.forEach((line, index) => expect(out.slice(Number(line.slice(0, 10)), Number(line.slice(0, 10)) + 10)).toMatch(new RegExp(`^${index + 1} 0 obj`)))
    expect(pdf.toBytes()).toHaveLength(out.length)
  })

  it('writes Polish letters without their accents and keeps WinAnsi signs', () => {
    expect(toWinAnsi('Kraków, złoty − 5 → 6')).toBe('Kraków, zloty - 5 -> 6')
    expect(toWinAnsi('Gdańsk ✓ 日')).toBe('Gdansk v ?')
    expect(toWinAnsi('“Start” – 3 × 2 •')).toBe('“Start” – 3 × 2 •')
    expect(textWidth('ab', 10)).toBeCloseTo(11.12, 2)
    expect(wrapText('one two three four', textWidth('three four', 10), 10)).toEqual(['one two', 'three four'])
  })

  it('formats money with the currency code', () => {
    expect(pdfMoney(123_456_78, 'PLN')).toBe('PLN 123,456.78')
    expect(pdfMoney(-5, 'PLN')).toBe('PLN -0.05')
  })
})

describe('the report', () => {
  it('reflects the chosen month and its data (12)', () => {
    const text = drawn(buildReport(createAlexDemo(), options)).join(' ')
    expect(text).toContain('December 2026')
    expect(text).toContain('Alex · Currency: PLN · Records up to 31 Dec 2026 (demo date) · Generated on 26 Oct 2026')
    expect(text).toContain('PLN 7,200.00')
    expect(text).toContain('PLN 5,097.35')
    expect(text).toContain('PLN 2,102.65')
    expect(text).toContain('Phone & Internet')
    expect(text).toContain('PLN 12,266.98')
    expect(text).toMatch(/INVENTED DATA/)
    expect(text).toMatch(/It is not a bank statement or a certificate/)
    // A change in the data shows in the next report.
    const paid = drawn(buildReport(setBillPaid(createAlexDemo(), 'phone', '2026-12', true, ALEX_DEMO_TODAY), options)).join(' ')
    expect(paid).toContain('Every bill of this period is marked as paid.')
    expect(paid).toContain('PLN 5,167.34')
  })

  it('covers the whole year, with the months, the deficits and how they were covered', () => {
    const pdf = buildReport(createAlexDemo(), { ...options, period: { kind: 'year', year: 2026 } })
    const text = drawn(pdf).join(' ')
    for (const month of ['January 2026', 'June 2026', 'December 2026']) expect(text).toContain(month)
    expect(text).toContain('PLN 55,998.00')
    expect(text).toMatch(/August 2026: deficit of PLN 3,037.86, covered by PLN 1,500.00 from Savings/)
    expect(pdf.pageCount).toBeGreaterThan(1)
    // Every page has its footer, and none is almost empty.
    expect(text.match(/Page \d of \d/g)).toHaveLength(pdf.pageCount)
  })

  it('says when amounts are not included, and then shows none', () => {
    const text = drawn(buildReport(createAlexDemo(), { ...options, includeAmounts: false })).join(' ')
    expect(text).toContain('Amounts: not included.')
    expect(text).not.toMatch(/PLN -?\d/)
    expect(text).not.toMatch(/\d+\.\d%/)
  })

  it('does not call an own space invented, and lists what is missing', () => {
    const own = createSpaceData({ mode: 'individual', names: ['Robin'], currency: 'EUR', theme: 'light' })
    if (own.status !== 'created') throw new Error('invalid')
    const text = drawn(buildReport(own.data, { ...options, today: '2026-10-21', period: { kind: 'month', month: '2026-10' }, isDemo: false })).join(' ')
    expect(text).not.toMatch(/INVENTED/)
    expect(text).toContain('Currency: EUR')
    expect(text).toContain('No spending is recorded for this period.')
    expect(text).toContain('It is not a bank statement or a certificate')
  })
})
