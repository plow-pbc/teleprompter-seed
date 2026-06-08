export interface Script {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface ScrollerConfig {
  playbackRate: number // scalar multiplier for the active speech profile
  isPlaying: boolean
  position: number // current word index (not pixels)
}

export interface DisplaySettings {
  fontSizeVh: number // viewport min (vmin) percentage (2.0-15.0) - consistent across orientations
  lineHeight: number // multiplier (1.0-2.5)
  fontFamily: 'sans-serif' | 'serif' | 'monospace'
  textColor: string // hex color
  backgroundColor: string // hex color
  isMirrored: boolean
  isFullscreen: boolean
}

export interface TeleprompterState {
  currentScript: Script | null
  scripts: Script[]
  scroller: ScrollerConfig
  display: DisplaySettings
  countdownSeconds?: number
}
