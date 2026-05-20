export const stateBillsKeys = {
  all: ['state-bills'] as const,
  byOfficialSponsored: (officialId: string) =>
    ['state-bills', 'byOfficialSponsored', officialId] as const,
  byOfficialCosponsored: (officialId: string) =>
    ['state-bills', 'byOfficialCosponsored', officialId] as const,
  byOfficialVotes: (officialId: string) =>
    ['state-bills', 'byOfficialVotes', officialId] as const,
  byOfficialMissedVotes: (officialId: string) =>
    ['state-bills', 'byOfficialMissedVotes', officialId] as const,
  byId: (billId: string) =>
    ['state-bills', 'byId', billId] as const,
} as const
