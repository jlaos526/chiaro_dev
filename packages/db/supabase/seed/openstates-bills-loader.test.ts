import { describe, expect, it } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOpenStatesBillsDir, loadOpenStatesVotesDir, parseBillIdentifier, parseJurisdictionState } from './openstates-bills-loader.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-bills')

describe('openstates-bills-loader', () => {
  it('loadOpenStatesBillsDir loads 4 fixture bills (excluding vote files)', async () => {
    const bills = await loadOpenStatesBillsDir(FIXTURE_DIR)
    expect(bills).toHaveLength(4)
  })

  it('loadOpenStatesVotesDir loads 1 fixture vote (excluding bill files)', async () => {
    const votes = await loadOpenStatesVotesDir(FIXTURE_DIR)
    expect(votes).toHaveLength(1)
  })

  it('returns CA assembly bill with normalized fields', async () => {
    const bills = await loadOpenStatesBillsDir(FIXTURE_DIR)
    const ab123 = bills.find(b => b.id === 'ocd-bill/00000000-0000-0000-0000-00000000b001')!
    expect(ab123.session).toBe('20252026')
    expect(ab123.identifier).toBe('AB 123')
    expect(ab123.subject).toContain('Air quality')
    expect(ab123.sponsorships).toHaveLength(1)
    expect(ab123.sponsorships![0]!.classification).toBe('primary')
  })

  it('parses MD multi-sponsor bill (1 primary + 1 cosponsor)', async () => {
    const bills = await loadOpenStatesBillsDir(FIXTURE_DIR)
    const md = bills.find(b => b.id === 'ocd-bill/00000000-0000-0000-0000-00000000b004')!
    expect(md.sponsorships).toHaveLength(2)
    const roles = md.sponsorships!.map(s => s.classification)
    expect(roles).toContain('primary')
    expect(roles).toContain('cosponsor')
  })

  it('returns vote event with bill_id reference', async () => {
    const votes = await loadOpenStatesVotesDir(FIXTURE_DIR)
    const v = votes[0]!
    expect(v.bill_id).toBe('ocd-bill/00000000-0000-0000-0000-00000000b002')
    expect(v.result).toBe('passed')
    expect(v.votes).toHaveLength(1)
  })

  it('returns empty array for missing dir', async () => {
    const empty = await loadOpenStatesBillsDir('/nonexistent/path')
    expect(empty).toEqual([])
  })

  it('skips malformed YAML files and continues', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-bills-broken-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(
      join(tmpDir, 'good.yml'),
      `id: ocd-bill/x\njurisdiction: {id: ocd-jurisdiction/country:us/state:ca/government, classification: state}\nsession: '2025'\nidentifier: 'AB 1'\ntitle: G\nsources: [{url: 'https://x'}]\nopenstates_url: https://x\n`,
    )
    await writeFile(join(tmpDir, 'broken.yml'), `[invalid yaml syntax: : :`)
    try {
      const result = await loadOpenStatesBillsDir(tmpDir)
      expect(result).toHaveLength(1)
      expect(result[0]!.identifier).toBe('AB 1')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('skips parsed YAML with no id field (logs and continues)', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-bills-noid-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(join(tmpDir, 'no-id.yml'), `title: orphan record\nsession: '2025'\n`)
    await writeFile(
      join(tmpDir, 'good.yml'),
      `id: ocd-bill/zz\njurisdiction: {id: ocd-jurisdiction/country:us/state:tx/government, classification: state}\nsession: '89r'\nidentifier: 'SB 9'\ntitle: G\nsources: [{url: 'https://x'}]\nopenstates_url: https://x\n`,
    )
    try {
      const result = await loadOpenStatesBillsDir(tmpDir)
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('ocd-bill/zz')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('parseBillIdentifier', () => {
  it('parses "AB 123" → { bill_type: "AB", number: 123 }', () => {
    expect(parseBillIdentifier('AB 123')).toEqual({ bill_type: 'AB', number: 123 })
  })

  it('parses "LB100" (no space) → { bill_type: "LB", number: 100 }', () => {
    expect(parseBillIdentifier('LB100')).toEqual({ bill_type: 'LB', number: 100 })
  })

  it('returns null for hyphenated "HB-1"', () => {
    expect(parseBillIdentifier('HB-1')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseBillIdentifier('')).toBeNull()
  })
})

describe('parseJurisdictionState', () => {
  it('extracts CA from canonical jurisdiction id', () => {
    expect(parseJurisdictionState('ocd-jurisdiction/country:us/state:ca/government')).toBe('CA')
  })

  it('returns null for malformed id without state segment', () => {
    expect(parseJurisdictionState('ocd-jurisdiction/country:us/government')).toBeNull()
  })
})
