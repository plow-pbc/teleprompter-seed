import { useState, useCallback, useRef, useEffect } from 'react'
import type { ScrollerConfig, DisplaySettings } from './types'
import { Editor } from './components/Editor'
import { Display } from './components/Display'
import { Controls } from './components/Controls'
import { CircularCountdown } from './components/CircularCountdown'
import { ShootingStars } from './components/ui/shooting-stars'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useKeyboard } from './hooks/useKeyboard'
import { useWebSocket } from './hooks/useWebSocket'
import type { PlaySchedulePayload, NtpResponsePayload } from './hooks/useWebSocket'
import type { NtpMeasurement } from './utils/ntp'
import {
  MAX_NTP_MEASUREMENTS,
  INITIAL_INTERVAL_MS,
  STEADY_STATE_INTERVAL_MS,
  calculateOffsetEstimate,
  calculateWaitTimeMilliseconds,
} from './utils/ntp'
import { epochNow } from './utils/time'
import type { SpeechProfile } from './utils/speechProfile'
import {
  FALLBACK_SPEECH_PROFILE,
  loadSpeechProfile,
  saveSpeechProfile,
  estimateWordsPerMinute,
} from './utils/speechProfile'

const clampPlaybackRate = (rate: number): number => Math.min(Math.max(rate, 0.25), 4)

function TeleprompterApp() {
  // Determine mode from URL query parameter
  const [mode, setMode] = useState<'controller' | 'display'>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('mode') === 'display' ? 'display' : 'controller'
  })

  const switchToDisplayMode = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('mode', 'display')
    window.history.pushState({}, '', url)
    setMode('display')
  }, [])

  const switchToControllerMode = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('mode')
    window.history.pushState({}, '', url)
    setMode('controller')
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const [content, setContent] = useLocalStorage<string>('teleprompter-content', '')
  const [isPresenting, setIsPresenting] = useState(false)
  // Local-only mirror setting for display mode (not synced across devices)
  const [isLocalMirrored, setIsLocalMirrored] = useLocalStorage<boolean>('display-mirror', false)

  const [speechProfile, setSpeechProfile] = useState<SpeechProfile>(() => loadSpeechProfile())
  const [playbackRate, setStoredPlaybackRate] = useLocalStorage<number>('teleprompter-playback-rate', 1)

  const [scrollerConfig, setScrollerConfig] = useState<ScrollerConfig>({
    playbackRate,
    isPlaying: false,
    position: 0,
  })

  useEffect(() => {
    const clamped = clampPlaybackRate(playbackRate)
    if (clamped !== playbackRate) {
      setStoredPlaybackRate(clamped)
    }
  }, [playbackRate, setStoredPlaybackRate])

  useEffect(() => {
    setScrollerConfig((prev) => ({ ...prev, playbackRate }))
  }, [playbackRate])

  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    fontSizeVh: 4.5, // Default: 4.5% of viewport height
    lineHeight: 1.8,
    fontFamily: 'sans-serif',
    textColor: '#ffffff',
    backgroundColor: '#000000',
    isMirrored: false,
    isFullscreen: false,
  })

  const [countdownSeconds, setCountdownSeconds] = useState(3)
  const [countdownDeadlineMs, setCountdownDeadlineMs] = useState<number | null>(null)
  const countdownDurationMsRef = useRef<number>(0)
  const countdownStartMsRef = useRef<number | null>(null)

  const playbackStartTimeoutRef = useRef<number | null>(null)
  const playbackScheduleRef = useRef<PlaySchedulePayload | null>(null)
  const [pendingSchedule, setPendingSchedule] = useState<PlaySchedulePayload | null>(null)

  const measurementBufferRef = useRef<NtpMeasurement[]>([])
  const offsetEstimateRef = useRef(0)
  const roundTripEstimateRef = useRef(0)
  const ntpTimerRef = useRef<number | null>(null)

  const clearCountdown = useCallback(() => {
    countdownDurationMsRef.current = 0
    countdownStartMsRef.current = null
    setCountdownDeadlineMs(null)
  }, [])

  const clearScheduledStart = useCallback(() => {
    if (playbackStartTimeoutRef.current !== null) {
      window.clearTimeout(playbackStartTimeoutRef.current)
      playbackStartTimeoutRef.current = null
    }
    playbackScheduleRef.current = null
    setPendingSchedule(null)
  }, [])
  const handleNtpResponse = useCallback((payload: NtpResponsePayload) => {
    const t3 = epochNow()
    const { t0, t1, t2 } = payload
    const clockOffset = (t1 - t0 + (t2 - t3)) / 2
    const roundTripDelay = Math.max(0, t3 - t0 - (t2 - t1))

    const measurement: NtpMeasurement = {
      t0,
      t1,
      t2,
      t3,
      roundTripDelay,
      clockOffset,
    }

    const buffer = [...measurementBufferRef.current, measurement]
    if (buffer.length > MAX_NTP_MEASUREMENTS) {
      buffer.shift()
    }
    measurementBufferRef.current = buffer

    const { averageOffset, averageRoundTrip } = calculateOffsetEstimate(buffer)
    offsetEstimateRef.current = averageOffset
    roundTripEstimateRef.current = averageRoundTrip
  }, [])
  const handlePlaySchedule = useCallback(
    (payload: PlaySchedulePayload) => {
      playbackScheduleRef.current = payload
      setPendingSchedule(payload)

      const waitMs = calculateWaitTimeMilliseconds(
        payload.serverTimeToExecute,
        offsetEstimateRef.current
      )

      const scheduleDeadline = epochNow() + waitMs

      const countdownStart = countdownStartMsRef.current ?? epochNow()
      const totalDuration = Math.max(scheduleDeadline - countdownStart, waitMs, 1)
      countdownDurationMsRef.current = totalDuration
      setCountdownDeadlineMs(scheduleDeadline)
      countdownStartMsRef.current = countdownStart

      console.log(
        `🕒 Received play schedule. Server start in ${waitMs.toFixed(1)}ms `
          + `(offset=${offsetEstimateRef.current.toFixed(2)}ms, RTT=${roundTripEstimateRef.current.toFixed(2)}ms)`
      )

      const scheduledRate = clampPlaybackRate(
        payload.playbackRate
          ?? (payload.wpm ? payload.wpm / 220 : playbackRate)
      )
      if (payload.playbackRate !== undefined) {
        setStoredPlaybackRate(clampPlaybackRate(payload.playbackRate))
      }

      if (waitMs < 50) {
        setScrollerConfig({
          playbackRate: scheduledRate,
          position: payload.position,
          isPlaying: true,
        })
        setPendingSchedule(null)
        playbackScheduleRef.current = null
        clearCountdown()
        return
      }

      if (playbackStartTimeoutRef.current !== null) {
        window.clearTimeout(playbackStartTimeoutRef.current)
        playbackStartTimeoutRef.current = null
      }

      setScrollerConfig({
        playbackRate: scheduledRate,
        position: payload.position,
        isPlaying: false,
      })

      playbackStartTimeoutRef.current = window.setTimeout(() => {
        playbackStartTimeoutRef.current = null
        setPendingSchedule(null)
        playbackScheduleRef.current = null
        clearCountdown()
        setScrollerConfig({
          playbackRate: scheduledRate,
          position: payload.position,
          isPlaying: true,
        })
      }, waitMs)
    },
    [clearCountdown, playbackRate, setStoredPlaybackRate]
  )

  // WebSocket sync
  const { sendStateUpdate, sendPlayEvent, sendNtpRequest, isConnected } = useWebSocket(
    (state) => {
      console.log('🔄 State sync received in App.tsx:', {
        isPresenting: state.isPresenting,
        backgroundColor: state.backgroundColor,
        textColor: state.textColor,
        fontSizeVh: state.fontSizeVh,
      })
      // Sync state from server
      setContent(state.content)
      // Controller mode: only sync isPresenting if already presenting (don't auto-enter presentation)
      if (mode === 'display') {
        setIsPresenting(state.isPresenting)
      }
      if (state.speechProfile) {
        setSpeechProfile(state.speechProfile)
        saveSpeechProfile(state.speechProfile)
      }

      const incomingPlaybackRate = clampPlaybackRate(
        state.playbackRate ?? (state.wpm ? state.wpm / 220 : playbackRate)
      )
      setStoredPlaybackRate(incomingPlaybackRate)

      setScrollerConfig((prev) => ({
        playbackRate: incomingPlaybackRate,
        isPlaying: state.isPlaying ? prev.isPlaying : false,
        position: state.isPlaying ? prev.position : state.position,
      }))
      if (!state.isPlaying && countdownDeadlineMs === null && pendingSchedule === null) {
        clearScheduledStart()
        clearCountdown()
      }
      if (state.countdownSeconds !== undefined) {
        setCountdownSeconds(state.countdownSeconds)
      }
      setDisplaySettings((prev) => ({
        ...prev,
        fontSizeVh: state.fontSizeVh ?? prev.fontSizeVh,
        backgroundColor: state.backgroundColor,
        textColor: state.textColor,
      }))
      console.log('✅ Display settings updated with:', {
        backgroundColor: state.backgroundColor,
        textColor: state.textColor,
        fontSizeVh: state.fontSizeVh,
      })
    },
    true, // Always enabled
    {
      onNtpResponse: handleNtpResponse,
      onPlaySchedule: handlePlaySchedule,
    }
  )

  const pushSpeechProfileUpdate = useCallback(
    (profile: SpeechProfile) => {
      setSpeechProfile(profile)
      saveSpeechProfile(profile)
      if (mode === 'controller') {
        sendStateUpdate({
          speechProfile: profile,
          wpm: estimateWordsPerMinute(profile, playbackRate),
        })
      }
    },
    [mode, playbackRate, sendStateUpdate]
  )

  const applyFallbackProfile = useCallback(() => {
    const fallbackProfile: SpeechProfile = {
      perLengthDurations: { ...FALLBACK_SPEECH_PROFILE.perLengthDurations },
      punctuationPauses: { ...FALLBACK_SPEECH_PROFILE.punctuationPauses },
      updatedAt: new Date().toISOString(),
      source: 'fallback',
    }
    pushSpeechProfileUpdate(fallbackProfile)
  }, [pushSpeechProfileUpdate])

  useEffect(() => {
    if (!isConnected) {
      if (ntpTimerRef.current !== null) {
        window.clearTimeout(ntpTimerRef.current)
        ntpTimerRef.current = null
      }
      measurementBufferRef.current = []
      offsetEstimateRef.current = 0
      roundTripEstimateRef.current = 0
      return
    }

    const sendRequest = () => {
      const estimatedRtt = roundTripEstimateRef.current
      sendNtpRequest(estimatedRtt > 0 ? estimatedRtt : undefined)
    }

    const schedule = () => {
      const interval =
        measurementBufferRef.current.length < MAX_NTP_MEASUREMENTS
          ? INITIAL_INTERVAL_MS
          : STEADY_STATE_INTERVAL_MS

      ntpTimerRef.current = window.setTimeout(() => {
        sendRequest()
        schedule()
      }, interval)
    }

    measurementBufferRef.current = []
    offsetEstimateRef.current = 0
    roundTripEstimateRef.current = 0

    sendRequest()
    schedule()

    return () => {
      if (ntpTimerRef.current !== null) {
        window.clearTimeout(ntpTimerRef.current)
        ntpTimerRef.current = null
      }
    }
  }, [isConnected, sendNtpRequest])

  const isCountdownActive = countdownDeadlineMs !== null
  const hasPendingStart = pendingSchedule !== null

  const startCountdown = useCallback(() => {
    if (countdownSeconds <= 0) {
      sendPlayEvent('play:start', {
        position: scrollerConfig.position,
        playbackRate: scrollerConfig.playbackRate,
        wpm: estimateWordsPerMinute(speechProfile, scrollerConfig.playbackRate),
      })
      return
    }

    const durationMs = countdownSeconds * 1000
    const start = epochNow()
    const deadline = start + durationMs
    countdownStartMsRef.current = start
    countdownDurationMsRef.current = durationMs
    setCountdownDeadlineMs(deadline)

    const serverNowEstimate = start + offsetEstimateRef.current
    const desiredServerStart = serverNowEstimate + durationMs

    sendPlayEvent('play:start', {
      position: scrollerConfig.position,
      playbackRate: scrollerConfig.playbackRate,
      wpm: estimateWordsPerMinute(speechProfile, scrollerConfig.playbackRate),
      desiredStartMs: desiredServerStart,
    })
  }, [
    countdownSeconds,
    scrollerConfig.playbackRate,
    scrollerConfig.position,
    sendPlayEvent,
    speechProfile,
  ])


  const togglePlay = () => {
    if (mode !== 'controller') {
      return
    }

    if (scrollerConfig.isPlaying) {
      clearCountdown()
      clearScheduledStart()
      sendPlayEvent('play:pause', { position: scrollerConfig.position })
      return
    }

    if (isCountdownActive || hasPendingStart) {
      sendPlayEvent('play:pause', { position: scrollerConfig.position })
      clearCountdown()
      clearScheduledStart()
      return
    }

    startCountdown()
  }

  const changePlaybackRate = (rate: number) => {
    const clamped = clampPlaybackRate(rate)
    setStoredPlaybackRate(clamped)
    setScrollerConfig((prev) => ({ ...prev, playbackRate: clamped }))
    if (mode === 'controller') {
      sendStateUpdate({ playbackRate: clamped, wpm: estimateWordsPerMinute(speechProfile, clamped) })
    }
  }

  const changeFontSize = (fontSizeVh: number) => {
    setDisplaySettings((prev) => ({ ...prev, fontSizeVh }))
    if (mode === 'controller') {
      sendStateUpdate({ fontSizeVh })
    }
  }

  const changeCountdownConfig = (seconds: number) => {
    setCountdownSeconds(seconds)
    if (mode === 'controller') {
      sendStateUpdate({ countdownSeconds: seconds })
    }
  }

  const speedUp = () => {
    const newRate = clampPlaybackRate(scrollerConfig.playbackRate + 0.1)
    changePlaybackRate(Number(newRate.toFixed(2)))
  }

  const speedDown = () => {
    const newRate = clampPlaybackRate(scrollerConfig.playbackRate - 0.1)
    changePlaybackRate(Number(newRate.toFixed(2)))
  }

  const resetScroll = () => {
    clearCountdown()
    clearScheduledStart()
    setScrollerConfig((prev) => ({
      ...prev,
      position: 0,
      isPlaying: false,
    }))
    if (mode === 'controller') {
      sendPlayEvent('play:reset')
    }
  }

  // Throttle position updates to avoid re-render storms
  const lastPositionUpdateRef = useRef<number>(0)
  const updatePosition = useCallback((position: number) => {
    const now = Date.now()
    // Only update position every 100ms to avoid excessive WebSocket traffic and re-renders
    if (now - lastPositionUpdateRef.current < 100) {
      return
    }
    lastPositionUpdateRef.current = now

    setScrollerConfig((prev) => ({
      ...prev,
      position,
    }))
    const isPlaying = scrollerConfig.isPlaying
    if (mode === 'controller' && !isPlaying) {
      sendStateUpdate({ position })
    }
  }, [mode, scrollerConfig.isPlaying, sendStateUpdate])

  // Stable no-op function for display clients
  const noOpPositionChange = useCallback(() => {}, [])

  const startPresenting = () => {
    console.log('🎬 startPresenting called!')
    clearCountdown()
    clearScheduledStart()
    setIsPresenting(true)
    console.log('✅ setIsPresenting(true) called')
    setScrollerConfig((prev) => ({
      ...prev,
      position: 0,
      isPlaying: false,
    }))
    // Set dark mode for presenting
    setDisplaySettings((prev) => ({
      ...prev,
      backgroundColor: '#000000',
      textColor: '#ffffff',
    }))
    console.log('🎨 Display settings updated to dark mode')
    if (mode === 'controller') {
      console.log('📤 Sending state update via WebSocket...')
      sendStateUpdate({
        isPresenting: true,
        position: 0,
        isPlaying: false,
        backgroundColor: '#000000',
        textColor: '#ffffff',
      })
      console.log('✅ State update sent')
    }
  }

  const exitPresenting = () => {
    setIsPresenting(false)
    clearCountdown()
    clearScheduledStart()
    setScrollerConfig((prev) => ({
      ...prev,
      isPlaying: false,
      position: 0,
    }))
    if (mode === 'controller') {
      sendStateUpdate({ isPresenting: false, isPlaying: false, position: 0 })
    }
  }

  const updateContent = (newContent: string) => {
    setContent(newContent)
    if (mode === 'controller') {
      sendStateUpdate({ content: newContent })
    }
  }

  // Keyboard shortcuts (only active during presentation and controller mode)
  useKeyboard(
    {
      onTogglePlay: togglePlay,
      onSpeedUp: speedUp,
      onSpeedDown: speedDown,
      onReset: resetScroll,
    },
    isPresenting && mode === 'controller'
  )

  // Display-only mode (phone)
  const renderPresentationView = (showControls: boolean, showActions: boolean) => {
    const indicatorDotClasses = `h-3 w-3 rounded-full ${
      isConnected
        ? 'bg-[#00ff88] shadow-[0_0_20px_#00ff88] animate-pulse-glow'
        : 'bg-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.8)] animate-pulse-glow'
    }`
    const countdownDuration = countdownDurationMsRef.current || countdownSeconds * 1000

    return (
      <div
        className="relative h-screen overflow-hidden bg-black text-white"
        style={{ transform: !showControls && isLocalMirrored ? 'scaleY(-1)' : 'none' }}
      >
        {/* Background with stars */}
        <div className="absolute inset-0">
          <div className="stars absolute inset-0" />
        </div>

        {/* Shooting stars layers */}
        <ShootingStars
          starColor="#9E7AFF"
          trailColor="#2EB9DF"
          minSpeed={10}
          maxSpeed={30}
          minDelay={1000}
          maxDelay={3000}
        />
        <ShootingStars
          starColor="#FF6EC7"
          trailColor="#FEF08A"
          minSpeed={15}
          maxSpeed={35}
          minDelay={1500}
          maxDelay={4000}
        />
        <ShootingStars
          starColor="#06FFA5"
          trailColor="#5EEAD4"
          minSpeed={12}
          maxSpeed={28}
          minDelay={2000}
          maxDelay={5000}
        />

        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center px-3 pt-4 sm:px-8">
          <div className="flex w-full max-w-6xl flex-row items-center gap-3 overflow-x-auto rounded-[1.5rem] border border-indigo-500/30 bg-black/10 px-3 py-2.5 shadow-[0_16px_32px_-24px_rgba(99,102,241,0.4)] backdrop-blur-sm sm:gap-4 sm:px-6 sm:py-3.5">
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 shadow-lg shadow-indigo-500/20 backdrop-blur-md">
                <div className={indicatorDotClasses} />
                <span className="text-xs font-medium text-white sm:text-sm leading-none flex items-center">
                  {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center gap-2 sm:gap-4">
              {showActions ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={exitPresenting}
                    className="rounded-xl border-2 border-destructive/40 bg-destructive/20 px-5 py-2 text-sm font-semibold text-destructive-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-destructive/60 hover:bg-destructive/30 focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  >
                    ← Exit
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap sm:overflow-visible">
                  <button
                    onClick={() => setIsLocalMirrored(!isLocalMirrored)}
                    className={`h-9 w-32 rounded-xl border-2 px-3 text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 sm:h-10 sm:w-40 sm:px-4 sm:text-sm ${
                      isLocalMirrored
                        ? 'border-indigo-500/70 bg-indigo-500/30 text-indigo-300 ring-indigo-500/40'
                        : 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300 ring-indigo-500/40'
                    }`}
                  >
                    {isLocalMirrored ? '🪞 Mirrored' : '🪞 Mirror'}
                  </button>
                  <button
                    onClick={switchToControllerMode}
                    className="h-9 w-32 rounded-xl border-2 border-indigo-500/40 bg-indigo-500/15 px-3 text-xs font-semibold text-indigo-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/70 hover:bg-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 sm:h-10 sm:w-40 sm:px-4 sm:text-sm"
                  >
                    🎛️ Controller
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="relative h-full">
          {isCountdownActive && countdownDeadlineMs !== null ? (
            <CircularCountdown
              durationMs={countdownDuration}
              deadlineMs={countdownDeadlineMs}
              formatPrimary={(remaining) =>
                Math.max(1, Math.ceil(remaining / 1000)).toString()
              }
              label="Prepare to start"
            />
          ) : null}

          <Display
            content={content}
            settings={displaySettings}
            scrollerConfig={scrollerConfig}
            onPositionChange={showControls ? updatePosition : noOpPositionChange}
            enableAutoScroll={true}
            speechProfile={speechProfile}
          />
        </div>

        {showControls ? (
          <Controls
            config={scrollerConfig}
            fontSizeVh={displaySettings.fontSizeVh}
            countdownSeconds={countdownSeconds}
            isCountdownActive={isCountdownActive}
            hasPendingStart={hasPendingStart}
            onTogglePlay={togglePlay}
            onPlaybackRateChange={changePlaybackRate}
            onFontSizeChange={changeFontSize}
            onReset={resetScroll}
            onCountdownChange={changeCountdownConfig}
          />
        ) : null}
      </div>
    )
  }

  if (mode === 'display') {
    return renderPresentationView(false, false)
  }

  if (!isPresenting) {
    return (
      <Editor
        content={content}
        onChange={updateContent}
        onStartPresenting={startPresenting}
        onSwitchToDisplay={switchToDisplayMode}
        speechProfile={speechProfile}
        onSpeechProfileUpdate={pushSpeechProfileUpdate}
        onUseFallbackProfile={applyFallbackProfile}
      />
    )
  }

  return renderPresentationView(true, true)
}

function App() {
  // Local recording tool: no auth, render the teleprompter directly
  return <TeleprompterApp />
}

export default App
