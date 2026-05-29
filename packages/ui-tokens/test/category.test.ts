import { describe, expect, it } from 'vitest'
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  CATEGORY_ACCENT_DARK,
  SUB_CASCADE_ACCENT,
  CATEGORY_CARD_GRADIENT,
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
    expect(CATEGORY_ACCENT['service-record']).toBe('#c89a4e')        // gold (unchanged)
    expect(CATEGORY_ACCENT['community-presence']).toBe('#b86340')    // terracotta (was '#1f9b88' teal)
    expect(CATEGORY_ACCENT['finance']).toBe('#1a8f5a')               // emerald (was '#3da75b' medium green)
    expect(CATEGORY_ACCENT['issue-positions']).toBe('#3b6ed1')       // blue (unchanged)
    expect(CATEGORY_ACCENT['ethics-accountability']).toBe('#8a3a4d') // burgundy (was '#d68a1f' amber)
    expect(CATEGORY_ACCENT['voting-bills']).toBe('#7d57c1')          // purple (unchanged)
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

describe('SUB_CASCADE_ACCENT (lighter shade per category)', () => {
  it('matches the locked hex values', () => {
    expect(SUB_CASCADE_ACCENT['service-record']).toBe('#e1c896')
    expect(SUB_CASCADE_ACCENT['issue-positions']).toBe('#87aae0')
    expect(SUB_CASCADE_ACCENT['community-presence']).toBe('#7fc7bb')
    expect(SUB_CASCADE_ACCENT['finance']).toBe('#8fc89d')
    expect(SUB_CASCADE_ACCENT['ethics-accountability']).toBe('#ecbc7d')
    expect(SUB_CASCADE_ACCENT['voting-bills']).toBe('#b39bd9')
  })
})

describe('CATEGORY_CARD_GRADIENT', () => {
  it('renders a linear-gradient string per category', () => {
    for (const id of ALL_IDS) {
      expect(CATEGORY_CARD_GRADIENT[id]).toMatch(/^linear-gradient\(180deg, #[0-9a-f]{6} 0%, #fff 100%\)$/)
    }
  })
})
