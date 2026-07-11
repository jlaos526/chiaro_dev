import { Buffer } from 'node:buffer'
import { Open } from 'unzipper'

const BASE_URL = 'https://disclosures-clerk.house.gov/public_disc'

export interface HouseFiling {
  filingId: string
  bioguideId?: string
  fullName: string
  pdfBytes: Buffer
  pdfUrl: string
}

export interface HouseZipManifest {
  filings: HouseFiling[]
}

type CentralFile = Awaited<ReturnType<typeof Open.buffer>>['files'][number]

/**
 * Download the yearly bulk PTR or FD ZIP from the Clerk's disclosure
 * portal and unpack per-filing PDFs alongside the bundled index file.
 *
 * The portal ships a per-year ZIP containing:
 *   - one index file (XML or CSV depending on year/formType) listing
 *     filing IDs ↔ legislator name ↔ bioguide ID
 *   - N per-filing PDFs named by filing ID
 *
 * v1 best-effort manifest parse: attempts XML and CSV index detection;
 * returns `{ filings: [] }` if the index is unrecognized. Adapter tests
 * inject mock fetchers anyway — production drift is the operator
 * follow-up signal (slice 22 onSkip already wires fetch failures).
 */
export async function fetchHouseDisclosureZip(opts: {
  year: number
  formType: 'ptr' | 'fd'
  fetcher?: typeof fetch
}): Promise<HouseZipManifest> {
  const fetcher = opts.fetcher ?? fetch
  const path = opts.formType === 'ptr' ? 'ptr-pdfs' : 'financial-pdfs'
  const url = `${BASE_URL}/${path}/${opts.year}.zip`
  const res = await fetcher(url, { headers: { 'User-Agent': 'ChiaroBot/1.0' } })
  if (!res.ok) throw new Error(`House ZIP fetch failed: ${res.status} (${url})`)
  const buf = Buffer.from(await res.arrayBuffer())
  const zip = await Open.buffer(buf)

  const pdfFiles = new Map<string, CentralFile>()
  let indexEntry: CentralFile | undefined
  for (const file of zip.files) {
    if (file.type !== 'File') continue
    const name = file.path.toLowerCase()
    if (name.endsWith('.pdf')) {
      // Strip directories + extension to recover filingId
      const base = file.path.split(/[\\/]/).pop() ?? file.path
      const filingId = base.replace(/\.pdf$/i, '')
      pdfFiles.set(filingId, file)
    } else if (
      !indexEntry &&
      (name.endsWith('.xml') || name.endsWith('.csv') || name.endsWith('.txt'))
    ) {
      indexEntry = file
    }
  }

  if (!indexEntry) return { filings: [] }

  const indexBytes = await indexEntry.buffer()
  const indexText = indexBytes.toString('utf8')
  const entries = parseIndex(indexText, indexEntry.path)

  const filings: HouseFiling[] = []
  for (const entry of entries) {
    const pdfFile = pdfFiles.get(entry.filingId)
    if (!pdfFile) continue
    const pdfBytes = await pdfFile.buffer()
    const filing: HouseFiling = {
      filingId: entry.filingId,
      fullName: entry.fullName,
      pdfBytes,
      pdfUrl: `${BASE_URL}/${path}/${opts.year}/${entry.filingId}.pdf`,
    }
    if (entry.bioguideId) filing.bioguideId = entry.bioguideId
    filings.push(filing)
  }

  return { filings }
}

interface IndexEntry {
  filingId: string
  bioguideId?: string
  fullName: string
}

/**
 * Best-effort manifest parse. XML index uses <Member> records with
 * <FilingID> + <First> + <Last> + <BioGuideID> children; CSV index is
 * comma-separated with a header row. Unknown shapes return [].
 */
function parseIndex(text: string, path: string): IndexEntry[] {
  const isXml = path.toLowerCase().endsWith('.xml') || /^\s*<\?xml/i.test(text)
  if (isXml) return parseXmlIndex(text)
  return parseCsvIndex(text)
}

function parseXmlIndex(text: string): IndexEntry[] {
  const out: IndexEntry[] = []
  const memberRe = /<Member>([\s\S]*?)<\/Member>/g
  let m: RegExpExecArray | null
  while ((m = memberRe.exec(text)) !== null) {
    const body = m[1]!
    const filingId = childText(body, 'FilingID') ?? childText(body, 'DocID')
    if (!filingId) continue
    const first = childText(body, 'First') ?? ''
    const last = childText(body, 'Last') ?? ''
    const bioguideId = childText(body, 'BioGuideID') ?? childText(body, 'BioguideID')
    const entry: IndexEntry = {
      filingId,
      fullName: `${first} ${last}`.trim(),
    }
    if (bioguideId) entry.bioguideId = bioguideId
    out.push(entry)
  }
  return out
}

function childText(body: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i')
  const m = re.exec(body)
  return m ? m[1]!.trim() : undefined
}

function parseCsvIndex(text: string): IndexEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase())
  const filingIdx = header.findIndex((h) => /filing.?id|doc.?id/.test(h))
  const firstIdx = header.findIndex((h) => /first/.test(h))
  const lastIdx = header.findIndex((h) => /last/.test(h))
  const bioguideIdx = header.findIndex((h) => /bioguide/.test(h))
  if (filingIdx < 0) return []
  const out: IndexEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim())
    const filingId = cols[filingIdx]
    if (!filingId) continue
    const first = firstIdx >= 0 ? (cols[firstIdx] ?? '') : ''
    const last = lastIdx >= 0 ? (cols[lastIdx] ?? '') : ''
    const bioguideId = bioguideIdx >= 0 ? cols[bioguideIdx] : undefined
    const entry: IndexEntry = {
      filingId,
      fullName: `${first} ${last}`.trim(),
    }
    if (bioguideId) entry.bioguideId = bioguideId
    out.push(entry)
  }
  return out
}
