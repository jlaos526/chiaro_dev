import { describe, expect, it } from 'vitest'
import { billsKeys, votesKeys } from '../src/keys.ts'

describe('billsKeys', () => {
  it('all root', () => expect(billsKeys.all).toEqual(['bills']))
  it('lists', () => expect(billsKeys.list({ congress: '119' })).toEqual(['bills', 'list', { congress: '119' }]))
  it('detail', () => expect(billsKeys.detail('b1')).toEqual(['bills', 'detail', 'b1']))
  it('officialSponsored', () => expect(billsKeys.officialSponsored('off1', '119')).toEqual(['bills', 'official', 'off1', 'sponsored', '119']))
  it('officialCosponsored', () => expect(billsKeys.officialCosponsored('off1', '119')).toEqual(['bills', 'official', 'off1', 'cosponsored', '119']))
})

describe('votesKeys', () => {
  it('all root', () => expect(votesKeys.all).toEqual(['votes']))
  it('byBill', () => expect(votesKeys.byBill('b1')).toEqual(['votes', 'by-bill', 'b1']))
  it('officialMissed', () => expect(votesKeys.officialMissed('off1', '119')).toEqual(['votes', 'official', 'off1', 'missed', '119']))
  it('officialOnSubject', () => expect(votesKeys.officialOnSubject('off1', 'Environmental protection')).toEqual(['votes', 'official', 'off1', 'subject', 'Environmental protection']))
})
