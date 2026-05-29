import { describe, expect, it } from 'vitest'
import {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
  ALIGNMENT_CHIP_COLORS_DARK,
  scoreToTier,
} from '../src/alignment.ts'

const ALL_TIERS: AlignmentTier[] = [
  'strongly-aligned',
  'mostly-aligned',
  'mixed',
  'mostly-differs',
  'strongly-differs',
]

describe('ALIGNMENT_LABEL', () => {
  it('has the spec labels', () => {
    expect(ALIGNMENT_LABEL['strongly-aligned']).toBe('Strongly Aligned')
    expect(ALIGNMENT_LABEL['mostly-aligned']).toBe('Mostly Aligned')
    expect(ALIGNMENT_LABEL['mixed']).toBe('Mixed')
    expect(ALIGNMENT_LABEL['mostly-differs']).toBe('Mostly Differs')
    expect(ALIGNMENT_LABEL['strongly-differs']).toBe('Strongly Differs')
  })
})

describe('ALIGNMENT_CHIP_COLORS (slice 42 thermal palette)', () => {
  it('matches the locked light hex values per tier', () => {
    expect(ALIGNMENT_CHIP_COLORS['strongly-aligned']).toEqual({ bg: '#a8d4b0', fg: '#0f3a1c' })  // V2 saturation
    expect(ALIGNMENT_CHIP_COLORS['mostly-aligned']).toEqual({ bg: '#d8ecda', fg: '#2a6b30' })
    expect(ALIGNMENT_CHIP_COLORS['mixed']).toEqual({ bg: '#eedbb5', fg: '#7c5a1e' })             // gold pivot
    expect(ALIGNMENT_CHIP_COLORS['mostly-differs']).toEqual({ bg: '#f0d3c0', fg: '#6a3e1c' })
    expect(ALIGNMENT_CHIP_COLORS['strongly-differs']).toEqual({ bg: '#dca088', fg: '#4a1e0c' })  // V2 saturation
  })
})

describe('ALIGNMENT_CHIP_COLORS_DARK (slice 42)', () => {
  it('matches the locked dark hex values per tier', () => {
    expect(ALIGNMENT_CHIP_COLORS_DARK['strongly-aligned']).toEqual({ bg: '#143020', fg: '#a8e0b0' })
    expect(ALIGNMENT_CHIP_COLORS_DARK['mostly-aligned']).toEqual({ bg: '#24462d', fg: '#a8c9af' })
    expect(ALIGNMENT_CHIP_COLORS_DARK['mixed']).toEqual({ bg: '#23211a', fg: '#e1c896' })          // matches CATEGORY_CARD_BG_SOLID_DARK['service-record']
    expect(ALIGNMENT_CHIP_COLORS_DARK['mostly-differs']).toEqual({ bg: '#3e2820', fg: '#e0a890' })
    expect(ALIGNMENT_CHIP_COLORS_DARK['strongly-differs']).toEqual({ bg: '#5e2418', fg: '#f5a888' })
  })

  it('shares the same 5 tier keys with light variant', () => {
    expect(Object.keys(ALIGNMENT_CHIP_COLORS_DARK).sort()).toEqual(Object.keys(ALIGNMENT_CHIP_COLORS).sort())
  })
})

describe('scoreToTier', () => {
  it('100/100 -> strongly-aligned', () => expect(scoreToTier(100, 100)).toBe('strongly-aligned'))
  it('92/100  -> strongly-aligned', () => expect(scoreToTier(92, 100)).toBe('strongly-aligned'))
  it('90/100  -> strongly-aligned', () => expect(scoreToTier(90, 100)).toBe('strongly-aligned'))
  it('89/100  -> mostly-aligned',   () => expect(scoreToTier(89, 100)).toBe('mostly-aligned'))
  it('70/100  -> mostly-aligned',   () => expect(scoreToTier(70, 100)).toBe('mostly-aligned'))
  it('69/100  -> mixed',            () => expect(scoreToTier(69, 100)).toBe('mixed'))
  it('40/100  -> mixed',            () => expect(scoreToTier(40, 100)).toBe('mixed'))
  it('39/100  -> mostly-differs',   () => expect(scoreToTier(39, 100)).toBe('mostly-differs'))
  it('10/100  -> mostly-differs',   () => expect(scoreToTier(10, 100)).toBe('mostly-differs'))
  it('9/100   -> strongly-differs', () => expect(scoreToTier(9, 100)).toBe('strongly-differs'))
  it('0/100   -> strongly-differs', () => expect(scoreToTier(0, 100)).toBe('strongly-differs'))
  it('normalizes when scoringMax != 100 (e.g., 4/5 = 80% -> mostly-aligned)', () => {
    expect(scoreToTier(4, 5)).toBe('mostly-aligned')
  })
})

describe('ALIGNMENT_SYMBOL removed', () => {
  it('does not export ALIGNMENT_SYMBOL (chips are color-only now)', async () => {
    const mod = await import('../src/alignment.ts')
    expect((mod as unknown as Record<string, unknown>).ALIGNMENT_SYMBOL).toBeUndefined()
  })

  it('covers every AlignmentTier in ALIGNMENT_LABEL + ALIGNMENT_CHIP_COLORS', () => {
    for (const tier of ALL_TIERS) {
      expect(ALIGNMENT_LABEL[tier]).toBeTruthy()
      expect(ALIGNMENT_CHIP_COLORS[tier]).toBeTruthy()
    }
  })
})
