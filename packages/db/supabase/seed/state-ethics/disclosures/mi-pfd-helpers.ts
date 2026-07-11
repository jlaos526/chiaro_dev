const MI_PFD_BASE = 'https://www.michigan.gov/sos/0,4670,7-127-1633_8722_56081-PFDDR-reports'

export interface ParsedMiPfdLineItem {
  income_source: string
  income_kind: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
}

/**
 * Build the MI PFD PDF URL for a legislator + filing year.
 *
 * Per slice 12 audit + slice 19 design: pattern is
 * michigan.gov/sos/.../<Lastname>-<Firstname>-PFDDR-<year>.pdf.
 * Audit-derived; implementer should verify against 2-3 real URLs
 * during scaffold and adjust MI_PFD_BASE constant if SOS portal
 * IDs change.
 *
 * Multi-word names: first word = firstname, last word = lastname
 * (collapses middle names — typical SOS convention).
 *
 * Single-word names: returns empty string. Downstream fetch will
 * fail; legislator silently skipped.
 *
 * Accented characters folded via NFD normalization (slice 18 audit
 * Bug 1 lesson — "José" → "Jose").
 */
export function deriveMiPfdUrl(legislator: { full_name: string }, year: number): string {
  const normalized = legislator.full_name
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return ''

  const firstName = parts[0]!
  const lastName = parts[parts.length - 1]!
  return `${MI_PFD_BASE}/${year}/one/${lastName}-${firstName}-PFDDR-${year}.pdf`
}

const INCOME_KIND_PATTERNS: Array<[RegExp, ParsedMiPfdLineItem['income_kind']]> = [
  [/\b(salary|wages|compensation)\b/i, 'salary'],
  [/\b(consulting|consultant|advisory|honorarium)\b/i, 'consulting'],
  [/\b(royalt(y|ies))\b/i, 'royalty'],
  [/\b(rental|rent income)\b/i, 'rental'],
  [/\b(dividends?|interest)\b/i, 'dividend'],
]

/**
 * Classify a free-text income source into one of the canonical
 * income_kind enum values. Falls back to 'other' for unrecognized
 * patterns.
 */
export function classifyIncomeKind(text: string): ParsedMiPfdLineItem['income_kind'] {
  for (const [pattern, kind] of INCOME_KIND_PATTERNS) {
    if (pattern.test(text)) return kind
  }
  return 'other'
}

// Amount range: "$X - $Y" or "$X – $Y" or "$X — $Y" (hyphen, en-dash, em-dash)
const AMOUNT_RANGE_RE = /\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/
const LESS_THAN_RE = /less than \$?([\d,]+)/i

function parseAmount(numStr: string): number {
  return Number.parseInt(numStr.replace(/,/g, ''), 10)
}

/**
 * Parse a MI PFD form's extracted text into income line items.
 *
 * Audit-derived strategy: section walker over "Sources of Income"
 * lines. Each numbered line "N. Source description: $X - $Y" emits
 * one ParsedMiPfdLineItem. Lines lacking a recognizable amount range
 * are skipped (silent — operator monitors production parse rate).
 *
 * v1 regex is conservative; iterates per production-run drift.
 */
export function parseMiPfdText(text: string): ParsedMiPfdLineItem[] {
  if (!text || text.trim().length === 0) return []
  if (!/sources of income/i.test(text)) return []

  const out: ParsedMiPfdLineItem[] = []
  // Split into "1. ..." numbered entries within the Sources of Income block.
  const lines = text.split('\n').map((l) => l.trim())
  for (const line of lines) {
    if (!/^\d+\.\s/.test(line)) continue

    // Extract income source (before first colon or amount-range marker)
    const sourceMatch = line.match(/^\d+\.\s+(.+?)(?::|less than|\$|\s[-–—]\s)/i)
    if (!sourceMatch) continue
    const income_source = sourceMatch[1]!.trim()
    if (!income_source) continue

    const income_kind = classifyIncomeKind(income_source)

    // Try "Less than $X" form first
    const lessThanMatch = line.match(LESS_THAN_RE)
    if (lessThanMatch) {
      const high = parseAmount(lessThanMatch[1]!)
      if (Number.isFinite(high)) {
        out.push({ income_source, income_kind, amount_range_low: 0, amount_range_high: high })
        continue
      }
    }

    // Try standard range form "$X - $Y"
    const rangeMatch = line.match(AMOUNT_RANGE_RE)
    if (rangeMatch) {
      const low = parseAmount(rangeMatch[1]!)
      const high = parseAmount(rangeMatch[2]!)
      if (Number.isFinite(low) && Number.isFinite(high)) {
        out.push({ income_source, income_kind, amount_range_low: low, amount_range_high: high })
      }
    }

    // No parseable amount → skip this line (audit lesson: silent skip)
  }

  return out
}
