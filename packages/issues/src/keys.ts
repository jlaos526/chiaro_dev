export const issuesKeys = {
  all: ['issues'] as const,
  catalog: () => [...issuesKeys.all, 'catalog'] as const,
  mySelections: () => [...issuesKeys.all, 'mySelections'] as const,
  repAlignment: (officialId: string) => [...issuesKeys.all, 'repAlignment', officialId] as const,
  repWatchlistFlags: (officialId: string) => [...issuesKeys.all, 'repWatchlistFlags', officialId] as const,
}
