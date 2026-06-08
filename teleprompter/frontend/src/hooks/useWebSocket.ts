import { useEffect, useRef, useCallback, useState } from 'react'
import { epochNow } from '../utils/time'
import type { SpeechProfile } from '../utils/speechProfile'

interface TeleprompterState {
  content: string
  isPlaying: boolean
  isPresenting: boolean
  playbackRate?: number
  position: number
  fontSizeVh: number
  backgroundColor: string
  textColor: string
  countdownSeconds: number
  speechProfile?: SpeechProfile | null
  wpm?: number
}

interface NtpResponsePayload {
  t0: number
  t1: number
  t2: number
}

interface PlaySchedulePayload {
  serverTimeToExecute: number
  position: number
  playbackRate?: number
  wpm?: number
}

type InboundMessage =
  | { type: 'state:sync'; data: TeleprompterState }
  | { type: 'ntp:response'; data: NtpResponsePayload }
  | { type: 'play:schedule'; data: PlaySchedulePayload }
  | { type: string; data?: unknown }

interface WebSocketHandlers {
  onNtpResponse?: (payload: NtpResponsePayload) => void
  onPlaySchedule?: (payload: PlaySchedulePayload) => void
}

export function useWebSocket(
  onStateSync: (state: TeleprompterState) => void,
  enabled: boolean = true,
  handlers: WebSocketHandlers = {}
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const onStateSyncRef = useRef(onStateSync)
  const handlersRef = useRef<WebSocketHandlers>(handlers)
  const [reconnectTrigger, setReconnectTrigger] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  // Update refs when callbacks change
  useEffect(() => {
    onStateSyncRef.current = onStateSync
  }, [onStateSync])

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) {
      console.log('⏸️ WebSocket disabled')
      return
    }

    // Dynamically build WebSocket URL based on current hostname.
    // This ensures it works whether accessing via localhost or LAN IP (phone display).
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const backendPort = 9000 // Backend always runs on port 9000
    const backendWsUrl = `${wsProtocol}//${window.location.hostname}:${backendPort}`
    console.log('🔍 Using dynamic WebSocket URL:', backendWsUrl)

    const wsUrl = `${backendWsUrl}/ws`
    console.log('🔗 Connecting to WebSocket (local mode, no auth)')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // If still CONNECTING after 3s, kill it and reconnect immediately
    const connectTimeout = window.setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn('⏰ WebSocket connection timeout - reconnecting')
        ws.close()
        setReconnectTrigger((prev) => prev + 1)
      }
    }, 1000)

    ws.onopen = () => {
      clearTimeout(connectTimeout)
      console.log('✅ Connected to WebSocket server')
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      const raw: InboundMessage = JSON.parse(event.data)
      console.log('📨 Received WebSocket message:', JSON.stringify(raw, null, 2))

      switch (raw.type) {
        case 'state:sync': {
          if (raw.data) {
            console.log('🔄 Syncing state:', JSON.stringify(raw.data, null, 2))
            onStateSyncRef.current(raw.data as TeleprompterState)
          }
          break
        }
        case 'ntp:response': {
          const payload = raw.data as NtpResponsePayload
          handlersRef.current.onNtpResponse?.(payload)
          break
        }
        case 'play:schedule': {
          const payload = raw.data as PlaySchedulePayload
          handlersRef.current.onPlaySchedule?.(payload)
          break
        }
        default:
          console.warn('⚠️ Unknown message type received:', raw.type)
      }
    }

    ws.onerror = (error) => {
      clearTimeout(connectTimeout)
      console.error('❌ WebSocket error:', error)
    }

    ws.onclose = (event) => {
      clearTimeout(connectTimeout)
      console.log('🔌 Disconnected from WebSocket server', event.code, event.reason)
      setIsConnected(false)
      wsRef.current = null
      if (event.code !== 1000 && enabled) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('🔄 Attempting to reconnect...')
          setReconnectTrigger((prev) => prev + 1)
        }, 2000)
      }
    }

    return () => {
      clearTimeout(connectTimeout)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000)
        wsRef.current = null
      }
      setIsConnected(false)
    }
  }, [enabled, reconnectTrigger])

  const sendStateUpdate = useCallback((state: Partial<TeleprompterState>) => {
    console.log('🚀 sendStateUpdate called with:', state)
    console.log('📡 WebSocket ref exists:', !!wsRef.current)
    console.log('📡 WebSocket state:', wsRef.current?.readyState)

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const snakeCaseData: Record<string, unknown> = {}
      if (state.content !== undefined) snakeCaseData.content = state.content
      if (state.isPlaying !== undefined) snakeCaseData.is_playing = state.isPlaying
      if (state.isPresenting !== undefined) snakeCaseData.is_presenting = state.isPresenting
      if (state.playbackRate !== undefined) snakeCaseData.playback_rate = state.playbackRate
      if (state.speechProfile !== undefined) snakeCaseData.speech_profile = state.speechProfile
      if (state.wpm !== undefined) snakeCaseData.wpm = state.wpm
      if (state.position !== undefined) snakeCaseData.position = state.position
      if (state.fontSizeVh !== undefined) snakeCaseData.font_size_vh = state.fontSizeVh
      if (state.backgroundColor !== undefined) snakeCaseData.background_color = state.backgroundColor
      if (state.textColor !== undefined) snakeCaseData.text_color = state.textColor
      if (state.countdownSeconds !== undefined) snakeCaseData.countdown_seconds = state.countdownSeconds

      const message = {
        type: 'state:update',
        data: snakeCaseData,
      }
      console.log('📤 Sending WebSocket message:', message)
      wsRef.current.send(JSON.stringify(message))
      console.log('✅ Message sent successfully')
    } else {
      console.error('❌ WebSocket not ready to send. State:', wsRef.current?.readyState)
    }
  }, [])

  const sendPlayEvent = useCallback(
    (event: 'play:start' | 'play:pause' | 'play:reset', data: Record<string, unknown> = {}) => {
      console.log('🚀 sendPlayEvent called with:', event, data)

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const snakeCaseData: Record<string, unknown> = {}
        if (data.position !== undefined) snakeCaseData.position = data.position
        if (data.playbackRate !== undefined) snakeCaseData.playback_rate = data.playbackRate
        if (data.wpm !== undefined) snakeCaseData.wpm = data.wpm
        if (data.desiredStartMs !== undefined) snakeCaseData.desired_start_ms = data.desiredStartMs

        const message = {
          type: event,
          data: snakeCaseData,
        }
        console.log('📤 Sending WebSocket play event:', message)
        wsRef.current.send(JSON.stringify(message))
        console.log('✅ Play event sent successfully')
      } else {
        console.error('❌ WebSocket not ready to send play event. State:', wsRef.current?.readyState)
      }
    },
    []
  )

  const sendNtpRequest = useCallback((clientRtt?: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload: Record<string, number> = { t0: epochNow() }
      if (clientRtt !== undefined) {
        payload.clientRtt = clientRtt
      }

      const message = {
        type: 'ntp:request',
        data: payload,
      }
      console.log('📤 Sending NTP request:', message)
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.error('❌ WebSocket not ready to send NTP request. State:', wsRef.current?.readyState)
    }
  }, [])

  return { sendStateUpdate, sendPlayEvent, sendNtpRequest, isConnected }
}

export type { TeleprompterState, NtpResponsePayload, PlaySchedulePayload }
