export interface NormalizedRating {
  bioguideId: string
  score: number
  source_url: string
}

export interface ScorecardAdapter {
  slug: string
  name: string
  issue_area: string
  lean: 'progressive' | 'conservative' | 'libertarian' | 'single-issue' | 'centrist'
  methodology_url: string
  scoring_min: number
  scoring_max: number
  notes?: string
  fetchRatings(congress: string, opts?: { fixturePath?: string }): Promise<NormalizedRating[]>
}

export async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  retries = 3,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts)
      if (res.ok) return res
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
        continue
      }
      throw new Error(`${url}: ${res.status}`)
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
    }
  }
  throw new Error(`Unreachable: ${url}`)
}

// Shared CSV parser: header = first line, expected columns `bioguide,score`.
// Adapters can re-use to keep DRY; or roll their own when the CSV shape differs.
export function parseBioguideScoreCSV(
  csv: string,
  sourceUrlForBioguide: (b: string) => string,
): NormalizedRating[] {
  const lines = csv.trim().split(/\r?\n/).slice(1)
  const out: NormalizedRating[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [bioguide, score] = trimmed.split(',').map((s) => s.trim())
    if (!bioguide || !score) continue
    const n = Number(score)
    if (!Number.isFinite(n)) continue
    out.push({ bioguideId: bioguide, score: n, source_url: sourceUrlForBioguide(bioguide) })
  }
  return out
}
