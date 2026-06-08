import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { ScrollerConfig } from '../types'
import type { SpeechProfile } from '../utils/speechProfile'
import { computeWordDurations } from '../utils/speechProfile'
import type { ParsedWord } from '../utils/textParser'

interface UseScrollerProps {
  config: ScrollerConfig
  words: ParsedWord[]
  speechProfile: SpeechProfile
  onPositionChange: (position: number) => void
  enableAutoScroll?: boolean // Toggle auto-scroll behaviour if we ever need to disable it
}

export function useScroller({
  config,
  words,
  speechProfile,
  onPositionChange,
  enableAutoScroll = true,
}: UseScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number | null>(null)
  const currentWordIndexRef = useRef<number>(config.position)
  const previousWordRef = useRef<HTMLSpanElement | null>(null)
  const isPlayingRef = useRef<boolean>(config.isPlaying)
  const timeIntoWordRef = useRef<number>(0)
  const durationsRef = useRef<number[]>([])
  const latestPositionRef = useRef<number>(config.position)

  const wordDurations = useMemo(
    () => computeWordDurations(words, speechProfile, config.playbackRate),
    [words, speechProfile, config.playbackRate]
  )

  useEffect(() => {
    durationsRef.current = wordDurations
    if (config.position >= wordDurations.length) {
      currentWordIndexRef.current = Math.max(0, wordDurations.length - 1)
      onPositionChange(currentWordIndexRef.current)
    }
  }, [config.position, onPositionChange, wordDurations])

  useEffect(() => {
    isPlayingRef.current = config.isPlaying
  }, [config.isPlaying])

  useEffect(() => {
    latestPositionRef.current = config.position
  }, [config.position])

  const highlightWord = useCallback((index: number, smooth: boolean = true) => {
    if (!containerRef.current) return
    const targetWord = containerRef.current.querySelector<HTMLSpanElement>(
      `[data-word-index="${index}"]`
    )
    if (!targetWord) {
      return
    }

    if (previousWordRef.current && previousWordRef.current !== targetWord) {
      previousWordRef.current.classList.remove('word-active')
    }

    targetWord.classList.add('word-active')
    previousWordRef.current = targetWord
    targetWord.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })
  }, [])

  const step = useCallback(
    (timestamp: number) => {
      if (!containerRef.current) {
        animationFrameRef.current = null
        return
      }

      if (!isPlayingRef.current) {
        animationFrameRef.current = null
        lastTimestampRef.current = null
        return
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp
        animationFrameRef.current = requestAnimationFrame(step)
        return
      }

      const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000
      lastTimestampRef.current = timestamp

      let timeIntoWord = timeIntoWordRef.current + deltaSeconds
      let nextIndex = currentWordIndexRef.current
      const durations = durationsRef.current

      while (isPlayingRef.current && nextIndex < durations.length) {
        const currentDuration = durations[nextIndex] ?? 0.5
        if (timeIntoWord < currentDuration) {
          break
        }
        timeIntoWord -= currentDuration
        nextIndex += 1
        if (nextIndex < durations.length) {
          currentWordIndexRef.current = nextIndex
          highlightWord(nextIndex)
          onPositionChange(nextIndex)
        } else {
          currentWordIndexRef.current = durations.length - 1
          onPositionChange(currentWordIndexRef.current)
          isPlayingRef.current = false
          break
        }
      }

      timeIntoWordRef.current = timeIntoWord

      if (isPlayingRef.current && nextIndex < durations.length) {
        animationFrameRef.current = requestAnimationFrame(step)
      } else {
        animationFrameRef.current = null
        lastTimestampRef.current = null
      }
    },
    [highlightWord, onPositionChange]
  )

  useEffect(() => {
    if (!enableAutoScroll) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastTimestampRef.current = null
      timeIntoWordRef.current = 0
      return
    }

    if (config.isPlaying) {
      currentWordIndexRef.current = latestPositionRef.current
      highlightWord(latestPositionRef.current)
      timeIntoWordRef.current = 0
      lastTimestampRef.current = null

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(step)
      }
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastTimestampRef.current = null
      timeIntoWordRef.current = 0
      currentWordIndexRef.current = latestPositionRef.current
      highlightWord(latestPositionRef.current, false)
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [config.isPlaying, enableAutoScroll, highlightWord, step])

  useEffect(() => {
    if (!enableAutoScroll) {
      currentWordIndexRef.current = config.position
      highlightWord(config.position, false)
      timeIntoWordRef.current = 0
      lastTimestampRef.current = null
      return
    }

    if (config.isPlaying) {
      if (config.position !== currentWordIndexRef.current) {
        currentWordIndexRef.current = config.position
        highlightWord(config.position)
        timeIntoWordRef.current = 0
        lastTimestampRef.current = null
      }
      return
    }

    currentWordIndexRef.current = config.position
    highlightWord(config.position, false)
    timeIntoWordRef.current = 0
    lastTimestampRef.current = null
  }, [config.position, config.isPlaying, enableAutoScroll, highlightWord])

  const resetScroll = useCallback(() => {
    if (!containerRef.current) return

    if (previousWordRef.current) {
      previousWordRef.current.classList.remove('word-active')
      previousWordRef.current = null
    }

    containerRef.current.scrollTop = 0
    currentWordIndexRef.current = 0
    timeIntoWordRef.current = 0
    lastTimestampRef.current = null
    onPositionChange(0)
  }, [onPositionChange])

  return {
    containerRef,
    resetScroll,
  }
}
