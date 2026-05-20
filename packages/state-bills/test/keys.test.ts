import { describe, expect, it } from 'vitest'
import { stateBillsKeys } from '../src/keys.ts'

describe('stateBillsKeys', () => {
  it('all is the root', () => {
    expect(stateBillsKeys.all).toEqual(['state-bills'])
  })

  it('byOfficialSponsored has hierarchical key', () => {
    expect(stateBillsKeys.byOfficialSponsored('oid-1')).toEqual([
      'state-bills', 'byOfficialSponsored', 'oid-1',
    ])
  })

  it('byOfficialCosponsored has hierarchical key', () => {
    expect(stateBillsKeys.byOfficialCosponsored('oid-1')).toEqual([
      'state-bills', 'byOfficialCosponsored', 'oid-1',
    ])
  })

  it('byOfficialVotes has hierarchical key', () => {
    expect(stateBillsKeys.byOfficialVotes('oid-1')).toEqual([
      'state-bills', 'byOfficialVotes', 'oid-1',
    ])
  })
})
