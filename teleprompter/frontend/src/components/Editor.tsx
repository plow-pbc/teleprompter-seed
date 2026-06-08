import { useCallback, useEffect, useRef, useState } from 'react'

import type { SpeechProfile } from '../utils/speechProfile'
import { blobToBase64 } from '../utils/audio'
import { buildSpeechProfileFromStt, FALLBACK_SPEECH_PROFILE } from '../utils/speechProfile'
import { ShinyButton } from './ui/shiny-button'
import { GlowCard } from './ui/spotlight-card'
import { SparklesCore } from './ui/sparkles'

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onStartPresenting: () => void
  onSwitchToDisplay?: () => void
  accountLabel?: string
  onSignOut?: () => Promise<void>
  isSigningOut?: boolean
  speechProfile: SpeechProfile
  onSpeechProfileUpdate: (profile: SpeechProfile) => void
  onUseFallbackProfile: () => void
}

type TrainingStep = 'intro' | 'recording' | 'processing' | 'result'

interface SttResponse {
  transcription: string
  audio_duration_seconds: number
  word_count: number
  timing_profile: {
    per_length_durations?: Record<string, number>
    punctuation_pauses?: Record<string, number>
  } | null
}

const TRAINING_DURATION = 15
const MIN_RING_SIZE = 110
const MAX_RING_SIZE = 200
const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]
const DEFAULT_MIME_TYPE = 'audio/webm;codecs=opus'
const TRANSCRIPTION_PREVIEW_LENGTH = 120

const computeRingSize = (): number => {
  if (typeof window === 'undefined') {
    return 160
  }
  const smallestSide = Math.min(window.innerWidth, window.innerHeight)
  return Math.max(MIN_RING_SIZE, Math.min(MAX_RING_SIZE, smallestSide * 0.28))
}

const selectMimeType = (): string | null => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null
  }
  for (const type of SUPPORTED_MIME_TYPES) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return DEFAULT_MIME_TYPE
}

const createTranscriptionPreview = (text: string): string => {
  if (!text) {
    return ''
  }
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= TRANSCRIPTION_PREVIEW_LENGTH) {
    return clean
  }
  return `${clean.slice(0, TRANSCRIPTION_PREVIEW_LENGTH)}…`
}

export function Editor({
  content,
  onChange,
  onStartPresenting,
  onSwitchToDisplay,
  accountLabel,
  onSignOut,
  isSigningOut,
  speechProfile,
  onSpeechProfileUpdate,
  onUseFallbackProfile,
}: EditorProps) {
  const [trainingStep, setTrainingStep] = useState<TrainingStep>('intro')
  const [countdownSeconds, setCountdownSeconds] = useState<number>(TRAINING_DURATION)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [progressRingSize, setProgressRingSize] = useState<number>(() => computeRingSize())
  const [isMobile, setIsMobile] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))
  const [, setHighlightStartRecording] = useState<boolean>(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [transcriptionPreview, setTranscriptionPreview] = useState<string>(() =>
    speechProfile.transcription ? createTranscriptionPreview(speechProfile.transcription) : ''
  )
  const [calibrationMeta, setCalibrationMeta] = useState<{ duration: number; wordCount: number } | null>(null)
  const [profileAcknowledged, setProfileAcknowledged] = useState<boolean>(
    speechProfile.source === 'stt' || speechProfile.updatedAt !== 'static'
  )

  const countdownIntervalRef = useRef<number | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordedBlobRef = useRef<Blob | null>(null)
  const pendingStopResolverRef = useRef<((blob: Blob | null) => void) | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const hasSidebar = !profileAcknowledged

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const resizeListener = () => {
      setProgressRingSize(computeRingSize())
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', resizeListener)
    return () => {
      window.removeEventListener('resize', resizeListener)
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
        highlightTimeoutRef.current = null
      }
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
          }
        } catch (error) {
          console.warn('Error stopping media recorder during cleanup', error)
        }
        mediaRecorderRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!hasSidebar) {
      setTrainingStep('intro')
      setCountdownSeconds(TRAINING_DURATION)
      setIsCollapsed(false)
      return
    }
    if (isMobile) {
      setIsCollapsed(true)
    } else {
      setIsCollapsed(false)
    }
  }, [hasSidebar, isMobile])

  useEffect(() => {
    if (speechProfile.source === 'stt') {
      setTranscriptionPreview(
        speechProfile.transcription ? createTranscriptionPreview(speechProfile.transcription) : ''
      )
      setProfileAcknowledged(true)
    } else {
      setTranscriptionPreview('')
      setProfileAcknowledged(speechProfile.updatedAt !== 'static')
    }
  }, [speechProfile])

  const clearCountdownTimer = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  const startMediaRecording = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError('Microphone access is not supported in this browser.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = selectMimeType()
      const recorder =
        mimeType && typeof MediaRecorder !== 'undefined'
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)

      audioChunksRef.current = []
      recordedBlobRef.current = null

      const handleData = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      const handleStop = () => {
        recorder.removeEventListener('dataavailable', handleData)
        recorder.removeEventListener('stop', handleStop)

        try {
          recorder.stream.getTracks().forEach((track) => track.stop())
        } catch (error) {
          console.warn('Unable to stop audio tracks cleanly', error)
        }

        const blob =
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: recorder.mimeType })
            : null

        recordedBlobRef.current = blob
        mediaRecorderRef.current = null
        if (pendingStopResolverRef.current) {
          pendingStopResolverRef.current(blob)
          pendingStopResolverRef.current = null
        }
      }

      recorder.addEventListener('dataavailable', handleData)
      recorder.addEventListener('stop', handleStop)
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecordingError(null)
      return true
    } catch (error) {
      console.error('Microphone access failed', error)
      setRecordingError('Unable to access microphone. Please check permissions and try again.')
      return false
    }
  }, [])

  const stopMediaRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      return Promise.resolve(recordedBlobRef.current)
    }
    if (recorder.state === 'inactive') {
      mediaRecorderRef.current = null
      return Promise.resolve(recordedBlobRef.current)
    }
    return new Promise((resolve) => {
      pendingStopResolverRef.current = resolve
      try {
        recorder.stop()
      } catch (error) {
        console.error('Failed to stop media recorder', error)
        mediaRecorderRef.current = null
        resolve(recordedBlobRef.current)
      }
    })
  }, [])

  const triggerStartHighlight = useCallback(() => {
    setHighlightStartRecording(true)
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightStartRecording(false)
      highlightTimeoutRef.current = null
    }, 1600)
  }, [])

  const processRecordedBlob = useCallback(
    async (blob: Blob | null) => {
      if (!blob) {
        setProcessingError('No audio was captured. Please try recording again.')
        triggerStartHighlight()
        setTrainingStep('intro')
        setProfileAcknowledged(false)
        return
      }

      setProcessingError(null)
      setIsUploading(true)
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const base64Audio = await blobToBase64(blob)

        const response = await fetch('https://stt.tpflow.ngrok.app/api/v1/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_base64: base64Audio,
            sample_rate: 48000,
            include_segments: true,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`STT request failed with status ${response.status}`)
        }

        const data = (await response.json()) as SttResponse
        const profile = buildSpeechProfileFromStt(
          { transcription: data.transcription, timing_profile: data.timing_profile },
          FALLBACK_SPEECH_PROFILE
        )

        if (!profile) {
          throw new Error('Transcription response did not include a timing profile.')
        }

        onSpeechProfileUpdate(profile)
        setTranscriptionPreview(createTranscriptionPreview(profile.transcription ?? data.transcription))
        setCalibrationMeta({
          duration: data.audio_duration_seconds,
          wordCount: data.word_count,
        })
        setProfileAcknowledged(true)
        setTrainingStep('result')
      } catch (error) {
        console.error('Failed to process calibration audio', error)
        setProcessingError('We could not calibrate your speech. Using the default profile for now.')
        onUseFallbackProfile()
        setProfileAcknowledged(true)
        setCalibrationMeta(null)
        triggerStartHighlight()
        setTrainingStep('intro')
      } finally {
        setIsUploading(false)
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    },
    [onSpeechProfileUpdate, onUseFallbackProfile, triggerStartHighlight]
  )

  const handleRecordingComplete = useCallback(async () => {
    clearCountdownTimer()
    setTrainingStep('processing')
    const blob = await stopMediaRecording()
    await processRecordedBlob(blob)
  }, [clearCountdownTimer, processRecordedBlob, stopMediaRecording])

  const handleStartTraining = useCallback(async () => {
    clearCountdownTimer()
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }
    setHighlightStartRecording(false)
    setRecordingError(null)
    setProcessingError(null)
    setCalibrationMeta(null)
    setIsCollapsed(false)
    setTrainingStep('recording')
    setCountdownSeconds(TRAINING_DURATION)

    const started = await startMediaRecording()
    if (!started) {
      setTrainingStep('intro')
      return
    }

    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSeconds((prev) => {
        const next = prev - 1
        if (next <= 0) {
          clearCountdownTimer()
          void handleRecordingComplete()
          return 0
        }
        return next
      })
    }, 1000)
  }, [clearCountdownTimer, handleRecordingComplete, startMediaRecording])

  const handleRetrain = useCallback(() => {
    clearCountdownTimer()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    void stopMediaRecording()
    setTrainingStep('intro')
    setCountdownSeconds(TRAINING_DURATION)
    setIsCollapsed(false)
    setProcessingError(null)
    setRecordingError(null)
    setIsUploading(false)
    setCalibrationMeta(null)
    setProfileAcknowledged(false)
    triggerStartHighlight()
  }, [clearCountdownTimer, stopMediaRecording, triggerStartHighlight])

  const handleCompleteTraining = useCallback(() => {
    setProfileAcknowledged(true)
    setTrainingStep('intro')
    setCountdownSeconds(TRAINING_DURATION)
    setIsCollapsed(false)
    setHighlightStartRecording(false)
    setProcessingError(null)
    clearCountdownTimer()
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }
  }, [clearCountdownTimer])

  const handleSkipCalibration = useCallback(() => {
    onUseFallbackProfile()
    setProfileAcknowledged(true)
    setTranscriptionPreview('')
    setCalibrationMeta(null)
    setProcessingError(null)
    setRecordingError(null)
    setTrainingStep('result')
  }, [onUseFallbackProfile])

  const toggleCollapse = () => setIsCollapsed((prev) => !prev)

  const strokeWidth = Math.max(progressRingSize * 0.05, 10)
  const progressRadius = progressRingSize / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * progressRadius

  const progressFraction =
    trainingStep === 'recording'
      ? (TRAINING_DURATION - countdownSeconds) / TRAINING_DURATION
      : trainingStep === 'processing' || trainingStep === 'result'
        ? 1
        : 0

  const strokeOffset = Math.max(circumference - circumference * progressFraction, 0)

  const startButtonDisabled = !profileAcknowledged
  const startButtonLabel = profileAcknowledged ? 'Start Presenting' : '⚠️ Calibrate or Skip'
  const isPersonalizedProfile = speechProfile.source === 'stt'
  const resultTitle = isPersonalizedProfile ? 'Calibration Complete' : 'Default Profile Ready'
  const resultDescription = isPersonalizedProfile
    ? 'Personalized timings have been generated from your recording.'
    : 'Using the default pacing profile (0.5s per word with standard punctuation pauses).'
  const profileSourceLabel = isPersonalizedProfile ? 'Personalized profile' : 'Default profile'

  const handleStartPresenting = () => {
    if (!profileAcknowledged) {
      setTrainingStep((prev) => (prev === 'result' || prev === 'processing' ? prev : 'intro'))
      setIsCollapsed(false)
      triggerStartHighlight()
      return
    }
    onStartPresenting()
  }

  const handleSignOutClick = () => {
    if (!onSignOut || isSigningOut) {
      return
    }
    void onSignOut()
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f]">
      <header className="flex flex-col gap-4 border-b border-primary/10 bg-card/80 px-6 py-6 shadow-lg backdrop-blur-3xl sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="relative inline-block mx-auto sm:mx-0">
          <div className="flex items-center gap-3 text-foreground">
            <img src="/tpflow-logo.png" alt="TPFlow" className="h-10 w-10 object-contain" />
            <div className="flex flex-col">
              <h1 className="text-3xl font-semibold leading-tight text-white relative z-20">TPFlow</h1>
            </div>
          </div>

          {/* Sparkles effect below entire logo + text container */}
          <div className="w-full h-8 absolute top-full left-0 mt-px">
            {/* Gradients */}
            <div className="absolute left-[10%] top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-4/5 blur-sm" />
            <div className="absolute left-[10%] top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-4/5" />
            <div className="absolute left-1/4 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[3px] w-1/2 blur-sm" />
            <div className="absolute left-1/4 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/2" />

            {/* Core component */}
            <SparklesCore
              background="transparent"
              minSize={0.3}
              maxSize={0.8}
              particleDensity={1000}
              className="w-full h-full"
              particleColor="#FFFFFF"
            />

            {/* Radial Gradient to prevent sharp edges */}
            <div className="absolute inset-0 w-full h-full [mask-image:radial-gradient(120px_40px_at_top,transparent_20%,white)]"></div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {onSwitchToDisplay ? (
            <button
              type="button"
              onClick={onSwitchToDisplay}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 sm:w-auto sm:px-6 sm:py-3 sm:text-base bg-gradient-to-r from-indigo-600/80 to-indigo-500/80 text-white shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              📱 Display Mode
            </button>
          ) : null}
          {profileAcknowledged ? (
            <button
              type="button"
              onClick={handleRetrain}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 sm:w-auto sm:min-w-[220px] sm:px-8 sm:py-3 sm:text-base bg-gradient-to-r from-[#1f2336] to-[#2f3650] text-white shadow-lg shadow-primary/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Recalibrate Speed
            </button>
          ) : null}
          {startButtonDisabled ? (
            <button
              type="button"
              onClick={handleStartPresenting}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 sm:w-auto sm:min-w-[220px] sm:px-8 sm:py-3 sm:text-base bg-white/10 text-white/60 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-disabled={true}
            >
              {startButtonLabel}
            </button>
          ) : (
            <ShinyButton
              onClick={handleStartPresenting}
              className="w-full sm:w-auto sm:min-w-[220px] !px-4 sm:!px-8 !py-3 !text-sm sm:!text-base !rounded-xl"
            >
              {startButtonLabel}
            </ShinyButton>
          )}
          {accountLabel ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Signed in</span>
                <span className="text-sm font-semibold text-white">{accountLabel}</span>
              </div>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={handleSignOutClick}
                  disabled={isSigningOut}
                  className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <section
          className={`flex flex-1 items-center justify-center overflow-hidden px-4 py-6 sm:px-10 sm:py-10 ${
            hasSidebar && isMobile ? 'pb-20' : ''
          }`}
        >
          <div className="flex h-full w-full max-w-4xl">
            <GlowCard
              customSize={true}
              className="h-full w-full"
            >
              <style>{`
                [data-glow] {
                  --radius: 0;
                  --border-spot-opacity: 0.9;
                  --border-light-opacity: 0.6;
                  --bg-spot-opacity: 0.02;
                  --saturation: 100;
                  --lightness: 55;
                }
                .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
                .hide-scrollbar {
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
              `}</style>
              <textarea
                value={content}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Paste or type your script here..."
                spellCheck={false}
                className="hide-scrollbar h-full w-full resize-none rounded-none border border-white/10 bg-transparent px-6 py-6 text-base leading-relaxed text-[#e5e5e5] outline-none transition-all duration-300 sm:px-8 sm:py-8 sm:text-lg"
              />
            </GlowCard>
          </div>
        </section>

        {hasSidebar ? (
          <>
            <aside
              className={`relative hidden h-full w-full max-w-xs flex-col border-l border-primary/20 bg-black/30 backdrop-blur-3xl transition-transform duration-300 ease-out md:flex ${
                isCollapsed ? 'md:translate-x-full' : 'md:translate-x-0'
              }`}
            >
              <div className="flex items-center justify-between px-6 pt-8 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Speed Training</p>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/50 leading-none transition-colors duration-200 hover:border-primary/40 hover:text-primary/80"
                aria-label={isCollapsed ? 'Expand speed training' : 'Collapse speed training'}
              >
                <span className="flex items-center justify-center leading-none">{isCollapsed ? '←' : '→'}</span>
              </button>
            </div>

              <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8">
              {trainingStep === 'intro' ? (
                <div className="flex flex-1 flex-col">
                  <div className="mb-8 text-center text-4xl opacity-60">🎤</div>
                  <h2 className="mb-4 text-2xl font-semibold text-white">Train Your Speaking Speed</h2>
                  <p className="mb-8 text-sm leading-6 text-white/60">
                    Record yourself for 15 seconds to calibrate the teleprompter to your natural pace.
                  </p>
                  <ul className="mb-8 space-y-3 border-t border-b border-white/10 py-6 text-sm text-white/60">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Speak naturally while reading your script
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Takes only 15 seconds to complete
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      Builds a personalized scrolling speed
                    </li>
                  </ul>
                  {recordingError ? (
                    <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {recordingError}
                    </div>
                  ) : null}
                  {processingError ? (
                    <div className="mb-4 rounded-lg border border-yellow-400/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                      {processingError}
                    </div>
                  ) : null}
                  <div className="mt-auto">
                    <button
                      type="button"
                      onClick={handleSkipCalibration}
                      className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white/80 transition-colors duration-200 hover:bg-white/15 hover:text-white"
                    >
                      Skip Calibration
                    </button>
                    <div className="mt-3">
                      <ShinyButton
                        onClick={handleStartTraining}
                        className="w-full !rounded-lg !px-4 !py-3 !text-sm"
                      >
                        Start Recording
                      </ShinyButton>
                    </div>
                  </div>
                </div>
              ) : null}

              {trainingStep === 'recording' ? (
                <div className="flex flex-1 flex-col items-center">
                  <div className="mb-6 text-4xl opacity-60">🎙️</div>
                  <h2 className="mb-3 text-2xl font-semibold text-white">Recording</h2>
                  <p className="mb-8 text-center text-sm leading-6 text-white/60">
                    Speak naturally while the timer counts down.
                  </p>
                  <div className="relative" style={{ width: progressRingSize, height: progressRingSize }}>
                    <svg
                      width={progressRingSize}
                      height={progressRingSize}
                      style={{ transform: 'rotate(-90deg)' }}
                    >
                      <defs>
                        <linearGradient id="speedTrainingRing" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#00d4ff" />
                          <stop offset="100%" stopColor="#7b2ff7" />
                        </linearGradient>
                      </defs>
                      <circle
                        cx={progressRingSize / 2}
                        cy={progressRingSize / 2}
                        r={progressRadius}
                        fill="none"
                        stroke="rgba(124,58,237,0.15)"
                        strokeWidth={strokeWidth}
                      />
                      <circle
                        cx={progressRingSize / 2}
                        cy={progressRingSize / 2}
                        r={progressRadius}
                        fill="none"
                        stroke="url(#speedTrainingRing)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference}`}
                        strokeDashoffset={strokeOffset}
                        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                      />
                    </svg>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-light text-white">{countdownSeconds}</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                        seconds
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {trainingStep === 'processing' ? (
                <div className="flex flex-1 flex-col items-center justify-center">
                  <div className="mb-6 flex h-20 w-full items-center justify-center gap-2">
                    {[30, 50, 70, 45, 60].map((height) => (
                      <span
                        key={height}
                        className="w-1 animate-pulse rounded-full bg-gradient-to-b from-primary/60 to-primary/20"
                        style={{ height }}
                      />
                    ))}
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold text-white">
                    {isUploading ? 'Uploading Recording' : 'Analyzing Recording'}
                  </h2>
                  <p className="text-sm text-white/60">
                    {isUploading ? 'Sending audio securely to the STT service…' : 'Generating your personalized speech profile…'}
                  </p>
                </div>
              ) : null}

              {trainingStep === 'result' ? (
                <div className="flex flex-1 flex-col">
                  <div className="mb-6 text-4xl opacity-70">{isPersonalizedProfile ? '✓' : 'ℹ️'}</div>
                  <h2 className="mb-4 text-2xl font-semibold text-white">{resultTitle}</h2>
                  <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-8 text-left text-white/80">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/70">
                        {profileSourceLabel}
                      </span>
                      <p className="text-lg font-semibold text-white">
                        {isPersonalizedProfile ? 'STT calibrated pacing' : 'Fallback pacing profile'}
                      </p>
                    </div>
                    <p className="text-sm text-white/60">{resultDescription}</p>
                    {transcriptionPreview ? (
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/60">
                          Transcript sample
                        </p>
                        <p className="mt-2 text-sm text-white/80">{transcriptionPreview}</p>
                      </div>
                    ) : null}
                    {calibrationMeta ? (
                      <div className="flex items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-primary/60">
                        <span>{calibrationMeta.wordCount} words</span>
                        <span>•</span>
                        <span>{calibrationMeta.duration.toFixed(1)}s audio</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-col gap-3 pt-10">
                    <button
                      type="button"
                      onClick={handleCompleteTraining}
                      className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors duration-200 hover:bg-white/90"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={handleRetrain}
                      className="w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/20"
                    >
                      Train Again
                    </button>
                  </div>
                </div>
              ) : null}
              </div>
            </aside>

            <div
              className={`fixed bottom-0 left-1/2 z-40 flex w-[calc(100%-1rem)] max-w-lg flex-col rounded-t-3xl border border-b-0 border-white/20 bg-black/75 shadow-[0_-6px_18px_rgba(0,0,0,0.45)] backdrop-blur-3xl transition-transform duration-300 md:hidden ${
                isCollapsed ? 'translate-y-[calc(100%-3.8rem)]' : 'translate-y-0'
              } ${trainingStep === 'intro' ? 'max-h-[55vh]' : 'max-h-[65vh]'} -translate-x-1/2`}
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Speed Training</div>
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors duration-200 hover:border-primary/40 hover:text-primary/80"
                  aria-label={isCollapsed ? 'Expand speed training' : 'Collapse speed training'}
                >
                  {isCollapsed ? '↑' : '↓'}
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
                {/* Sidebar content reused */}
                {trainingStep === 'intro' ? (
                  <div className="flex flex-1 flex-col">
                    <h2 className="mb-3 text-xl font-semibold text-white">
                      <span className="mr-2 inline-block align-middle text-2xl opacity-70">🎤</span>
                      Train Your Speaking Speed
                    </h2>
                    <p className="mb-4 text-sm leading-6 text-white/60">
                      Record yourself for 15 seconds to calibrate the teleprompter to your natural pace.
                    </p>
                    <ul className="mb-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-xs text-white/60">
                      <li className="flex items-start gap-2">
                        <span className="mt-1 text-primary">•</span>
                        Speak naturally while reading your script
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 text-primary">•</span>
                        Takes only 15 seconds to complete
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 text-primary">•</span>
                        Builds a personalized scrolling speed
                      </li>
                    </ul>
                    {recordingError ? (
                      <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {recordingError}
                      </div>
                    ) : null}
                    {processingError ? (
                      <div className="mb-3 rounded-lg border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                        {processingError}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleSkipCalibration}
                      className="mt-auto w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white/80 transition-colors duration-200 hover:bg-white/15 hover:text-white"
                    >
                      Skip Calibration
                    </button>
                    <div className="mt-3">
                      <ShinyButton
                        onClick={handleStartTraining}
                        className="w-full !rounded-lg !px-4 !py-3 !text-sm"
                      >
                        Start Recording
                      </ShinyButton>
                    </div>
                  </div>
                ) : null}
                {trainingStep === 'recording' ? (
                  <div className="flex flex-1 flex-col items-center">
                    <div className="mb-4 text-3xl opacity-60">🎙️</div>
                    <h2 className="mb-2 text-xl font-semibold text-white">Recording</h2>
                    <p className="mb-6 text-center text-sm leading-6 text-white/60">
                      Speak naturally while the timer counts down.
                    </p>
                    <div className="relative mx-auto" style={{ width: progressRingSize, height: progressRingSize }}>
                      <svg width={progressRingSize} height={progressRingSize} style={{ transform: 'rotate(-90deg)' }}>
                        <defs>
                          <linearGradient id="speedTrainingRingMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00d4ff" />
                            <stop offset="100%" stopColor="#7b2ff7" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx={progressRingSize / 2}
                          cy={progressRingSize / 2}
                          r={progressRadius}
                          fill="none"
                          stroke="rgba(124,58,237,0.15)"
                          strokeWidth={strokeWidth}
                        />
                        <circle
                          cx={progressRingSize / 2}
                          cy={progressRingSize / 2}
                          r={progressRadius}
                          fill="none"
                          stroke="url(#speedTrainingRingMobile)"
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                          strokeDasharray={`${circumference}`}
                          strokeDashoffset={strokeOffset}
                          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                        />
                      </svg>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-light text-white">{countdownSeconds}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                          seconds
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
                {trainingStep === 'processing' ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4">
                    <div className="flex h-16 w-full items-center justify-center gap-2">
                      {[30, 45, 60, 45, 30].map((height) => (
                        <span
                          key={height}
                          className="w-1 animate-pulse rounded-full bg-gradient-to-b from-primary/60 to-primary/20"
                          style={{ height }}
                        />
                      ))}
                    </div>
                    <h2 className="text-lg font-semibold text-white">
                      {isUploading ? 'Uploading Recording' : 'Analyzing Recording'}
                    </h2>
                    <p className="text-xs text-white/60">
                      {isUploading ? 'Sending audio securely to the STT service…' : 'Generating your personalized speech profile…'}
                    </p>
                  </div>
                ) : null}
                {trainingStep === 'result' ? (
                  <div className="flex flex-1 flex-col gap-6 pb-6">
                    <div className="text-3xl opacity-70">{isPersonalizedProfile ? '✓' : 'ℹ️'}</div>
                    <h2 className="text-xl font-semibold text-white">{resultTitle}</h2>
                    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 text-left text-white/80">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary/70">
                          {profileSourceLabel}
                        </span>
                        <p className="text-base font-semibold text-white">
                          {isPersonalizedProfile ? 'STT calibrated pacing' : 'Fallback pacing profile'}
                        </p>
                      </div>
                      <p className="text-xs text-white/60">{resultDescription}</p>
                      {transcriptionPreview ? (
                        <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-primary/60">
                            Transcript sample
                          </p>
                          <p className="mt-2 text-xs text-white/80">{transcriptionPreview}</p>
                        </div>
                      ) : null}
                      {calibrationMeta ? (
                        <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em] text-primary/60">
                          <span>{calibrationMeta.wordCount} words</span>
                          <span>•</span>
                          <span>{calibrationMeta.duration.toFixed(1)}s audio</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-auto flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={handleCompleteTraining}
                        className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#0a0a0f] transition-colors duration-200 hover:bg-white/90"
                      >
                        Continue
                      </button>
                      <button
                        type="button"
                        onClick={handleRetrain}
                        className="w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/20"
                      >
                        Train Again
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {hasSidebar && !isMobile && isCollapsed ? (
        <button
          type="button"
          onClick={toggleCollapse}
          className="hidden md:flex fixed top-1/2 right-6 z-40 -translate-y-1/2 flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-3 text-sm text-white/70 shadow-lg backdrop-blur-2xl transition-transform duration-200 hover:translate-x-1 hover:text-primary"
          aria-label="Expand speed training panel"
        >
          <span className="text-base">←</span>
          <span className="text-[10px] uppercase tracking-[0.25em]">Speed</span>
        </button>
      ) : null}

    </div>
  )
}
