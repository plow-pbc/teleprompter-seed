import { useEffect } from 'react'

interface KeyboardShortcuts {
  onTogglePlay?: () => void
  onSpeedUp?: () => void
  onSpeedDown?: () => void
  onReset?: () => void
  onToggleFullscreen?: () => void
  onToggleMirror?: () => void
}

export function useKeyboard(shortcuts: KeyboardShortcuts, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (event.key) {
        case ' ':
          event.preventDefault()
          shortcuts.onTogglePlay?.()
          break
        case 'ArrowUp':
          event.preventDefault()
          shortcuts.onSpeedUp?.()
          break
        case 'ArrowDown':
          event.preventDefault()
          shortcuts.onSpeedDown?.()
          break
        case 'Home':
          event.preventDefault()
          shortcuts.onReset?.()
          break
        case 'f':
        case 'F':
          shortcuts.onToggleFullscreen?.()
          break
        case 'm':
        case 'M':
          shortcuts.onToggleMirror?.()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}
