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
    function applyHash(rawHash: string) {
      const parsed = parseHash(rawHash)
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
    }

    const initialHash = hashOverride ?? (typeof window !== 'undefined' ? window.location.hash : '')
    applyHash(initialHash)

    // hashchange: BioHeader chips on the same page update the URL hash without
    // remounting; we still need to expand + scroll. Skip when an override was
    // supplied (tests inject a static hash).
    if (typeof window === 'undefined' || hashOverride !== undefined) return
    const handler = () => applyHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
