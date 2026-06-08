import { useMemo } from 'react'
import type { DisplaySettings, ScrollerConfig } from '../types'
import { useScroller } from '../hooks/useScroller'
import { parseTextIntoWords } from '../utils/textParser'
import type { SpeechProfile } from '../utils/speechProfile'
interface DisplayProps {
  content: string
  settings: DisplaySettings
  scrollerConfig: ScrollerConfig
  onPositionChange: (position: number) => void
  enableAutoScroll?: boolean // Only controller should auto-scroll
  speechProfile: SpeechProfile
}

export function Display({
  content,
  settings,
  scrollerConfig,
  onPositionChange,
  enableAutoScroll,
  speechProfile,
}: DisplayProps) {
  const words = useMemo(() => parseTextIntoWords(content), [content])

  const { containerRef } = useScroller({
    config: scrollerConfig,
    speechProfile,
    words,
    onPositionChange,
    enableAutoScroll,
  })

  // Calculate device multiplier based on pixel density to ensure same physical size
  const deviceMultiplier = useMemo(() => {
    const ratio = window.devicePixelRatio
    if (ratio > 2.5) return 3.0  // High-end phones
    if (ratio > 1.5) return 2.0  // Tablets/laptops
    return 1.0                    // Desktop monitors
  }, [])

  // Calculate font size from viewport min (vmin) percentage
  // vmin = smaller of viewport width or height, for consistent sizing across orientations
  const viewportMin = Math.min(window.innerWidth, window.innerHeight)
  const calculatedFontSize = (settings.fontSizeVh / 100) * viewportMin * deviceMultiplier

  // Calculate padding to allow first and last lines to be centered
  // Need 50vh (half viewport) of padding top and bottom for true centering
  const verticalPadding = `${window.innerHeight / 2}px`

  const containerStyle: React.CSSProperties = {
    fontSize: `${calculatedFontSize}px`,
    lineHeight: settings.lineHeight,
    fontFamily: settings.fontFamily,
    color: settings.textColor,
    backgroundColor: 'transparent', // Let the stars background show through
    transform: settings.isMirrored ? 'scaleX(-1)' : 'none',
    paddingTop: verticalPadding,
    paddingBottom: verticalPadding,
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className={`custom-scrollbar h-full overflow-y-auto scroll-smooth px-6 text-center transition-colors duration-500 sm:px-12${
          scrollerConfig.isPlaying ? ' scrollbar-hide' : ''
        }`}
        style={containerStyle}
      >
        <div className="mx-auto max-w-5xl">
          <div
            className="whitespace-pre-wrap font-light tracking-wide"
            style={{ textShadow: '0 4px 20px rgba(0, 0, 0, 0.55)' }}
          >
            {content ? (
              words.map((word, idx) => {
                if (word.isWhitespace) {
                  return <span key={idx}>{word.text}</span>
                }
                return (
                  <span key={idx} data-word-index={word.index} className="teleprompter-word">
                    {word.text}
                  </span>
                )
              })
            ) : (
              'Paste or type your script here...'
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
