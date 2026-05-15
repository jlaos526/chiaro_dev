// Hierarchical query keys for TanStack Query.
// Invalidate `officialsKeys.all` to clear everything;
// `officialsKeys.detail(id)` to surgically refresh one row after a mutation.

export const officialsKeys = {
  all: ['officials'] as const,
  lists: () => [...officialsKeys.all, 'list'] as const,
  myList: () => [...officialsKeys.lists(), 'mine'] as const,
  detail: (id: string) => [...officialsKeys.all, 'detail', id] as const,
} as const
