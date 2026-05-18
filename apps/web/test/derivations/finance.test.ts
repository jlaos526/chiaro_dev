import { describe, expect, it } from 'vitest'
import { pacPercent } from '@/lib/derivations/finance'

describe('pacPercent', () => {
  it('returns null when total raised is 0', () => {
    expect(pacPercent(0, 100)).toBeNull()
  })
  it('returns null when total raised is null', () => {
    expect(pacPercent(null, 100)).toBeNull()
  })
  it('returns null when pacSum is null', () => {
    expect(pacPercent(1_000_000, null)).toBeNull()
  })
  it('computes (pacSum / totalRaised) * 100, rounded to 1 decimal', () => {
    expect(pacPercent(5_234_189, 32_500)).toBeCloseTo(0.6, 1)
    expect(pacPercent(1_000_000, 500_000)).toBeCloseTo(50.0, 1)
  })
  it('caps at 100% defensively (data drift safety)', () => {
    expect(pacPercent(100_000, 500_000)).toBe(100)
  })
})
