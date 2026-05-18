import { useCallback, useState } from 'react'
import type { CategoryId } from '@chiaro/ui-tokens'

export interface ExpandedStateSeed {
  categories?: CategoryId[]
  subCascades?: string[]  // format: "<categoryId>:<subId>"
}

export interface ExpandedStateApi {
  isCategoryOpen: (id: CategoryId) => boolean
  toggleCategory: (id: CategoryId) => void
  openCategory: (id: CategoryId) => void
  isSubCascadeOpen: (categoryId: CategoryId, subId: string) => boolean
  toggleSubCascade: (categoryId: CategoryId, subId: string) => void
  openSubCascade: (categoryId: CategoryId, subId: string) => void
}

export function useExpandedState(seed?: ExpandedStateSeed): ExpandedStateApi {
  const [categories, setCategories] = useState<Set<CategoryId>>(
    () => new Set(seed?.categories ?? [])
  )
  const [subCascades, setSubCascades] = useState<Set<string>>(
    () => new Set(seed?.subCascades ?? [])
  )

  const subKey = (c: CategoryId, s: string) => `${c}:${s}`

  const isCategoryOpen = useCallback((id: CategoryId) => categories.has(id), [categories])

  const toggleCategory = useCallback((id: CategoryId) => {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openCategory = useCallback((id: CategoryId) => {
    setCategories((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  const isSubCascadeOpen = useCallback(
    (c: CategoryId, s: string) => subCascades.has(subKey(c, s)),
    [subCascades],
  )

  const toggleSubCascade = useCallback((c: CategoryId, s: string) => {
    const k = subKey(c, s)
    setSubCascades((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setCategories((prev) => (prev.has(c) ? prev : new Set(prev).add(c)))
  }, [])

  const openSubCascade = useCallback((c: CategoryId, s: string) => {
    const k = subKey(c, s)
    setSubCascades((prev) => (prev.has(k) ? prev : new Set(prev).add(k)))
    setCategories((prev) => (prev.has(c) ? prev : new Set(prev).add(c)))
  }, [])

  return { isCategoryOpen, toggleCategory, openCategory, isSubCascadeOpen, toggleSubCascade, openSubCascade }
}
