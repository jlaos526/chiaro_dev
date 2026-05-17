import { useEffect } from 'react'
import { type CategoryId, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import type { ExpandedStateApi } from './useExpandedState.ts'

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL))

export interface ParsedHash {
  categoryId: CategoryId
  subId: string | null
}

export function parseHash(hash: string): ParsedHash | null {
  const trimmed = hash.replace(/^#/, '')
  if (!trimmed) return null
  const [categoryId, subId = null] = trimmed.split(':')
  if (!categoryId || !VALID_CATEGORIES.has(categoryId)) return null
  return { categoryId: categoryId as CategoryId, subId }
}

export function useUrlHashSync(api: ExpandedStateApi, hashOverride?: string): void {
  useEffect(() => {
    const hash = hashOverride ?? (typeof window !== 'undefined' ? window.location.hash : '')
    const parsed = parseHash(hash)
    if (!parsed) return
    api.openCategory(parsed.categoryId)
    if (parsed.subId) {
      api.openSubCascade(parsed.categoryId, parsed.subId)
      requestAnimationFrame(() => {
        const el = document.getElementById(`subcat-${parsed.categoryId}-${parsed.subId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else {
      requestAnimationFrame(() => {
        const el = document.getElementById(`category-${parsed.categoryId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
