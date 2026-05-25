export interface ParsedTxTecOrder {
  violation_summary?: string
  penalty_amount?: number
  outcome_text?: string
}

// Section-header regexes. TX TEC orders use uppercase labels followed by
// colon + newline + body text. Body extends until the next uppercase
// section header or end of document.
const VIOLATION_HEADER_RE = /^(VIOLATION|ALLEGATION|FINDING)S?:\s*$/m
const PENALTY_HEADER_RE = /^(CIVIL PENALTY|PENALTY ASSESSED|FINE):\s*\$?([\d,]+(?:\.\d{1,2})?)/im
const OUTCOME_HEADER_RE = /^(DISPOSITION|ORDER):\s*$/m

const SECTION_END_RE = /^(VIOLATION|ALLEGATION|FINDING|CIVIL PENALTY|PENALTY ASSESSED|FINE|DISPOSITION|ORDER|RESPONDENT|RECEIVED|RESPECTFULLY)S?:?\s*$/m

function extractSectionBody(text: string, headerRe: RegExp): string | undefined {
  const match = text.match(headerRe)
  if (!match) return undefined
  const startIdx = match.index! + match[0].length
  const rest = text.slice(startIdx)
  // Find the next section header that terminates this section
  const endMatch = rest.match(SECTION_END_RE)
  const endIdx = endMatch?.index ?? rest.length
  const body = rest.slice(0, endIdx).trim()
  return body.length > 0 ? body : undefined
}

function parsePenaltyAmount(text: string): number | undefined {
  const match = text.match(PENALTY_HEADER_RE)
  if (!match) return undefined
  const numStr = match[2]!.replace(/,/g, '')
  const parsed = Number.parseFloat(numStr)
  if (!Number.isFinite(parsed)) return undefined
  return Math.trunc(parsed)  // Integer dollar amount; cents truncated
}

/**
 * Parse a TX TEC sworn-complaint order PDF's extracted text.
 *
 * TX TEC orders are pseudo-formal legal documents with uppercase section
 * labels. v1 extracts 3 optional fields:
 *
 *   - violation_summary: text under VIOLATION/ALLEGATION/FINDING header.
 *     Multi-paragraph capture (everything until next section header).
 *   - penalty_amount: dollar value from CIVIL PENALTY/PENALTY ASSESSED/FINE
 *     header. Integer dollars; cents truncated. Commas stripped.
 *   - outcome_text: text under DISPOSITION/ORDER header.
 *
 * All fields optional — order PDFs vary in completeness. Returns empty
 * object if no recognized section headers found. Slice 20 fill pattern:
 * caller UPSERTs the existing complaint + event rows (slice 16) with
 * these enriched fields (no row count change).
 */
export function parseTxTecOrderText(text: string): ParsedTxTecOrder {
  if (!text || text.trim().length === 0) return {}

  const result: ParsedTxTecOrder = {}

  const violation_summary = extractSectionBody(text, VIOLATION_HEADER_RE)
  if (violation_summary) result.violation_summary = violation_summary

  const penalty_amount = parsePenaltyAmount(text)
  if (penalty_amount !== undefined) result.penalty_amount = penalty_amount

  const outcome_text = extractSectionBody(text, OUTCOME_HEADER_RE)
  if (outcome_text) result.outcome_text = outcome_text

  return result
}
