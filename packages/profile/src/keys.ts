// Hierarchical TanStack Query keys for the profile domain.
// Invalidate `profileKeys.all` to clear everything; `profileKeys.me()` to
// refresh just the current user's profile. Mirrors locationKeys shape.

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
} as const
