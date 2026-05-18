import { useEffect } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { type CategoryId, CATEGORY_LABEL } from '@chiaro/ui-tokens'
import type { ExpandedStateApi } from './useExpandedState'

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL))

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

export function useExpoParamSync(api: ExpandedStateApi): void {
  const params = useLocalSearchParams<{ cat?: string | string[]; sub?: string | string[] }>()
  const cat = pickFirst(params.cat)
  const sub = pickFirst(params.sub)

  useEffect(() => {
    if (!cat || !VALID_CATEGORIES.has(cat)) return
    api.openCategory(cat as CategoryId)
    if (sub) api.openSubCascade(cat as CategoryId, sub)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, sub])
}
