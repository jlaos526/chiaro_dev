// Six endpoints per official per cycle:
//   candSummary?cid={cid}&cycle={cycle}            → total raised, small donor %, etc.
//   candIndustry?cid={cid}&cycle={cycle}            → top industries
//   candPacs?cid={cid}&cycle={cycle}                → named PAC contributions
//   candIndByState?cid={cid}&cycle={cycle}          → in-state vs out-of-state %
//   candContrib?cid={cid}&cycle={cycle}             → top individual donors (NEW slice 5)
//   candOrgs?cid={cid}&cycle={cycle}                → top organizations (NEW slice 5)
// Free tier: 200 calls/day. Full Congress backfill at 6 calls/official → ~17 days.

export interface FinanceSnapshot {
  cycle: string
  total_raised: number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct: number | null
  out_of_state_pct: number | null
  source_url: string
  industries: Array<{ rank: number; industry: string; amount: number }>
  pacs: Array<{ pac_name: string; pac_fec_id: string | null; amount: number }>
  individual_donors: Array<{
    rank: number
    donor_name: string
    amount: number
    employer: string | null
    occupation: string | null
  }>
  top_organizations: Array<{ rank: number; org_name: string; amount: number }>
}

const API_BASE = 'https://www.opensecrets.org/api/'

export async function fetchFinanceSnapshot(
  opensecretsCID: string,
  cycle: string,
  apiKey: string,
  opts?: { fixturePath?: string },
): Promise<FinanceSnapshot> {
  if (opts?.fixturePath) {
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(opts.fixturePath, 'utf8')
    return JSON.parse(text) as FinanceSnapshot
  }

  const summaryUrl = `${API_BASE}?method=candSummary&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const industryUrl = `${API_BASE}?method=candIndustry&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const pacsUrl = `${API_BASE}?method=candPacs&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const stateUrl = `${API_BASE}?method=candIndByState&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const contribUrl = `${API_BASE}?method=candContrib&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const orgsUrl = `${API_BASE}?method=candOrgs&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`

  const [summary, industry, pacs, state, contrib, orgs] = await Promise.all([
    fetch(summaryUrl).then((r) => r.json()),
    fetch(industryUrl).then((r) => r.json()),
    fetch(pacsUrl).then((r) => r.json()),
    fetch(stateUrl).then((r) => r.json()),
    fetch(contribUrl)
      .then((r) => r.json())
      .catch(() => null),
    fetch(orgsUrl)
      .then((r) => r.json())
      .catch(() => null),
  ])

  const s = (summary as any).response.summary['@attributes']

  // Each new endpoint wrapped in try/catch so a malformed shape can't kill the whole snapshot.
  let individual_donors: FinanceSnapshot['individual_donors'] = []
  try {
    const contribRows = (contrib as any)?.response?.contributors?.contributor ?? []
    individual_donors = contribRows.slice(0, 10).map((row: any, idx: number) => ({
      rank: idx + 1,
      donor_name: row['@attributes'].contrib,
      amount: Number(row['@attributes'].total) || 0,
      employer: row['@attributes'].employer ?? null,
      occupation: row['@attributes'].occupation ?? null,
    }))
  } catch {
    individual_donors = []
  }

  let top_organizations: FinanceSnapshot['top_organizations'] = []
  try {
    const orgRows = (orgs as any)?.response?.organizations?.organization ?? []
    top_organizations = orgRows.slice(0, 10).map((row: any, idx: number) => ({
      rank: idx + 1,
      org_name: row['@attributes'].org_name,
      amount: Number(row['@attributes'].total) || 0,
    }))
  } catch {
    top_organizations = []
  }

  return {
    cycle,
    total_raised: Number(s.total) || null,
    total_disbursed: Number(s.spent) || null,
    small_donor_pct: Number(s.contrib_from_individuals_small_pct) || null,
    in_state_pct:
      Number((state as any).response['cand_state']?.['@attributes']?.in_state_pct) || null,
    out_of_state_pct:
      Number((state as any).response['cand_state']?.['@attributes']?.out_of_state_pct) || null,
    source_url: `https://www.opensecrets.org/members-of-congress/summary?cid=${opensecretsCID}&cycle=${cycle}`,
    industries: ((industry as any).response.industries.industry ?? [])
      .slice(0, 25)
      .map((row: any, idx: number) => ({
        rank: idx + 1,
        industry: row['@attributes'].industry_name,
        amount: Number(row['@attributes'].total) || 0,
      })),
    pacs: ((pacs as any).response.pacs.pac ?? []).map((row: any) => ({
      pac_name: row['@attributes'].pac_name,
      pac_fec_id: row['@attributes'].fec_pac_id ?? null,
      amount: Number(row['@attributes'].total) || 0,
    })),
    individual_donors,
    top_organizations,
  }
}
