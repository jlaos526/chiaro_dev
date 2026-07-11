import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

export interface OpenStatesBillEnvelope {
  id: string
  jurisdiction: { id: string; classification: string }
  session: string
  identifier: string
  title: string
  classification?: string[]
  subject?: string[]
  sponsorships?: Array<{
    person_id: string | null
    name: string
    classification: 'primary' | 'cosponsor'
  }>
  actions?: Array<{
    description: string
    date: string
    classification?: string[]
  }>
  sources: Array<{ url: string }>
  openstates_url: string
}

export interface OpenStatesVoteEnvelope {
  id: string
  bill_id: string
  motion_text: string
  result: string
  start_date: string
  organization: { classification: string }
  votes: Array<{
    voter_name: string
    voter_id: string | null
    option: string
  }>
  sources: Array<{ url: string }>
}

function hasStringId(x: unknown): x is { id: string } {
  return typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string'
}

export async function loadOpenStatesBillsDir(dir: string): Promise<OpenStatesBillEnvelope[]> {
  const files = await safeReaddir(dir)
  const out: OpenStatesBillEnvelope[] = []
  for (const file of files) {
    const path = join(dir, file)
    const parsed = await safeParse(path)
    if (parsed == null) continue
    if (!hasStringId(parsed)) {
      console.error(`[openstates-bills-loader] skipped ${path}: payload missing string id field`)
      continue
    }
    if (parsed.id.startsWith('ocd-bill/')) {
      out.push(parsed as OpenStatesBillEnvelope)
    }
  }
  return out
}

export async function loadOpenStatesVotesDir(dir: string): Promise<OpenStatesVoteEnvelope[]> {
  const files = await safeReaddir(dir)
  const out: OpenStatesVoteEnvelope[] = []
  for (const file of files) {
    const path = join(dir, file)
    const parsed = await safeParse(path)
    if (parsed == null) continue
    if (!hasStringId(parsed)) {
      console.error(`[openstates-bills-loader] skipped ${path}: payload missing string id field`)
      continue
    }
    if (parsed.id.startsWith('ocd-vote/')) {
      out.push(parsed as OpenStatesVoteEnvelope)
    }
  }
  return out
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    return entries.filter((f) => /\.(ya?ml|json)$/i.test(f)).sort()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function safeParse(path: string): Promise<unknown> {
  try {
    const text = await readFile(path, 'utf8')
    if (path.endsWith('.json')) return JSON.parse(text)
    return parseYaml(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[openstates-bills-loader] parse error in ${path}: ${msg}`)
    return null
  }
}

// Helper: split OpenStates identifier ('AB 123') into bill_type + number.
export function parseBillIdentifier(
  identifier: string,
): { bill_type: string; number: number } | null {
  const match = identifier.match(/^([A-Za-z]+)\s*(\d+)$/)
  if (!match) return null
  return { bill_type: match[1]!.toUpperCase(), number: parseInt(match[2]!, 10) }
}

// Helper: extract state from jurisdiction id.
export function parseJurisdictionState(jurisdictionId: string): string | null {
  const match = jurisdictionId.match(/state:([a-z]{2})/)
  return match ? match[1]!.toUpperCase() : null
}
