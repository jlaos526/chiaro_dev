import { describe, expect, it } from 'vitest'
import {
  serviceRecordTeaser,
  issuePositionsTeaser,
  communityPresenceTeaser,
  financeTeaser,
  ethicsAccountabilityTeaser,
  votingBillsTeaser,
} from '@/lib/derivations/teasers'

describe('serviceRecordTeaser', () => {
  it('returns "<role> · since <year>" when both present', () => {
    expect(serviceRecordTeaser({ role: 'Speaker', firstElectedYear: 2007 }))
      .toBe('Speaker · since 2007')
  })
  it('omits "since" clause when year missing', () => {
    expect(serviceRecordTeaser({ role: 'Speaker', firstElectedYear: null }))
      .toBe('Speaker')
  })
  it('returns null when role is null', () => {
    expect(serviceRecordTeaser({ role: null, firstElectedYear: null })).toBeNull()
  })
})

describe('issuePositionsTeaser', () => {
  it('renders "Strongly aligned on X, differs on Y" when both ends exist', () => {
    expect(issuePositionsTeaser({
      topAlignedIssue: 'environment',
      topDifferIssue:  'second-amendment',
    })).toBe('Strongly aligned on Environment, differs on Second Amendment')
  })
  it('omits the differs clause when no differs exists', () => {
    expect(issuePositionsTeaser({ topAlignedIssue: 'environment', topDifferIssue: null }))
      .toBe('Strongly aligned on Environment')
  })
  it('returns null when both are null', () => {
    expect(issuePositionsTeaser({ topAlignedIssue: null, topDifferIssue: null }))
      .toBeNull()
  })
})

describe('communityPresenceTeaser', () => {
  it('plural-aware', () => {
    expect(communityPresenceTeaser({ livesInDistrict: true, officeCount: 1, recentTownHallCount: 1 }))
      .toBe('Lives in district · 1 office, 1 recent town hall')
    expect(communityPresenceTeaser({ livesInDistrict: true, officeCount: 3, recentTownHallCount: 2 }))
      .toBe('Lives in district · 3 offices, 2 recent town halls')
  })
  it('omits lives-in-district when false', () => {
    expect(communityPresenceTeaser({ livesInDistrict: false, officeCount: 1, recentTownHallCount: 1 }))
      .toBe('1 office, 1 recent town hall')
  })
})

describe('financeTeaser', () => {
  it('formats millions of raised dollars + top industry', () => {
    expect(financeTeaser({ totalRaised: 5_234_189, topIndustry: 'Securities & Investment' }))
      .toBe('$5.2M raised · top industry: Securities & Investment')
  })
  it('omits industry clause when null', () => {
    expect(financeTeaser({ totalRaised: 5_234_189, topIndustry: null }))
      .toBe('$5.2M raised')
  })
})

describe('ethicsAccountabilityTeaser', () => {
  it('renders late-trade count + in/out-of-state donor majority', () => {
    expect(ethicsAccountabilityTeaser({ lateTrades: 1, inStatePct: 67 }))
      .toBe('1 stock trade late · majority of donors in-state')
    expect(ethicsAccountabilityTeaser({ lateTrades: 3, inStatePct: 42 }))
      .toBe('3 stock trades late · majority of donors out-of-state')
  })
})

describe('votingBillsTeaser', () => {
  it('renders attendance label + bill count', () => {
    expect(votingBillsTeaser({ attendancePct: 50, billsThisCongress: 1 }))
      .toBe('Mixed attendance · 1 bill introduced this Congress')
    expect(votingBillsTeaser({ attendancePct: 95, billsThisCongress: 7 }))
      .toBe('High attendance · 7 bills introduced this Congress')
  })
})
