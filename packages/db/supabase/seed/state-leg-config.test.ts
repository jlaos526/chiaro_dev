import { describe, expect, it } from 'vitest'
import {
  normalizeStateLegDistrictCode,
  isStateChamberSupported,
  STATES_WITH_UNICAMERAL,
} from './state-leg-config.ts'

describe('state-leg-config', () => {
  it('numeric district codes embed SH/SS prefix for most states', () => {
    expect(normalizeStateLegDistrictCode('CA', 'lower', '15')).toBe('CA-SH-15')
    expect(normalizeStateLegDistrictCode('CA', 'upper', '8')).toBe('CA-SS-8')
    expect(normalizeStateLegDistrictCode('TX', 'lower', '142')).toBe('TX-SH-142')
  })

  it('leading zeros are stripped (matches tiger-config.ts:50,68)', () => {
    expect(normalizeStateLegDistrictCode('CA', 'lower', '05')).toBe('CA-SH-5')
    expect(normalizeStateLegDistrictCode('CA', 'upper', '01')).toBe('CA-SS-1')
    expect(normalizeStateLegDistrictCode('TX', 'lower', '007')).toBe('TX-SH-7')
  })

  it('Maryland multi-member: 1A/1B/1C all map to single district MD-SH-1', () => {
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1A')).toBe('MD-SH-1')
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1B')).toBe('MD-SH-1')
    expect(normalizeStateLegDistrictCode('MD', 'lower', '1C')).toBe('MD-SH-1')
  })

  it('Nebraska unicameral: legislature chamber → SS prefix (TIGER state_senate tier)', () => {
    expect(normalizeStateLegDistrictCode('NE', 'legislature', '23')).toBe('NE-SS-23')
    expect(isStateChamberSupported('NE', 'lower')).toBe(false)
    expect(isStateChamberSupported('NE', 'upper')).toBe(false)
    expect(isStateChamberSupported('NE', 'legislature')).toBe(true)
  })

  it('NH multi-word district codes return null (known limitation)', () => {
    expect(normalizeStateLegDistrictCode('NH', 'lower', 'Rockingham 5')).toBe(null)
    expect(normalizeStateLegDistrictCode('NH', 'lower', 'Hillsborough 23')).toBe(null)
  })

  it('Alaska letter districts retain letter form with prefix', () => {
    expect(normalizeStateLegDistrictCode('AK', 'lower', 'A')).toBe('AK-SH-A')
    expect(normalizeStateLegDistrictCode('AK', 'upper', 'B')).toBe('AK-SS-B')
  })

  it('at-large districts (WY) map to STATE-{SS|SH}-AL', () => {
    expect(normalizeStateLegDistrictCode('WY', 'lower', 'At-Large')).toBe('WY-SH-AL')
    expect(normalizeStateLegDistrictCode('WY', 'upper', 'At-Large')).toBe('WY-SS-AL')
  })

  it('unsupported state/chamber combos return null', () => {
    expect(normalizeStateLegDistrictCode('DC', 'lower', '1')).toBe(null)
    expect(normalizeStateLegDistrictCode('GU', 'upper', '1')).toBe(null)
  })

  it('STATES_WITH_UNICAMERAL is exactly { NE }', () => {
    expect(STATES_WITH_UNICAMERAL).toEqual(new Set(['NE']))
  })
})
