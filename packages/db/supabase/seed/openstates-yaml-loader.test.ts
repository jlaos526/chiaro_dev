import { describe, expect, it } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOpenStatesYamlDir } from './openstates-yaml-loader.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, 'fixtures', 'openstates-people')

describe('openstates-yaml-loader', () => {
  it('loads all 6 fixture files', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    expect(people).toHaveLength(6)
  })

  it('returns each person with normalized core fields', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    const asm = people.find(p => p.id === 'ocd-person/00000000-0000-0000-0000-000000000001')
    expect(asm).toBeDefined()
    expect(asm!.name).toBe('Test Asm')
    expect(asm!.party).toBe('Democratic')
    expect(asm!.image).toBe('https://example.com/asm.jpg')
    expect(asm!.email).toBe('asm@example.test')
    expect(asm!.role.type).toBe('lower')
    expect(asm!.role.district).toBe('15')
    expect(asm!.role.title).toBe('Assemblymember')
    expect(asm!.role.state).toBe('CA')
    expect(asm!.offices).toHaveLength(1)
    expect(asm!.offices[0]!.classification).toBe('capitol')
  })

  it('parses NE legislature (unicameral) correctly', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    const ne = people.find(p => p.role.state === 'NE')!
    expect(ne.role.type).toBe('legislature')
    expect(ne.party).toBe('Nonpartisan')
  })

  it('parses MD multi-member districts (1A, 1B, 1C)', async () => {
    const people = await loadOpenStatesYamlDir(FIXTURE_DIR)
    const mds = people.filter(p => p.role.state === 'MD')
    expect(mds).toHaveLength(3)
    expect(new Set(mds.map(p => p.role.district))).toEqual(new Set(['1A','1B','1C']))
  })

  it('skips malformed files and continues (graceful)', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-people-broken-tmp')
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    await writeFile(
      join(tmpDir, 'good.yml'),
      `id: ocd-person/x\nname: G\nparty: [{name: D}]\nroles: [{type: lower, jurisdiction: ocd-jurisdiction/country:us/state:ca/government, district: '1', title: Asm, start_date: '2024-01-01', end_date: '2026-01-01'}]\n`,
    )
    await writeFile(join(tmpDir, 'broken.yml'), `[invalid yaml syntax: : :`)
    try {
      const result = await loadOpenStatesYamlDir(tmpDir)
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('G')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('returns empty array for empty dir', async () => {
    const tmpDir = join(__dirname, 'fixtures', 'openstates-people-empty-tmp')
    const { mkdir, rm } = await import('node:fs/promises')
    await mkdir(tmpDir, { recursive: true })
    try {
      expect(await loadOpenStatesYamlDir(tmpDir)).toEqual([])
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
