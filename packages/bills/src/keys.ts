export const billsKeys = {
  all: ['bills'] as const,
  officialSponsored: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'sponsored', congress] as const,
  officialCosponsored: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'cosponsored', congress] as const,
} as const

export const votesKeys = {
  all: ['votes'] as const,
  officialMissed: (officialId: string, congress: string) =>
    [...votesKeys.all, 'official', officialId, 'missed', congress] as const,
} as const
