// Fetch latest FEC Form 2 (Statement of Candidacy) for a candidate.
// Free key: https://api.open.fec.gov/developers/

export interface FECCandidateAddress {
  address1: string
  city: string
  state: string
  zip: string
  source_url: string
}

const API_BASE = 'https://api.open.fec.gov/v1'

export async function fetchCandidateAddress(
  fecCandidateId: string,
  apiKey: string,
  opts?: { fixturePath?: string },
): Promise<FECCandidateAddress | null> {
  if (opts?.fixturePath) {
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(opts.fixturePath, 'utf8')
    return JSON.parse(text) as FECCandidateAddress
  }
  const url = `${API_BASE}/candidates/?candidate_id=${fecCandidateId}&sort=-last_file_date&per_page=1&api_key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null
  const d = (await res.json()) as any
  const c = d.results?.[0]
  if (!c) return null
  return {
    address1: c.address_street_1,
    city: c.address_city,
    state: c.address_state,
    zip: c.address_zip,
    source_url: `https://www.fec.gov/data/candidate/${fecCandidateId}/`,
  }
}
