import * as cheerio from 'cheerio'
import type { Chamber } from '../../shared/officials.ts'

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; ChiaroBot/1.0; +https://chiaro.example.com/bot)'

type EventType = 'recall_attempt' | 'recall_succeeded' | 'recall_failed'

const SUCCESS_RE = /\brecalled\b|removed from office/i
const FAILED_RE = /\bretained\b|petition\s+(?:failed|withdrew)|insufficient signatures|withdrew/i
const ATTEMPT_RE = /\bactive\b|\bpending\b|petition\s+filed|election scheduled/i

export function mapOutcomeToEventType(status: string): EventType | null {
  if (SUCCESS_RE.test(status)) return 'recall_succeeded'
  if (FAILED_RE.test(status)) return 'recall_failed'
  if (ATTEMPT_RE.test(status)) return 'recall_attempt'
  return null
}

export function extractDate(text: string): string | null {
  if (!text || !text.trim()) return null
  const trimmed = text.trim()
  // Try ISO first
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return trimmed
  // Try Date.parse (handles "January 15, 2024" / "Jan 15, 2024" etc)
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

const CHAMBER_PREFIX_RE =
  /^(State\s+Sen\.?|State\s+Senator|State\s+Rep\.?|State\s+Representative|State\s+Del\.?|State\s+Delegate|Assemblymember|Assemblyman|Assemblywoman)\s+/i

export function parseLegislatorName(raw: string): { name: string; chamber: Chamber } | null {
  const m = raw.match(CHAMBER_PREFIX_RE)
  if (!m) return null
  const prefix = m[1]!.toLowerCase()
  const name = raw.slice(m[0]!.length).trim()
  if (!name) return null
  if (/\bsen/.test(prefix)) return { name, chamber: 'state_senate' }
  return { name, chamber: 'state_house' }
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
}

export interface ParsedRecallYearLink {
  year: number
  url: string
}

export function parseRecallYearLinks(html: string): ParsedRecallYearLink[] {
  const $ = cheerio.load(html)
  const out: ParsedRecallYearLink[] = []
  $('a').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const m = href.match(/^\/State_legislative_recall_efforts,_(\d{4})$/)
    if (!m) return
    const year = Number.parseInt(m[1]!, 10)
    out.push({
      year,
      url: `https://ballotpedia.org${href}`,
    })
  })
  // Dedupe by year (a single year might appear in multiple link contexts)
  const seen = new Set<number>()
  return out.filter((l) => {
    if (seen.has(l.year)) return false
    seen.add(l.year)
    return true
  })
}

export interface ParsedRecallRow {
  stateName: string
  legislatorRaw: string
  dateText: string
  status: string
}

export function parseRecallRows(html: string): ParsedRecallRow[] {
  const $ = cheerio.load(html)
  const out: ParsedRecallRow[] = []
  $('table tr').each((_, trEl) => {
    const cells = $(trEl).find('td')
    if (cells.length < 4) return
    const stateName = $(cells[0]).text().trim()
    const legislatorRaw = $(cells[1]).text().trim()
    const dateText = $(cells[2]).text().trim()
    const status = $(cells[3]).text().trim()
    if (!stateName || !legislatorRaw) return
    out.push({ stateName, legislatorRaw, dateText, status })
  })
  return out
}
