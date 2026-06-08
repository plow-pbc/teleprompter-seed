import { epochNow } from './time'

export interface NtpMeasurement {
  t0: number
  t1: number
  t2: number
  t3: number
  roundTripDelay: number
  clockOffset: number
}

export const MAX_NTP_MEASUREMENTS = 40
export const INITIAL_INTERVAL_MS = 30
export const STEADY_STATE_INTERVAL_MS = 2500
export const RESPONSE_TIMEOUT_MS = STEADY_STATE_INTERVAL_MS * 1.5

export const calculateOffsetEstimate = (ntpMeasurements: NtpMeasurement[]) => {
  if (ntpMeasurements.length === 0) {
    return { averageOffset: 0, averageRoundTrip: 0 }
  }

  const sortedMeasurements = [...ntpMeasurements].sort(
    (a, b) => a.roundTripDelay - b.roundTripDelay
  )
  const bestMeasurements = sortedMeasurements.slice(
    0,
    Math.ceil(sortedMeasurements.length / 2)
  )

  const totalRoundTrip = ntpMeasurements.reduce(
    (sum, measurement) => sum + measurement.roundTripDelay,
    0
  )
  const averageRoundTrip = totalRoundTrip / ntpMeasurements.length

  const totalOffset = bestMeasurements.reduce(
    (sum, measurement) => sum + measurement.clockOffset,
    0
  )
  const averageOffset = totalOffset / bestMeasurements.length

  return { averageOffset, averageRoundTrip }
}

export const calculateWaitTimeMilliseconds = (
  targetServerTime: number,
  clockOffset: number
): number => {
  const estimatedCurrentServerTime = epochNow() + clockOffset
  return Math.max(0, targetServerTime - estimatedCurrentServerTime)
}
