import { describe, expect, it } from 'vitest'
import {
  isStateLevel,
  isFederalLevel,
  levelOf,
  isSenateChamber,
  isHouseChamber,
} from '../src/types.ts'

describe('OfficialChamber helpers', () => {
  it('isStateLevel returns true only for state_*', () => {
    expect(isStateLevel('federal_house')).toBe(false)
    expect(isStateLevel('federal_senate')).toBe(false)
    expect(isStateLevel('state_house')).toBe(true)
    expect(isStateLevel('state_senate')).toBe(true)
    expect(isStateLevel('state_legislature')).toBe(true)
  })

  it('isFederalLevel returns true only for federal_*', () => {
    expect(isFederalLevel('federal_house')).toBe(true)
    expect(isFederalLevel('federal_senate')).toBe(true)
    expect(isFederalLevel('state_house')).toBe(false)
    expect(isFederalLevel('state_senate')).toBe(false)
    expect(isFederalLevel('state_legislature')).toBe(false)
  })

  it('levelOf returns federal or state', () => {
    expect(levelOf('federal_house')).toBe('federal')
    expect(levelOf('federal_senate')).toBe('federal')
    expect(levelOf('state_house')).toBe('state')
    expect(levelOf('state_senate')).toBe('state')
    expect(levelOf('state_legislature')).toBe('state')
  })

  it('isSenateChamber covers federal_senate + state_senate + state_legislature (NE)', () => {
    expect(isSenateChamber('federal_senate')).toBe(true)
    expect(isSenateChamber('state_senate')).toBe(true)
    expect(isSenateChamber('state_legislature')).toBe(true)
    expect(isSenateChamber('federal_house')).toBe(false)
    expect(isSenateChamber('state_house')).toBe(false)
  })

  it('isHouseChamber covers federal_house + state_house only', () => {
    expect(isHouseChamber('federal_house')).toBe(true)
    expect(isHouseChamber('state_house')).toBe(true)
    expect(isHouseChamber('federal_senate')).toBe(false)
    expect(isHouseChamber('state_senate')).toBe(false)
    expect(isHouseChamber('state_legislature')).toBe(false)
  })
})
