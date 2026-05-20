import { describe, expect, it } from 'vitest'
import {
  normalizeStateLegDistrictCode,
  isStateChamberSupported,
  STATES_WITH_UNICAMERAL,
} from './state-leg-config.ts'

describe('state-leg-config', () => {
  it('numeric district codes zero-pad for most states', () => {
    expect(normalizeStateLegDistrictCode('CA', 'lower', '15')).toBe('CA-15')
    expect(normalizeStateLegDistrictCode('CA', 'upper', '8')).toBe('CA-08')
    expect(normalizeStateLegDistrictCode('TX', 'lower', '142')).toBe('TX-142')
  })

  it('Maryland multi-member: 1A/1B/1C all map to single district MD-01', () => {
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1A')).toBe('MD-01')
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1B')).toBe('MD-01')
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1C')).toBe('MD-01')
  })

  it('Nebraska unicameral: legislature chamber, codes match state_senate tier', () => {
    expect(normalizeStateLegDistrictCode('NE', 'legislature', '23')).toBe('NE-23')
    expect(isStateChamberSupported('NE', 'lower')).toBe(false)
    expect(isStateChamberSupported('NE', 'upper')).toBe(false)
    expect(isStateChamberSupported('NE', 'legislature')).toBe(true)
  })

  it('NH multi-word district codes return null (known limitation)', () => {
    expect(normalizeStateLegDistrictCode('NH', 'lower', 'Rockingham 5')).toBe(null)
    expect(normalizeStateLegDistrictCode('NH', 'lower', 'Hillsborough 23')).toBe(null)
  })

  it('Alaska letter districts pad as-is', () => {
    expect(normalizeStateLegDistrictCode('AK', 'lower', 'A')).toBe('AK-A')
    expect(normalizeStateLegDistrictCode('AK', 'upper', 'B')).toBe('AK-B')
  })

  it('at-large districts (WY house) map to STATE-AL', () => {
    expect(normalizeStateLegDistrictCode('WY', 'lower', 'At-Large')).toBe('WY-AL')
  })

  it('unsupported state/chamber combos return null', () => {
    expect(normalizeStateLegDistrictCode('DC', 'lower', '1')).toBe(null)
    expect(normalizeStateLegDistrictCode('GU', 'upper', '1')).toBe(null)
  })

  it('STATES_WITH_UNICAMERAL is exactly { NE }', () => {
    expect(STATES_WITH_UNICAMERAL).toEqual(new Set(['NE']))
  })
})
