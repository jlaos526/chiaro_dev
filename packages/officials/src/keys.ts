// Hierarchical query keys for TanStack Query.
// Invalidate `officialsKeys.all` to clear everything;
// `officialsKeys.detail(id)` to surgically refresh one row after a mutation.

export const officialsKeys = {
  all: ['officials'] as const,
  lists: () => [...officialsKeys.all, 'list'] as const,
  myList: () => [...officialsKeys.lists(), 'mine'] as const,
  detail: (id: string) => [...officialsKeys.all, 'detail', id] as const,
  metrics:           (id: string) => [...officialsKeys.all, 'metrics', id] as const,
  scorecards:        (id: string) => [...officialsKeys.all, 'scorecards', id] as const,
  finance:           (id: string, cycle: string) => [...officialsKeys.all, 'finance', id, cycle] as const,
  stateFinanceSummary: (officialId: string) =>
    ['officials', 'stateFinanceSummary', officialId] as const,
  stateDonors: (officialId: string) =>
    ['officials', 'stateDonors', officialId] as const,
  stateScorecardRatings: (officialId: string) =>
    ['officials', 'stateScorecardRatings', officialId] as const,
  stateTownHalls: (officialId: string) =>
    ['officials', 'stateTownHalls', officialId] as const,
  stateDistrictOffices: (officialId: string) =>
    ['officials', 'stateDistrictOffices', officialId] as const,
  stateCommitteeHearings: (officialId: string, session?: string) =>
    ['officials', 'stateCommitteeHearings', officialId, session ?? 'latest'] as const,
  districtOffices:   (id: string) => [...officialsKeys.all, 'district-offices', id] as const,
  townHalls:         (id: string, congress: string) => [...officialsKeys.all, 'town-halls', id, congress] as const,
  stockTransactions: (id: string) => [...officialsKeys.all, 'stock-transactions', id] as const,
  leadershipHistory: (id: string) => [...officialsKeys.all, 'leadership-history', id] as const,
} as const
