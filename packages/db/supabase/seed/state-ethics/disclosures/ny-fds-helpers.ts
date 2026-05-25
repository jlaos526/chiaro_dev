import { classifyIncomeKind } from './mi-pfd-helpers.ts'

export interface ParsedNyFdsLineItem {
  income_source: string
  income_kind: 'salary' | 'consulting' | 'royalty' | 'rental' | 'dividend' | 'other'
  amount_range_low?: number
  amount_range_high?: number
}

// Amount range patterns: "$X - $Y" / "$X – $Y" / "$X — $Y"
const AMOUNT_RANGE_RE = /\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/
const LESS_THAN_RE = /less than \$?([\d,]+)/i
const OVER_RE = /over \$?([\d,]+)/i

const SECTION_HEADER_RE = /^(sources of income|schedule of income|part iii\.?\s*schedule of income)/i

function parseAmount(numStr: string): number {
  return Number.parseInt(numStr.replace(/,/g, ''), 10)
}

/**
 * Parse a NY FDS form's extracted text into income line items.
 *
 * Audit-derived strategy: section walker over "Sources of Income"
 * or "Schedule of Income" lines. Each numbered line "N. Source
 * description: <amount form>" emits one ParsedNyFdsLineItem.
 *
 * Amount forms supported: "$X - $Y", "Less than $X", "Over $X"
 * (open-ended upper bound), plus en-dash + em-dash separator
 * variants.
 *
 * Lines lacking a recognizable amount range are skipped (silent —
 * operator monitors production parse rate; regex iterates with drift).
 *
 * Reuses classifyIncomeKind from slice 19 mi-pfd-helpers.ts (same
 * pure-regex keyword classifier; rule-of-three trigger not yet hit).
 *
 * Slice 20 fill pattern: emits N rows per filing in addition to
 * the slice 17 placeholder row. Both coexist via distinct
 * external_id (filing-{id} vs filing-{id}-{lineNo}).
 */
export function parseNyFdsText(text: string): ParsedNyFdsLineItem[] {
  if (!text || text.trim().length === 0) return []

  // Section header detection: split into blocks, find the Sources/Schedule
  // of Income block, walk numbered lines within it.
  const lines = text.split('\n').map(l => l.trim())
  let inIncomeSection = false
  const out: ParsedNyFdsLineItem[] = []

  for (const line of lines) {
    if (SECTION_HEADER_RE.test(line)) {
      inIncomeSection = true
      continue
    }
    if (!inIncomeSection) continue
    if (!/^\d+\.\s/.test(line)) continue

    // Extract income source: text after "N. " up to amount marker
    const sourceMatch = line.match(/^\d+\.\s+(.+?)(?::|less than|over|\$|\s[-–—]\s)/i)
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

    // Try "Over $X" open-ended form
    const overMatch = line.match(OVER_RE)
    if (overMatch) {
      const low = parseAmount(overMatch[1]!)
      if (Number.isFinite(low)) {
        out.push({ income_source, income_kind, amount_range_low: low })
        continue
      }
    }

    // Try standard range "$X - $Y"
    const rangeMatch = line.match(AMOUNT_RANGE_RE)
    if (rangeMatch) {
      const low = parseAmount(rangeMatch[1]!)
      const high = parseAmount(rangeMatch[2]!)
      if (Number.isFinite(low) && Number.isFinite(high)) {
        out.push({ income_source, income_kind, amount_range_low: low, amount_range_high: high })
        continue
      }
    }

    // No parseable amount → skip
  }

  return out
}
