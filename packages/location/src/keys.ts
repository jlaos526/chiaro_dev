// Hierarchical TanStack Query keys for the location domain.
// Invalidate `locationKeys.all` to clear everything; `locationKeys.districts()`
// or `locationKeys.homePoint()` to refresh just one.

export const locationKeys = {
  all: ['location'] as const,
  districts: () => [...locationKeys.all, 'districts', 'mine'] as const,
  homePoint: () => [...locationKeys.all, 'home-point', 'mine'] as const,
} as const
