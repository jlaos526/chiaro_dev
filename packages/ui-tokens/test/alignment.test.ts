import { describe, expect, it } from 'vitest'
import {
  type AlignmentTier,
  ALIGNMENT_LABEL,
  ALIGNMENT_CHIP_COLORS,
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

describe('ALIGNMENT_CHIP_COLORS', () => {
  it('matches the locked palette per tier', () => {
    expect(ALIGNMENT_CHIP_COLORS['strongly-aligned']).toEqual({ bg: '#c5e3c7', fg: '#1f4d24' })
    expect(ALIGNMENT_CHIP_COLORS['mostly-aligned']).toEqual({ bg: '#d4ecd5', fg: '#2a6b30' })
    expect(ALIGNMENT_CHIP_COLORS['mixed']).toEqual({ bg: '#f0eee5', fg: '#5a5751' })
    expect(ALIGNMENT_CHIP_COLORS['mostly-differs']).toEqual({ bg: '#f4d3c0', fg: '#7a3e1c' })
    expect(ALIGNMENT_CHIP_COLORS['strongly-differs']).toEqual({ bg: '#f0b8a0', fg: '#5a2812' })
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
