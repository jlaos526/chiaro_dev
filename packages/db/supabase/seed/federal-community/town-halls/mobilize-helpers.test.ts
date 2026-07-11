import { describe, expect, it } from 'vitest'
import {
  isFederalLegislatorEvent,
  extractFederalLegislatorName,
  inferFederalChamber,
} from './mobilize-helpers.ts'

describe('isFederalLegislatorEvent', () => {
  it('matches "Senator <Name>" (federal)', () => {
    expect(isFederalLegislatorEvent('Town Hall with Senator Elizabeth Warren', '')).toBe(true)
  })
  it('matches "Representative <Name>"', () => {
    expect(isFederalLegislatorEvent('Town Hall with Representative Jim Jordan', '')).toBe(true)
  })
  it('matches "Congressman <Name>"', () => {
    expect(isFederalLegislatorEvent('Congressman Adam Smith Town Hall', '')).toBe(true)
  })
  it('matches "Congresswoman <Name>"', () => {
    expect(isFederalLegislatorEvent('Congresswoman Maria Lopez', '')).toBe(true)
  })
  it('matches "Rep. <Name>"', () => {
    expect(isFederalLegislatorEvent('Rep. John Doe Town Hall', '')).toBe(true)
  })
  it('REJECTS "State Senator <Name>"', () => {
    expect(isFederalLegislatorEvent('Town Hall with State Senator Mike Foote', '')).toBe(false)
  })
  it('REJECTS "State Rep. <Name>"', () => {
    expect(isFederalLegislatorEvent('State Rep. Emily Sirota — Community Town Hall', '')).toBe(
      false,
    )
  })
  it('REJECTS "State Representative <Name>"', () => {
    expect(isFederalLegislatorEvent('State Representative Jane Roe', '')).toBe(false)
  })
  it('falls back to description when title has no match', () => {
    expect(isFederalLegislatorEvent('Open Forum', 'Featuring Senator John Doe')).toBe(true)
  })
})

describe('extractFederalLegislatorName', () => {
  it('extracts from "Senator <Name>"', () => {
    expect(extractFederalLegislatorName('Town Hall with Senator Elizabeth Warren')).toBe(
      'Elizabeth Warren',
    )
  })
  it('extracts from "Representative <Name>"', () => {
    expect(extractFederalLegislatorName('Town Hall with Representative Jim Jordan')).toBe(
      'Jim Jordan',
    )
  })
  it('extracts hyphenated last name', () => {
    expect(extractFederalLegislatorName('Senator Maria Lopez-Garcia Town Hall')).toBe(
      'Maria Lopez-Garcia',
    )
  })
  it('extracts from "Rep. <Name>"', () => {
    expect(extractFederalLegislatorName('Rep. John Doe Town Hall')).toBe('John Doe')
  })
  it('returns null for "State Senator <Name>" (rejected before extraction)', () => {
    expect(extractFederalLegislatorName('Town Hall with State Senator Mike Foote')).toBeNull()
  })
})

describe('inferFederalChamber', () => {
  it('"Senator" (no State prefix) → federal_senate', () => {
    expect(inferFederalChamber('Town Hall with Senator Warren')).toBe('federal_senate')
  })
  it('"Representative" → federal_house', () => {
    expect(inferFederalChamber('Representative Jordan')).toBe('federal_house')
  })
  it('"Congressman" → federal_house', () => {
    expect(inferFederalChamber('Congressman Smith')).toBe('federal_house')
  })
  it('"Congresswoman" → federal_house', () => {
    expect(inferFederalChamber('Congresswoman Lopez')).toBe('federal_house')
  })
  it('"Rep." → federal_house', () => {
    expect(inferFederalChamber('Rep. Doe')).toBe('federal_house')
  })
  it('"State Senator" → null (state-tier event)', () => {
    expect(inferFederalChamber('State Senator Foote')).toBeNull()
  })
  it('"State Rep." → null', () => {
    expect(inferFederalChamber('State Rep. Sirota')).toBeNull()
  })
  it('vague title → null', () => {
    expect(inferFederalChamber('Community Town Hall in Brooklyn')).toBeNull()
  })
})
