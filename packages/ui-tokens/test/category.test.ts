import { describe, expect, it } from 'vitest'
import {
  type CategoryId,
  CATEGORY_LABEL,
  CATEGORY_ACCENT,
  SUB_CASCADE_ACCENT,
  CATEGORY_CARD_GRADIENT,
} from '../src/category.ts'

const ALL_IDS: CategoryId[] = [
  'service-record',
  'issue-positions',
  'community-presence',
  'finance',
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

describe('CATEGORY_ACCENT (palette A — semantic earthen)', () => {
  it('matches the locked hex values from the spec', () => {
    expect(CATEGORY_ACCENT['service-record']).toBe('#c89a4e')
    expect(CATEGORY_ACCENT['issue-positions']).toBe('#3b6ed1')
    expect(CATEGORY_ACCENT['community-presence']).toBe('#1f9b88')
    expect(CATEGORY_ACCENT['finance']).toBe('#3da75b')
    expect(CATEGORY_ACCENT['ethics-accountability']).toBe('#d68a1f')
    expect(CATEGORY_ACCENT['voting-bills']).toBe('#7d57c1')
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
