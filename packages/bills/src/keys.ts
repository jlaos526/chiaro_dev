export const billsKeys = {
  all: ['bills'] as const,
  lists: () => [...billsKeys.all, 'list'] as const,
  list: (filters: { congress?: string; subject?: string; sponsorId?: string; status?: string }) =>
    [...billsKeys.lists(), filters] as const,
  detail: (id: string) => [...billsKeys.all, 'detail', id] as const,
  officialSponsored: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'sponsored', congress] as const,
  officialCosponsored: (officialId: string, congress: string) =>
    [...billsKeys.all, 'official', officialId, 'cosponsored', congress] as const,
} as const

export const votesKeys = {
  all: ['votes'] as const,
  byBill: (billId: string) => [...votesKeys.all, 'by-bill', billId] as const,
  officialMissed: (officialId: string, congress: string) =>
    [...votesKeys.all, 'official', officialId, 'missed', congress] as const,
  officialOnSubject: (officialId: string, subject: string) =>
    [...votesKeys.all, 'official', officialId, 'subject', subject] as const,
} as const
