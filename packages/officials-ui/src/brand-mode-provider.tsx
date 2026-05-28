'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { BrandModeOverrideContext } from './brand-hooks.ts'
import type { BrandMode } from '@chiaro/ui-tokens'

interface SetterCtx {
  override: BrandMode | null
  setMode: (mode: BrandMode | null) => void
}

const BrandModeSetterContext = createContext<SetterCtx | null>(null)

export interface BrandModeProviderProps {
  defaultMode: BrandMode | null
  onChange?: ((mode: BrandMode | null) => void | Promise<void>) | undefined
  children?: ReactNode
}

export function BrandModeProvider({ defaultMode, onChange, children }: BrandModeProviderProps) {
  const [override, setOverride] = useState<BrandMode | null>(defaultMode)
  const setMode = useCallback(
    (mode: BrandMode | null) => {
      setOverride(mode)
      void onChange?.(mode)
    },
    [onChange],
  )
  const setterValue = useMemo<SetterCtx>(() => ({ override, setMode }), [override, setMode])
  return (
    <BrandModeOverrideContext.Provider value={override}>
      <BrandModeSetterContext.Provider value={setterValue}>
        {children}
      </BrandModeSetterContext.Provider>
    </BrandModeOverrideContext.Provider>
  )
}

export function useBrandModeSetter(): SetterCtx {
  const ctx = useContext(BrandModeSetterContext)
  if (!ctx) {
    throw new Error('useBrandModeSetter must be used inside <BrandModeProvider>')
  }
  return ctx
}
