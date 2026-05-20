import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

export type OpenStatesRoleType = 'upper' | 'lower' | 'legislature'

export interface OpenStatesPerson {
  id: string                    // ocd-person/<uuid>
  name: string
  given_name?: string
  family_name?: string
  party: string                 // first party name in array
  image?: string
  email?: string
  role: {
    type: OpenStatesRoleType
    state: string               // 2-char uppercase derived from jurisdiction id
    district: string
    title: string
  }
  offices: Array<{
    classification?: string     // 'capitol' | 'district' | 'primary'
    address?: string
    voice?: string
    fax?: string
  }>
}

/**
 * Walk every .yml/.yaml file in a directory (non-recursive — OpenStates
 * doesn't nest beyond `data/<state>/legislature/`). Parse each, normalize,
 * skip files that fail to parse or are missing required fields. Returns
 * the valid list; errors are logged to stderr.
 */
export async function loadOpenStatesYamlDir(dir: string): Promise<OpenStatesPerson[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const yamlFiles = entries.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

  const people: OpenStatesPerson[] = []
  for (const file of yamlFiles) {
    const path = join(dir, file)
    try {
      const text = await readFile(path, 'utf8')
      const raw = parseYaml(text) as Record<string, unknown> | null
      const normalized = normalize(raw)
      if (normalized) people.push(normalized)
    } catch (err) {
      console.error(`[openstates-yaml-loader] parse error in ${file}: ${(err as Error).message}`)
    }
  }
  return people
}

function normalize(raw: Record<string, unknown> | null): OpenStatesPerson | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || !raw.id.startsWith('ocd-person/')) return null
  if (typeof raw.name !== 'string') return null

  const partyArr = raw.party as Array<{ name?: string }> | undefined
  const party = Array.isArray(partyArr) && partyArr[0]?.name ? partyArr[0].name : null
  if (!party) return null

  const roles = (raw.roles as Array<Record<string, unknown>> | undefined) ?? []
  // Pick the role whose end_date is in the future (current term). Fall back to first.
  const now = new Date().toISOString().slice(0, 10)
  const current = roles.find(r =>
    typeof r.end_date === 'string' && r.end_date >= now
  ) ?? roles[0]
  if (!current) return null

  const roleType = current.type
  if (roleType !== 'upper' && roleType !== 'lower' && roleType !== 'legislature') return null

  const jurisdiction = typeof current.jurisdiction === 'string' ? current.jurisdiction : ''
  const stateMatch = jurisdiction.match(/state:([a-z]{2})/)
  if (!stateMatch) return null
  const state = stateMatch[1]!.toUpperCase()

  const district = current.district != null ? String(current.district) : ''
  if (!district) return null

  const title = typeof current.title === 'string' ? current.title : ''
  if (!title) return null

  const offices = ((raw.offices as Array<Record<string, unknown>> | undefined) ?? []).map(o => ({
    classification: typeof o.classification === 'string' ? o.classification : undefined,
    address: typeof o.address === 'string' ? o.address : undefined,
    voice: typeof o.voice === 'string' ? o.voice : undefined,
    fax: typeof o.fax === 'string' ? o.fax : undefined,
  }))

  return {
    id: raw.id,
    name: raw.name,
    given_name: typeof raw.given_name === 'string' ? raw.given_name : undefined,
    family_name: typeof raw.family_name === 'string' ? raw.family_name : undefined,
    party,
    image: typeof raw.image === 'string' ? raw.image : undefined,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    role: { type: roleType, state, district, title },
    offices,
  }
}
