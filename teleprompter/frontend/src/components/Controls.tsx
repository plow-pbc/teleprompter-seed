import { useEffect, useState } from 'react'

import type { ScrollerConfig } from '../types'

interface ControlsProps {
  config: ScrollerConfig
  fontSizeVh: number
  countdownSeconds: number
  isCountdownActive: boolean
  hasPendingStart: boolean
  onTogglePlay: () => void
  onPlaybackRateChange: (rate: number) => void
  onFontSizeChange: (fontSizeVh: number) => void
  onReset: () => void
  onCountdownChange: (seconds: number) => void
}

export function Controls({
  config,
  fontSizeVh,
  countdownSeconds,
  isCountdownActive,
  hasPendingStart,
  onTogglePlay,
  onPlaybackRateChange,
  onFontSizeChange,
  onReset,
  onCountdownChange,
}: ControlsProps) {
  const clampedPlaybackRate = Math.min(Math.max(config.playbackRate, 0.25), 4)
  const sliderValue = Number.isFinite(clampedPlaybackRate)
    ? Math.log(clampedPlaybackRate) / Math.log(4)
    : 0
  const MIN_FONT_SIZE = 2
  const MAX_FONT_SIZE = 15
  const DEFAULT_FONT_SIZE = 4.5

  const fontSizeToNormalized = (size: number): number => {
    const clamped = Math.min(Math.max(size, MIN_FONT_SIZE), MAX_FONT_SIZE)
    if (clamped === DEFAULT_FONT_SIZE) {
      return 0
    }
    if (clamped < DEFAULT_FONT_SIZE) {
      const span = DEFAULT_FONT_SIZE - MIN_FONT_SIZE
      return span > 0 ? -(DEFAULT_FONT_SIZE - clamped) / span : 0
    }
    const span = MAX_FONT_SIZE - DEFAULT_FONT_SIZE
    return span > 0 ? (clamped - DEFAULT_FONT_SIZE) / span : 0
  }

  const normalizedToFontSize = (norm: number): number => {
    const normalized = Math.min(Math.max(norm, -1), 1)
    if (normalized >= 0) {
      return DEFAULT_FONT_SIZE + normalized * (MAX_FONT_SIZE - DEFAULT_FONT_SIZE)
    }
    return DEFAULT_FONT_SIZE + normalized * (DEFAULT_FONT_SIZE - MIN_FONT_SIZE)
  }

  const currentFontSizeNormalized = fontSizeToNormalized(fontSizeVh)

  const playLabel = config.isPlaying
    ? '⏸ Pause'
    : hasPendingStart || isCountdownActive
    ? '⏳ Waiting'
    : '▶ Play'

  const playDisabled = hasPendingStart && !config.isPlaying
  const countdownOptions = [1, 3, 5]
  const [isHovered, setIsHovered] = useState(false)
  const [isClickHiding, setIsClickHiding] = useState(false)

  const shouldAutoHide = config.isPlaying || isCountdownActive || hasPendingStart
  const isVisible = !shouldAutoHide || (isHovered && !isClickHiding)

  useEffect(() => {
    if (!shouldAutoHide) {
      setIsHovered(false)
      setIsClickHiding(false)
      return
    }

    if (isClickHiding) {
      const timeoutId = window.setTimeout(() => {
        setIsClickHiding(false)
      }, 350)

      return () => window.clearTimeout(timeoutId)
    }
  }, [isClickHiding, shouldAutoHide])

  const handleEnter = () => {
    if (!isClickHiding) {
      setIsHovered(true)
    }
  }

  const handleLeave = () => setIsHovered(false)

  const handleTogglePlay = () => {
    setIsClickHiding(true)
    setIsHovered(false)
    onTogglePlay()
  }

  return (
    <div className="fixed left-1/2 bottom-0 z-50 w-full max-w-6xl -translate-x-1/2 px-5 sm:px-0">
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocusCapture={handleEnter}
        onBlurCapture={handleLeave}
        className="pointer-events-none"
      >
        <div
          className={`pointer-events-auto flex flex-col gap-4 rounded-[1.5rem] border border-primary/20 bg-card/90 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-2xl transition-all duration-300 sm:flex-row sm:items-center sm:gap-8 sm:rounded-[2.25rem] sm:px-6 sm:py-5 ${
            isVisible ? '-translate-y-1 opacity-100' : 'translate-y-[calc(100%-2.5rem)] opacity-90'
          }`}
        >
          <div className="flex flex-col gap-3 sm:w-48 sm:flex-shrink-0">
            <button
              onClick={handleTogglePlay}
              disabled={playDisabled}
              className={`inline-flex items-center justify-center rounded-2xl px-6 py-4 text-lg font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                config.isPlaying
                ? 'bg-gradient-to-r from-[#7b2ff7] to-[#00d4ff] text-white shadow-lg shadow-primary/50 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/60 disabled:opacity-60'
                : isCountdownActive
                ? 'bg-gradient-to-r from-[#ef4444] to-[#f97316] text-white shadow-lg shadow-orange-500/40 hover:-translate-y-0.5'
                : hasPendingStart
                ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'bg-gradient-to-r from-[#00d4ff] to-[#7b2ff7] text-white shadow-lg shadow-primary/50 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/60'
            }`}
          >
            {playLabel}
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-2xl border border-primary/20 bg-muted/20 px-6 py-4 text-base font-semibold text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              ↻ Reset
            </button>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                  SPEED <span className="text-foreground">/ {clampedPlaybackRate.toFixed(2)}x</span>
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Speed Control</span>
              </div>
              <div className="flex items-center gap-5">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={sliderValue}
                  onChange={(e) => {
                    const normalized = Number(e.target.value)
                    const multiplier = Math.pow(4, normalized)
                    onPlaybackRateChange(multiplier)
                  }}
                  className="h-2 flex-1 appearance-none rounded-full border border-primary/30 bg-primary/15 accent-[#7b2ff7]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                <span>0.25x</span>
                <span>1x</span>
                <span>4x</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                  FONT SIZE <span className="text-foreground">/ {fontSizeVh.toFixed(1)}vmin</span>
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Text Size</span>
              </div>
              <div className="flex items-center gap-5">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={currentFontSizeNormalized}
                  onChange={(e) => {
                    const normalized = Number(e.target.value)
                    const nextSize = normalizedToFontSize(normalized)
                    // Snap to the closest 0.1 to keep values tidy
                    const rounded = Math.round(nextSize * 10) / 10
                    onFontSizeChange(Number(rounded.toFixed(1)))
                  }}
                  className="h-2 flex-1 appearance-none rounded-full border border-primary/30 bg-primary/15 accent-[#7b2ff7]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                <span>{MIN_FONT_SIZE.toFixed(1)}v</span>
                <span>{DEFAULT_FONT_SIZE.toFixed(1)}v</span>
                <span>{MAX_FONT_SIZE.toFixed(1)}v</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 sm:w-[240px] sm:flex-shrink-0">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Countdown</div>
            <div className="flex gap-2">
              {countdownOptions.map((value) => {
                const active = countdownSeconds === value
                return (
                  <button
                    key={value}
                    onClick={() => onCountdownChange(value)}
                    className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                      active
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#7b2ff7] text-white shadow-lg shadow-primary/50'
                        : 'border border-primary/30 bg-primary/10 text-primary hover:-translate-y-0.5 hover:bg-primary/20'
                    }`}
                  >
                    {value}s
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {shouldAutoHide ? (
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={`pointer-events-auto mx-auto mb-0.5 h-1.5 w-28 rounded-full bg-primary/50 transition-opacity duration-300 ${
            isVisible ? 'opacity-0' : 'opacity-100'
          }`}
        />
      ) : null}
    </div>
  )
}
