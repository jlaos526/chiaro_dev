export const billsKeys = {
  all: ['bills'] as const,
  officialSponsored: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'sponsored', congress] as const,
  officialCosponsored: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'cosponsored', congress] as const,
  officialSponsoredCount: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'sponsored-count', congress] as const,
  officialCosponsoredCount: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'cosponsored-count', congress] as const,
} as const

export const votesKeys = {
  all: ['votes'] as const,
  officialMissed: (officialId: string, congress: string) =>
    [...votesKeys.all, 'official', officialId, 'missed', congress] as const,
  officialMissedCount: (officialId: string, congress: string) =>
    [...votesKeys.all, 'official', officialId, 'missed-count', congress] as const,
} as const
