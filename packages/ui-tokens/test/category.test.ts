import { describe, expect, it } from 'vitest'
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  CATEGORY_CARD_BG,
  CATEGORY_CARD_BG_DARK,
  SUB_CASCADE_ACCENT,
  SUB_CASCADE_ACCENT_DARK,
} from '../src/category.ts'

const ALL_IDS: CategoryId[] = [
  'service-record',
  'community-presence',
  'finance',
  'issue-positions',
  'ethics-accountability',
  'voting-bills',
]

describe('CATEGORY_LABEL', () => {
  it('has a label for every CategoryId', () => {
    for (const id of ALL_IDS) expect(CATEGORY_LABEL[id]).toBeTruthy()
  })
  it('matches the spec labels exactly', () => {
    expect(CATEGORY_LABEL['service-record']).toBe('Service Record')
    expect(CATEGORY_LABEL['issue-positions']).toBe('Issue Positions')
    expect(CATEGORY_LABEL['community-presence']).toBe('Community Presence')
    expect(CATEGORY_LABEL['finance']).toBe('Finance')
    expect(CATEGORY_LABEL['ethics-accountability']).toBe('Ethics & Accountability')
    expect(CATEGORY_LABEL['voting-bills']).toBe('Voting & Bills')
  })
})

describe('CategoryId enum + CATEGORY_LABEL ordering (slice 41)', () => {
  it('CATEGORY_LABEL keys follow the slice 41 narrative order', () => {
    const keys = Object.keys(CATEGORY_LABEL) as CategoryId[]
    expect(keys).toEqual([
      'service-record',
      'community-presence',
      'finance',
      'issue-positions',
      'ethics-accountability',
      'voting-bills',
    ])
  })
})

describe('CATEGORY_ACCENT (slice 41 semantic-aligned)', () => {
  it('matches the locked hex values from spec §4', () => {
    expect(CATEGORY_ACCENT['service-record']).toBe('#c89a4e') // gold (unchanged)
    expect(CATEGORY_ACCENT['community-presence']).toBe('#b86340') // terracotta (was '#1f9b88' teal)
    expect(CATEGORY_ACCENT['finance']).toBe('#1a8f5a') // emerald (was '#3da75b' medium green)
    expect(CATEGORY_ACCENT['issue-positions']).toBe('#3b6ed1') // blue (unchanged)
    expect(CATEGORY_ACCENT['ethics-accountability']).toBe('#8a3a4d') // burgundy (was '#d68a1f' amber)
    expect(CATEGORY_ACCENT['voting-bills']).toBe('#7d57c1') // purple (unchanged)
  })
})

describe('CATEGORY_ACCENT_DARK (slice 41: single-hex collapse)', () => {
  it('contains values identical to CATEGORY_ACCENT per category', () => {
    for (const id of ALL_IDS) {
      expect(CATEGORY_ACCENT_DARK[id]).toBe(CATEGORY_ACCENT[id])
    }
  })

  it('exports the same 6 keys as CATEGORY_ACCENT', () => {
    expect(Object.keys(CATEGORY_ACCENT_DARK).sort()).toEqual(Object.keys(CATEGORY_ACCENT).sort())
  })
})

describe('SUB_CASCADE_ACCENT (slice 41 light)', () => {
  it('matches the locked light sub-cascade hexes', () => {
    expect(SUB_CASCADE_ACCENT['service-record']).toBe('#e1c896') // unchanged (gold-derived)
    expect(SUB_CASCADE_ACCENT['community-presence']).toBe('#e0b8a0') // NEW terracotta-derived (was '#7fc7bb' teal-derived)
    expect(SUB_CASCADE_ACCENT['finance']).toBe('#7eb898') // NEW emerald-derived (was '#8fc89d')
    expect(SUB_CASCADE_ACCENT['issue-positions']).toBe('#87aae0') // unchanged
    expect(SUB_CASCADE_ACCENT['ethics-accountability']).toBe('#c89aa8') // NEW burgundy-derived (was '#ecbc7d' amber-derived)
    expect(SUB_CASCADE_ACCENT['voting-bills']).toBe('#b39bd9') // unchanged
  })
})

describe('SUB_CASCADE_ACCENT_DARK (slice 41 dark)', () => {
  it('matches the locked dark sub-cascade hexes', () => {
    expect(SUB_CASCADE_ACCENT_DARK['service-record']).toBe('#8a6a55') // NEW gold-derived (was '#9a8866')
    expect(SUB_CASCADE_ACCENT_DARK['community-presence']).toBe('#a08858') // NEW terracotta-derived (was '#4a9888' teal-derived)
    expect(SUB_CASCADE_ACCENT_DARK['finance']).toBe('#4e8060') // NEW emerald-derived (was '#5e9a70')
    expect(SUB_CASCADE_ACCENT_DARK['issue-positions']).toBe('#6680b8') // unchanged
    expect(SUB_CASCADE_ACCENT_DARK['ethics-accountability']).toBe('#704a55') // NEW burgundy-derived (was '#b08850' amber-derived)
    expect(SUB_CASCADE_ACCENT_DARK['voting-bills']).toBe('#8470a8') // unchanged
  })
})

describe('CATEGORY_CARD_BG (slice 43 universal)', () => {
  it('exports the locked light card bg', () => {
    expect(CATEGORY_CARD_BG).toBe('#fffaf2')
  })
})

describe('CATEGORY_CARD_BG_DARK (slice 43 universal)', () => {
  it('exports the locked dark card bg', () => {
    expect(CATEGORY_CARD_BG_DARK).toBe('#2a2e34')
  })
})
