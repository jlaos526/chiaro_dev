import type {
  NormalizedDisclosureOther,
  NormalizedHolding,
  NormalizedPtr,
} from './types.ts'

const AMOUNT_RANGE_RE =
  /\$?([\d,]+)(?:\.\d{2})?\s*[-–to]+\s*\$?([\d,]+)(?:\.\d{2})?/i

const OVER_RE = /Over\s+\$?([\d,]+)/i
const LESS_THAN_RE = /Less\s+than\s+\$?([\d,]+)/i

export function classifyAmountRange(text: string): { min?: number; max?: number; text: string } {
  const trimmed = text.trim()
  const m = AMOUNT_RANGE_RE.exec(trimmed)
  if (m) {
    return {
      min: Number(m[1]!.replace(/,/g, '')),
      max: Number(m[2]!.replace(/,/g, '')),
      text: trimmed,
    }
  }
  const over = OVER_RE.exec(trimmed)
  if (over) return { min: Number(over[1]!.replace(/,/g, '')), text: trimmed }
  const less = LESS_THAN_RE.exec(trimmed)
  if (less) return { max: Number(less[1]!.replace(/,/g, '')), text: trimmed }
  return { text: trimmed }
}

const TXN_TYPE_MAP: Record<string, 'purchase' | 'sale' | 'exchange'> = {
  'P': 'purchase', 'PURCHASE': 'purchase', 'BUY': 'purchase',
  'S': 'sale',     'SALE':     'sale',     'D':   'sale',    'DISPOSITION': 'sale',
  'E': 'exchange', 'EXCHANGE': 'exchange',
}

export function classifyTransactionType(marker: string): 'purchase' | 'sale' | 'exchange' | null {
  return TXN_TYPE_MAP[marker.trim().toUpperCase()] ?? null
}

const ASSET_CODE_MAP: Record<string, NonNullable<NormalizedHolding['asset_type']>> = {
  'ST':  'stock',
  'GS':  'stock',           // government stock variants
  'CS':  'stock',
  'MF':  'mutual_fund',
  'EF':  'etf',
  'BD':  'bond',
  'CB':  'bond',
  'TR':  'trust',
  'PS':  'partnership',
  'RE':  'real_estate',
  'CA':  'cash',
}

export function classifyAssetType(code?: string): NonNullable<NormalizedHolding['asset_type']> {
  if (!code) return 'other'
  return ASSET_CODE_MAP[code.trim().toUpperCase()] ?? 'other'
}

function isoFromUsDate(s: string): string {
  const parts = s.split('/')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error(`Invalid US date: ${s}`)
  }
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
}

/**
 * Parse PTR PDF text. Walks "Schedule of Transactions" or similar header,
 * emits transaction rows. Conservative under-reporting on non-standard
 * formatting (line items not matching expected shape are skipped).
 *
 * Mock-text-only testing per slice 19+20 convention; real PDF binaries
 * are not committed.
 */
export function parsePtrText(text: string, ctx: { filing_year: number; source_url: string }): {
  trades: Omit<NormalizedPtr, 'external_id'>[]
} {
  const trades: Omit<NormalizedPtr, 'external_id'>[] = []
  const lines = text.split(/\r?\n/)
  let inSection = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/Schedule of (Transactions|Sales|Purchases)/i.test(line)) { inSection = true; continue }
    if (!inSection) continue
    // Heuristic row regex: <date> <date> <Action> <Asset> <Amount range>
    // Example: 01/05/2025 01/19/2025 P AAPL Apple Inc. $1,001 - $15,000
    const m = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+([A-Z]+)\s+([\w.&'-]+)\s+(.+?)\s+(\$?[\d,]+(?:\.\d{2})?(?:\s*[-–to]+\s*\$?[\d,]+(?:\.\d{2})?)?)$/i.exec(line)
    if (!m) continue
    const ttype = classifyTransactionType(m[3]!)
    if (!ttype) continue
    const range = classifyAmountRange(m[6]!)
    const row: Omit<NormalizedPtr, 'external_id'> = {
      filing_year:      ctx.filing_year,
      transaction_date: isoFromUsDate(m[1]!),
      filing_date:      isoFromUsDate(m[2]!),
      asset_ticker:     m[4]!,
      asset_name:       m[5]!.trim(),
      transaction_type: ttype,
      source_url:       ctx.source_url,
    }
    if (range.min !== undefined) row.amount_range_low = range.min
    if (range.max !== undefined) row.amount_range_high = range.max
    trades.push(row)
  }
  return { trades }
}

/**
 * Parse annual FD PDF text. Walks all 9 schedules (A-I). Returns combined
 * holdings + other arrays. Schedule mapping:
 *   A = holdings/income (federal_holdings)
 *   B = transactions  (IGNORED — annual FD context; PTRs are the canonical source)
 *   C = liabilities   (federal_disclosure_other category='liability')
 *   D = positions     (category='position')
 *   E = agreements    (category='agreement')
 *   F = compensation  (category='compensation')
 *   G = honoraria     (category='honoraria')
 *   H = gifts         (category='gift')
 *   I = travel        (category='travel')
 *
 * Schedule walker scaffolds ship A/C/H/I (highest-value categories per
 * spec Risk #5); D/E/F/G return [] until real FD samples surface
 * parser-shape requirements.
 */
export function parseFdText(text: string, ctx: { filing_year: number; source_url: string }): {
  holdings: Omit<NormalizedHolding, 'external_id'>[]
  other:    Omit<NormalizedDisclosureOther, 'external_id'>[]
} {
  const holdings: Omit<NormalizedHolding, 'external_id'>[] = []
  const other:    Omit<NormalizedDisclosureOther, 'external_id'>[] = []

  const SECTION_RE = /Schedule\s+([A-I])\b/g
  const sections = splitBySchedule(text, SECTION_RE)
  for (const [letter, body] of sections.entries()) {
    if (letter === 'A')        holdings.push(...parseScheduleA(body, ctx))
    else if (letter === 'C')   other.push(...parseScheduleC(body, ctx))
    else if (letter === 'H')   other.push(...parseScheduleH(body, ctx))
    else if (letter === 'I')   other.push(...parseScheduleI(body, ctx))
    // D/E/F/G left for follow-up — emit nothing (silent under-reporting acceptable v1)
  }
  return { holdings, other }
}

/**
 * Slice text body between consecutive "Schedule X" header markers.
 * Returns Map<letter, body-text> — body excludes the header itself.
 * Header ambiguity (single global Schedule label vs per-row) is resolved
 * by treating each match as a section boundary; non-letter content
 * between matches becomes that section's body.
 */
function splitBySchedule(text: string, re: RegExp): Map<string, string> {
  const map = new Map<string, string>()
  const matches: Array<{ letter: string; start: number; end: number }> = []
  let m: RegExpExecArray | null
  // Reset regex state in case caller passes a stateful /g regex
  re.lastIndex = 0
  while ((m = re.exec(text)) !== null) {
    matches.push({ letter: m[1]!, start: m.index, end: m.index + m[0].length })
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!
    const next = matches[i + 1]
    const start = cur.end
    const end   = next ? next.start : text.length
    map.set(cur.letter, text.slice(start, end))
  }
  return map
}

/**
 * Schedule A (holdings + income). Each line is loosely:
 *   <asset_name>  [<code>]  <value-range>  [<income-type>  <income-range>]
 * Real PDFs vary in column ordering + whitespace. Conservative under-
 * reporting: only lines containing at least an amount range are emitted.
 */
function parseScheduleA(
  body: string,
  ctx: { filing_year: number; source_url: string },
): Omit<NormalizedHolding, 'external_id'>[] {
  const out: Omit<NormalizedHolding, 'external_id'>[] = []
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || /^Schedule\s+/i.test(trimmed)) continue
    // Look for a value range somewhere in the line; bail on lines without one.
    const rangeMatch = AMOUNT_RANGE_RE.exec(trimmed) ?? OVER_RE.exec(trimmed) ?? LESS_THAN_RE.exec(trimmed)
    if (!rangeMatch) continue
    const rangeText  = rangeMatch[0]
    const rangeStart = trimmed.indexOf(rangeText)
    const nameSegment = trimmed.slice(0, rangeStart).trim()
    if (!nameSegment) continue
    const value = classifyAmountRange(rangeText)
    // Optional code in [BRACKETS] after the asset name, e.g. "Apple Inc. [ST]"
    const codeMatch = /\[([A-Z]{2,3})\]/.exec(nameSegment)
    const cleanedName = nameSegment.replace(/\s*\[[A-Z]{2,3}\]\s*/g, '').trim()
    const row: Omit<NormalizedHolding, 'external_id'> = {
      filing_year: ctx.filing_year,
      asset_type:  classifyAssetType(codeMatch?.[1]),
      source_url:  ctx.source_url,
    }
    if (cleanedName) row.asset_name = cleanedName
    if (value.min !== undefined) row.value_min = value.min
    if (value.max !== undefined) row.value_max = value.max
    out.push(row)
  }
  return out
}

/**
 * Schedule C (liabilities). Loose row shape:
 *   <creditor>  [<type>]  <amount-range>
 */
function parseScheduleC(
  body: string,
  ctx: { filing_year: number; source_url: string },
): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  return parseGenericOtherSchedule(body, ctx, 'liability')
}

/**
 * Schedule H (gifts). Loose row shape:
 *   <source/giver>  <description>  <value-range>
 */
function parseScheduleH(
  body: string,
  ctx: { filing_year: number; source_url: string },
): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  return parseGenericOtherSchedule(body, ctx, 'gift')
}

/**
 * Schedule I (travel). Loose row shape:
 *   <source/payer>  <itinerary description>  <value-range>
 */
function parseScheduleI(
  body: string,
  ctx: { filing_year: number; source_url: string },
): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  return parseGenericOtherSchedule(body, ctx, 'travel')
}

/**
 * Schedules C/H/I share a regex shape — text before the amount range is
 * a source/description blob; the range itself is the only required token.
 */
function parseGenericOtherSchedule(
  body: string,
  ctx: { filing_year: number; source_url: string },
  category: NormalizedDisclosureOther['category'],
): Omit<NormalizedDisclosureOther, 'external_id'>[] {
  const out: Omit<NormalizedDisclosureOther, 'external_id'>[] = []
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || /^Schedule\s+/i.test(trimmed)) continue
    const rangeMatch = AMOUNT_RANGE_RE.exec(trimmed) ?? OVER_RE.exec(trimmed) ?? LESS_THAN_RE.exec(trimmed)
    if (!rangeMatch) continue
    const rangeText  = rangeMatch[0]
    const rangeStart = trimmed.indexOf(rangeText)
    const descSegment = trimmed.slice(0, rangeStart).trim()
    if (!descSegment) continue
    const value = classifyAmountRange(rangeText)
    const row: Omit<NormalizedDisclosureOther, 'external_id'> = {
      filing_year:  ctx.filing_year,
      category,
      description:  descSegment,
      value_text:   value.text,
      source_url:   ctx.source_url,
    }
    if (value.min !== undefined) row.value_min = value.min
    if (value.max !== undefined) row.value_max = value.max
    out.push(row)
  }
  return out
}
