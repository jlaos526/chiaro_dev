// Three endpoints per official per cycle:
//   candSummary?cid={cid}&cycle={cycle}            → total raised, small donor %, etc.
//   candIndustry?cid={cid}&cycle={cycle}            → top industries
//   candPacs?cid={cid}&cycle={cycle}                → named PAC contributions
//   candIndByState?cid={cid}&cycle={cycle}          → in-state vs out-of-state %
// Free tier: 200 calls/day. Ingest spread over multiple days for full sweep.

export interface FinanceSnapshot {
  cycle:           string
  total_raised:    number | null
  total_disbursed: number | null
  small_donor_pct: number | null
  in_state_pct:    number | null
  out_of_state_pct: number | null
  source_url:      string
  industries: Array<{ rank: number; industry: string; amount: number }>
  pacs:       Array<{ pac_name: string; pac_fec_id: string | null; amount: number }>
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

  const summaryUrl   = `${API_BASE}?method=candSummary&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const industryUrl  = `${API_BASE}?method=candIndustry&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const pacsUrl      = `${API_BASE}?method=candPacs&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`
  const stateUrl     = `${API_BASE}?method=candIndByState&cid=${opensecretsCID}&cycle=${cycle}&apikey=${apiKey}&output=json`

  const [summary, industry, pacs, state] = await Promise.all([
    fetch(summaryUrl).then(r => r.json()),
    fetch(industryUrl).then(r => r.json()),
    fetch(pacsUrl).then(r => r.json()),
    fetch(stateUrl).then(r => r.json()),
  ])

  const s = (summary as any).response.summary['@attributes']
  return {
    cycle,
    total_raised:    Number(s.total)  || null,
    total_disbursed: Number(s.spent)  || null,
    small_donor_pct: Number(s.contrib_from_individuals_small_pct) || null,
    in_state_pct:    Number((state as any).response['cand_state']?.['@attributes']?.in_state_pct) || null,
    out_of_state_pct: Number((state as any).response['cand_state']?.['@attributes']?.out_of_state_pct) || null,
    source_url: `https://www.opensecrets.org/members-of-congress/summary?cid=${opensecretsCID}&cycle=${cycle}`,
    industries: ((industry as any).response.industries.industry ?? []).slice(0, 25).map((row: any, idx: number) => ({
      rank: idx + 1,
      industry: row['@attributes'].industry_name,
      amount: Number(row['@attributes'].total) || 0,
    })),
    pacs: ((pacs as any).response.pacs.pac ?? []).map((row: any) => ({
      pac_name: row['@attributes'].pac_name,
      pac_fec_id: row['@attributes'].fec_pac_id ?? null,
      amount: Number(row['@attributes'].total) || 0,
    })),
  }
}
