/**
 * A very small PDF writer for the report: A4 pages, the two standard
 * Helvetica fonts (every PDF reader has them, so nothing is embedded),
 * text, lines and filled rectangles. That is all the report needs, so no
 * library is added.
 *
 * The standard fonts only have the WinAnsi characters, so other letters
 * are written without their accents (ł → l, ś → s) and a few signs are
 * replaced (− → -, → → ->). Streams are not compressed: the file stays
 * small and its text can be checked in tests.
 */

export const PAGE_WIDTH = 595.28
export const PAGE_HEIGHT = 841.89

export type Rgb = readonly [number, number, number]

// Advance widths of Helvetica and Helvetica-Bold (1000 units per em) for the characters 32–126, from the Adobe metrics.
const REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
  667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556,
  500, 722, 500, 500, 500, 334, 260, 334, 584]
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
  667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611,
  556, 778, 556, 556, 500, 389, 280, 389, 584]

// WinAnsi codes above 127 the report uses, with their widths [regular, bold].
const SPECIAL: Record<string, [number, number, number]> = {
  '€': [0x80, 556, 556], '…': [0x85, 1000, 1000], '‘': [0x91, 222, 278], '’': [0x92, 222, 278], '“': [0x93, 333, 500], '”': [0x94, 333, 500],
  '•': [0x95, 350, 350], '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '×': [0xd7, 584, 584], '÷': [0xf7, 584, 584], '·': [0xb7, 278, 278],
  '°': [0xb0, 400, 400], ' ': [0xa0, 278, 278],
}
const REPLACE: Record<string, string> = {
  'ł': 'l', 'Ł': 'L', 'ś': 's', 'Ś': 'S', 'ą': 'a', 'Ą': 'A', 'ę': 'e', 'Ę': 'E', 'ć': 'c', 'Ć': 'C', 'ń': 'n', 'Ń': 'N', 'ź': 'z', 'Ź': 'Z',
  'ż': 'z', 'Ż': 'Z', '−': '-', '→': '->', '←': '<-', '≈': '~', ' ': ' ', ' ': ' ', '✓': 'v', '○': 'o',
}

/** The text as the standard fonts can show it: every character becomes ASCII or a WinAnsi special. */
export function toWinAnsi(text: string): string {
  let out = ''
  for (const char of text) {
    if (REPLACE[char] !== undefined) { out += REPLACE[char]; continue }
    const code = char.codePointAt(0)!
    if ((code >= 32 && code <= 126) || SPECIAL[char]) { out += char; continue }
    if (code >= 0xa0 && code <= 0xff) { out += char; continue }
    // Letters with accents lose them (é → e); anything else becomes '?'.
    const plain = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
    out += /^[\x20-\x7e]+$/.test(plain) ? plain : '?'
  }
  return out
}

export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? BOLD : REGULAR
  let units = 0
  for (const char of toWinAnsi(text)) {
    const code = char.codePointAt(0)!
    if (code >= 32 && code <= 126) units += table[code - 32]
    else if (SPECIAL[char]) units += SPECIAL[char][bold ? 2 : 1]
    else units += 556
  }
  return (units * size) / 1000
}

/** A PDF string literal: escaped, and with every character above 127 as an octal byte. */
function pdfString(text: string): string {
  let out = '('
  for (const char of toWinAnsi(text)) {
    const code = SPECIAL[char]?.[0] ?? char.codePointAt(0)!
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`
    else if (code < 32 || code > 126) out += `\\${code.toString(8).padStart(3, '0')}`
    else out += char
  }
  return `${out})`
}

const num = (value: number) => (Math.round(value * 100) / 100).toString()
const color = ([r, g, b]: Rgb) => `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`

export interface TextOptions { size?: number; bold?: boolean; color?: Rgb; align?: 'left' | 'right' | 'center' }

/** Pages of drawing commands. Coordinates have their origin at the top left, in points (y goes down). */
export class PdfDocument {
  private pages: string[][] = []
  private current = 0
  readonly title: string

  constructor(title: string) {
    this.title = title
    this.addPage()
  }

  get pageCount() { return this.pages.length }

  addPage() { this.pages.push([]); this.current = this.pages.length - 1 }

  private get ops() { return this.pages[this.current] }

  text(x: number, y: number, text: string, { size = 10, bold = false, color: rgb = [30, 34, 40], align = 'left' }: TextOptions = {}) {
    const width = textWidth(text, size, bold)
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${color(rgb)} rg ${num(left)} ${num(PAGE_HEIGHT - y)} Td ${pdfString(text)} Tj ET`)
  }

  rect(x: number, y: number, width: number, height: number, fill: Rgb) {
    this.ops.push(`${color(fill)} rg ${num(x)} ${num(PAGE_HEIGHT - y - height)} ${num(width)} ${num(height)} re f`)
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: Rgb, width = 0.5) {
    this.ops.push(`${color(stroke)} RG ${num(width)} w ${num(x1)} ${num(PAGE_HEIGHT - y1)} m ${num(x2)} ${num(PAGE_HEIGHT - y2)} l S`)
  }

  /** Draws on every page once the number of pages is known (a footer with "Page 2 of 3"). */
  eachPage(draw: (page: number, count: number) => void) {
    const last = this.current
    for (let index = 0; index < this.pages.length; index++) {
      this.current = index
      draw(index + 1, this.pages.length)
    }
    this.current = last
  }

  /** The finished file. Every byte is ASCII, so the string length is the byte offset. */
  toString(): string {
    const objects: string[] = []
    const add = (body: string) => { objects.push(body); return objects.length }
    const catalog = add('')
    const pagesId = add('')
    const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    const kids: number[] = []
    for (const ops of this.pages) {
      const stream = ops.join('\n')
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`))
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(id => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`
    const info = add(`<< /Title ${pdfString(this.title)} /Producer (Goal Planning prototype) >>`)

    let out = '%PDF-1.4\n'
    const offsets: number[] = []
    objects.forEach((body, index) => {
      offsets.push(out.length)
      out += `${index + 1} 0 obj\n${body}\nendobj\n`
    })
    const xref = out.length
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return out
  }

  toBytes(): Uint8Array {
    const text = this.toString()
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
    return bytes
  }
}

/** Splits text into lines that fit `width` at `size`. Long words are kept whole. */
export function wrapText(text: string, width: number, size: number, bold = false): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && textWidth(next, size, bold) > width) { lines.push(line); line = word }
      else line = next
    }
    lines.push(line)
  }
  return lines
}
