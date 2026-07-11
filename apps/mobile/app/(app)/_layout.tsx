import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect, useSegments } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BrandDrawer } from '@chiaro/officials-ui/src/nav/BrandDrawer.tsx'
import { supabase } from '@/lib/supabase'

type CalibrationStatus = 'unknown' | 'calibrated' | 'uncalibrated' | 'skipped'

export default function AppLayout() {
  const segments = useSegments()
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>('unknown')

  const segmentList = segments as readonly string[]
  const onCalibrate = segmentList[segmentList.length - 1] === 'calibrate'
  const onSettings = segmentList.includes('settings')

  // Probe AsyncStorage skip flag + user_locations count. Shared by the
  // mount-time check and the post-calibrate re-probe (audit U1).
  const check = useCallback(async (isActive: () => boolean) => {
    // Both reads are LOCAL (AsyncStorage + getSession — no network getUser),
    // and independent, so run them in parallel (C10).
    const [skip, sessionRes] = await Promise.all([
      AsyncStorage.getItem('chiaro_skip_calibrate'),
      supabase.auth.getSession(),
    ])
    if (!isActive()) return
    if (skip === '1') {
      setCalibrationStatus('skipped')
      return
    }
    const user = sessionRes.data.session?.user
    if (!isActive() || !user) return
    const { count } = await supabase
      .from('user_locations')
      .select('id', { head: true, count: 'exact' })
      .eq('id', user.id)
    if (!isActive()) return
    setCalibrationStatus((count ?? 0) > 0 ? 'calibrated' : 'uncalibrated')
  }, [])

  // Runs on mount (status starts 'unknown') and again whenever status is
  // reset to 'unknown' by the post-calibrate re-probe below.
  useEffect(() => {
    if (calibrationStatus !== 'unknown') return
    let mounted = true
    check(() => mounted)
    return () => {
      mounted = false
    }
  }, [calibrationStatus, check])

  // Audit U1: leaving /calibrate with a stale non-calibrated status used to
  // redirect every route straight back to /calibrate forever (the mount-time
  // check never re-ran after calibrate.tsx's router.replace('/')). Reset to
  // 'unknown' DURING RENDER (React's adjust-state-while-rendering pattern)
  // when the user navigates away from the calibrate route: an effect would be
  // too late — the <Redirect> child below would mount first and its own
  // effect would navigate before ours could reset. 'unknown' shows the
  // ActivityIndicator gate (slice 61 B12) while the effect above re-probes.
  const [prevOnCalibrate, setPrevOnCalibrate] = useState(onCalibrate)
  if (prevOnCalibrate !== onCalibrate) {
    setPrevOnCalibrate(onCalibrate)
    if (
      prevOnCalibrate &&
      (calibrationStatus === 'uncalibrated' || calibrationStatus === 'skipped')
    ) {
      setCalibrationStatus('unknown')
    }
  }

  if (calibrationStatus === 'unknown') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }

  if (calibrationStatus === 'uncalibrated' && !onCalibrate && !onSettings) {
    return <Redirect href="/calibrate" />
  }

  return <BrandDrawer />
}
