import { useEffect, useState } from 'react'
import { Redirect, useSegments } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BrandDrawer } from '@chiaro/officials-ui'
import { supabase } from '@/lib/supabase'

type CalibrationStatus = 'unknown' | 'calibrated' | 'uncalibrated' | 'skipped'

export default function AppLayout() {
  const segments = useSegments()
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>('unknown')

  useEffect(() => {
    let mounted = true
    async function check() {
      const skip = await AsyncStorage.getItem('chiaro_skip_calibrate')
      if (!mounted) return
      if (skip === '1') {
        setCalibrationStatus('skipped')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return
      const { count } = await supabase
        .from('user_locations')
        .select('id', { head: true, count: 'exact' })
        .eq('id', user.id)
      if (!mounted) return
      setCalibrationStatus((count ?? 0) > 0 ? 'calibrated' : 'uncalibrated')
    }
    check()
    return () => { mounted = false }
  }, [])

  const segmentList = segments as readonly string[]
  const onCalibrate = segmentList[segmentList.length - 1] === 'calibrate'
  const onSettings = segmentList.includes('settings')
  if (calibrationStatus === 'uncalibrated' && !onCalibrate && !onSettings) {
    return <Redirect href="/calibrate" />
  }

  return <BrandDrawer />
}
