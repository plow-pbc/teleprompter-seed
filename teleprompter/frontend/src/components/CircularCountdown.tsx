import { useEffect, useMemo, useRef, useState } from 'react'
import { epochNow } from '../utils/time'

interface CircularCountdownProps {
  durationMs: number
  deadlineMs: number
  formatPrimary: (remainingMs: number) => string
  label?: string
}

const BASE_SIZE = 160
const MIN_SIZE = 130
const MAX_SIZE = 220

const computeSize = (): number => {
  if (typeof window === 'undefined') {
    return BASE_SIZE
  }
  const viewportBound = window.innerWidth * 0.28
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, viewportBound))
}

export function CircularCountdown({
  durationMs,
  deadlineMs,
  formatPrimary,
  label,
}: CircularCountdownProps) {
  const [containerSize, setContainerSize] = useState<number>(() => computeSize())
  const baselineRef = useRef<number>(Math.max(durationMs, 1))
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, deadlineMs - epochNow())
  )
  const [dashOffset, setDashOffset] = useState<number>(() => 0)
  const [dashTransition, setDashTransition] = useState<string>('none')
  const tickRafRef = useRef<number | null>(null)
  const animateRafRef = useRef<number | null>(null)

  useEffect(() => {
    const handleResize = () => setContainerSize(computeSize())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const strokeWidth = Math.max(containerSize * 0.05, 10)
  const radius = containerSize / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const remainingAtStart = Math.max(0, deadlineMs - epochNow())
    const resolvedDuration =
      durationMs > 0 ? durationMs : Math.max(remainingAtStart, 1)
    baselineRef.current = resolvedDuration
    setRemainingMs(remainingAtStart)

    const initialProgress = Math.min(
      Math.max(1 - remainingAtStart / resolvedDuration, 0),
      1
    )
    setDashTransition('none')
    setDashOffset(circumference * initialProgress)

    if (animateRafRef.current !== null) {
      window.cancelAnimationFrame(animateRafRef.current)
    }
    animateRafRef.current = window.requestAnimationFrame(() => {
      const startRemaining = Math.max(0, deadlineMs - epochNow())
      const durationSeconds = startRemaining / 1000

      setDashTransition(
        durationSeconds > 0
          ? `stroke-dashoffset ${durationSeconds}s linear`
          : 'none'
      )
      setDashOffset(circumference)
    })

    const update = () => {
      const nextRemaining = Math.max(0, deadlineMs - epochNow())

      setRemainingMs(nextRemaining)

      if (nextRemaining > 0) {
        tickRafRef.current = window.requestAnimationFrame(update)
      } else {
        tickRafRef.current = null
      }
    }

    if (tickRafRef.current !== null) {
      window.cancelAnimationFrame(tickRafRef.current)
    }
    tickRafRef.current = window.requestAnimationFrame(update)

    return () => {
      if (tickRafRef.current !== null) {
        window.cancelAnimationFrame(tickRafRef.current)
        tickRafRef.current = null
      }
      if (animateRafRef.current !== null) {
        window.cancelAnimationFrame(animateRafRef.current)
        animateRafRef.current = null
      }
    }
  }, [circumference, deadlineMs, durationMs])

  const primaryText = useMemo(() => {
    const baseline = baselineRef.current || 1
    const clampedRemaining = Math.max(0, Math.min(baseline, remainingMs))
    return formatPrimary(clampedRemaining)
  }, [formatPrimary, remainingMs])

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4">
      <div className="relative flex w-full max-w-[65vw] flex-col items-center gap-4 rounded-[1.5rem] border border-primary/35 bg-black/25 p-6 text-center shadow-[0_25px_50px_-12px_rgba(124,58,237,0.45)] backdrop-blur-md sm:max-w-sm sm:gap-6 sm:rounded-[2rem] sm:p-10">
        {label ? (
          <div className="text-xs uppercase tracking-[0.5em] text-primary/70">
            {label}
          </div>
        ) : null}
        <div className="relative">
          <svg
            width={containerSize}
            height={containerSize}
            style={{ transform: 'rotate(-90deg)' }}
            className="drop-shadow-[0_0_45px_rgba(59,130,246,0.35)]"
          >
            <defs>
              <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7b2ff7" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
            </defs>
            <circle
              cx={containerSize / 2}
              cy={containerSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={containerSize / 2}
              cy={containerSize / 2}
              r={radius}
              fill="none"
              stroke="url(#countdownGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={dashOffset}
              style={{ transition: dashTransition }}
            />
          </svg>
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center text-white">
            <div className="text-[clamp(3rem,12vw,5.5rem)] font-black leading-none tracking-tight drop-shadow-[0_15px_35px_rgba(124,58,237,0.35)]">
              {primaryText}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
