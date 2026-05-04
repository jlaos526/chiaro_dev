import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { createChiaroClient } from '@chiaro/supabase-client'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

export const supabase = createChiaroClient({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  storage: AsyncStorage,
})

// Documented Supabase + RN pattern: refresh tokens while foregrounded; pause when backgrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
