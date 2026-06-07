import { describe, expect, it } from 'vitest'
import { billsKeys, votesKeys } from '../src/keys.ts'

describe('billsKeys', () => {
  it('all root', () => expect(billsKeys.all).toEqual(['bills']))
  it('officialSponsored', () => expect(billsKeys.officialSponsored('off1', '119')).toEqual(['bills', 'official', 'off1', 'sponsored', '119']))
  it('officialCosponsored', () => expect(billsKeys.officialCosponsored('off1', '119')).toEqual(['bills', 'official', 'off1', 'cosponsored', '119']))
})

describe('votesKeys', () => {
  it('all root', () => expect(votesKeys.all).toEqual(['votes']))
  it('officialMissed', () => expect(votesKeys.officialMissed('off1', '119')).toEqual(['votes', 'official', 'off1', 'missed', '119']))
})
