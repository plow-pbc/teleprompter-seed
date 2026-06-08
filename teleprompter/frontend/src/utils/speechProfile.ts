import type { ParsedWord } from './textParser'

export type PunctuationClass = 'comma' | 'sentence'

export interface TimingProfilePayload {
  per_length_durations?: Record<string, number | string>
  punctuation_pauses?: Record<string, number | string>
}

export interface SpeechProfile {
  perLengthDurations: Record<string, number>
  punctuationPauses: Record<string, number>
  source: 'stt' | 'fallback'
  updatedAt: string
  transcription?: string
}

export interface NormalizedTimingProfile {
  perLength: Record<string, number>
  punctuation: Record<string, number>
}

export const SPEECH_PROFILE_STORAGE_KEY = 'teleprompter-speech-profile'

const MIN_WORD_LENGTH = 1
const MAX_WORD_LENGTH = 30
const MIN_DURATION_SECONDS = 0.05
const MAX_DURATION_SECONDS = 8

const FALLBACK_PER_LENGTH: Record<string, number> = Object.fromEntries(
  Array.from({ length: MAX_WORD_LENGTH }, (_, idx) => {
    const len = idx + 1
    return [String(len), Math.round((0.25 + 0.15 * Math.log(len)) * 1000) / 1000]
  })
)

const FALLBACK_PUNCTUATION: Record<PunctuationClass, number> = {
  comma: 0.2,
  sentence: 0.4,
}

export const FALLBACK_SPEECH_PROFILE: SpeechProfile = {
  perLengthDurations: FALLBACK_PER_LENGTH,
  punctuationPauses: FALLBACK_PUNCTUATION,
  source: 'fallback',
  updatedAt: 'static',
}

const clampDuration = (value: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return MIN_DURATION_SECONDS
  }
  return Math.min(Math.max(value, MIN_DURATION_SECONDS), MAX_DURATION_SECONDS)
}

export const normalizeTimingProfile = (
  payload: TimingProfilePayload | null | undefined,
  fallback: SpeechProfile = FALLBACK_SPEECH_PROFILE
): NormalizedTimingProfile | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const normalizedPerLength: Record<string, number> = { ...fallback.perLengthDurations }
  const rawPerLength = payload.per_length_durations ?? {}
  for (let length = MIN_WORD_LENGTH; length <= MAX_WORD_LENGTH; length += 1) {
    const key = String(length)
    const candidate = rawPerLength[key]
    if (candidate === undefined || candidate === null) {
      continue
    }
    const numeric = typeof candidate === 'string' ? Number.parseFloat(candidate) : Number(candidate)
    if (!Number.isNaN(numeric)) {
      normalizedPerLength[key] = clampDuration(numeric)
    }
  }

  const normalizedPunctuation: Record<string, number> = { ...fallback.punctuationPauses }
  const rawPunctuation = payload.punctuation_pauses ?? {}
  for (const [key, value] of Object.entries(rawPunctuation)) {
    const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
    if (Number.isNaN(numeric)) {
      continue
    }
    normalizedPunctuation[key] = clampDuration(numeric)
  }

  return {
    perLength: normalizedPerLength,
    punctuation: normalizedPunctuation,
  }
}

export const saveSpeechProfile = (profile: SpeechProfile): void => {
  try {
    window.localStorage.setItem(SPEECH_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch (error) {
    console.warn('Failed to persist speech profile', error)
  }
}

export const clearSpeechProfile = (): void => {
  try {
    window.localStorage.removeItem(SPEECH_PROFILE_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear speech profile storage', error)
  }
}

export const loadSpeechProfile = (): SpeechProfile => {
  if (typeof window === 'undefined') {
    return FALLBACK_SPEECH_PROFILE
  }

  try {
    const raw = window.localStorage.getItem(SPEECH_PROFILE_STORAGE_KEY)
    if (!raw) {
      return FALLBACK_SPEECH_PROFILE
    }
    const parsed = JSON.parse(raw) as Partial<SpeechProfile> | null
    if (!parsed) {
      return FALLBACK_SPEECH_PROFILE
    }

    const perLengthDurations = parsed.perLengthDurations ?? FALLBACK_SPEECH_PROFILE.perLengthDurations
    const punctuationPauses = parsed.punctuationPauses ?? FALLBACK_SPEECH_PROFILE.punctuationPauses

    const normalized: SpeechProfile = {
      perLengthDurations: Object.fromEntries(
        Object.entries(perLengthDurations).map(([k, v]) => [k, clampDuration(Number(v))])
      ),
      punctuationPauses: Object.fromEntries(
        Object.entries(punctuationPauses).map(([k, v]) => [k, clampDuration(Number(v))])
      ),
      source: parsed.source === 'stt' ? 'stt' : 'fallback',
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      transcription: parsed.transcription,
    }

    return normalized
  } catch (error) {
    console.warn('Failed to load speech profile from storage, falling back to defaults', error)
    return FALLBACK_SPEECH_PROFILE
  }
}

export const buildSpeechProfileFromStt = (
  response: {
    transcription: string
    timing_profile: TimingProfilePayload | null | undefined
  },
  fallback: SpeechProfile = FALLBACK_SPEECH_PROFILE
): SpeechProfile | null => {
  const normalized = normalizeTimingProfile(response.timing_profile, fallback)
  if (!normalized) {
    return null
  }
  return {
    perLengthDurations: normalized.perLength,
    punctuationPauses: normalized.punctuation as Record<PunctuationClass, number>,
    source: 'stt',
    updatedAt: new Date().toISOString(),
    transcription: response.transcription,
  }
}

export const ensureWordLengthKey = (length: number): string => {
  const safeLength = Math.min(Math.max(Math.floor(length), MIN_WORD_LENGTH), MAX_WORD_LENGTH)
  return String(safeLength)
}

const punctuationClassForWord = (word: ParsedWord): PunctuationClass | null => {
  if (word.isWhitespace) {
    return null
  }
  const trimmed = word.text.trim()
  if (!trimmed) {
    return null
  }

  const lastChar = trimmed.at(-1)
  if (!lastChar) {
    return null
  }

  // Treat hyphen at end (or standalone "-") same as comma
  // Examples: "word-", "assistente -" becomes "assistente" + " " + "-"
  if (',;-'.includes(lastChar)) {
    return 'comma'
  }
  if ('.?!:'.includes(lastChar)) {
    return 'sentence'
  }
  return null
}

const cleanLength = (word: ParsedWord): number => {
  if (word.isWhitespace) {
    return 0
  }
  const stripped = word.text.replace(/[^0-9A-Za-z\u00C0-\u017F]+/g, '')
  return stripped.length > 0 ? stripped.length : word.text.length
}

export const getWordDuration = (
  word: ParsedWord,
  profile: SpeechProfile,
  playbackRate: number = 1
): number => {
  if (word.isWhitespace) {
    return 0
  }
  const lengthKey = ensureWordLengthKey(cleanLength(word))
  // Use calibrated profile - if missing, use max length
  const base = profile.perLengthDurations[lengthKey]
    ?? profile.perLengthDurations[String(MAX_WORD_LENGTH)]

  if (base === undefined) {
    throw new Error(`No duration found for word length ${lengthKey} and no max length in profile`)
  }

  const punctuationClass = punctuationClassForWord(word)
  let pause = punctuationClass ? (profile.punctuationPauses[punctuationClass] ?? 0) : 0

  // If word ends with "...", use 1.5x the sentence pause
  if (word.text.trim().endsWith('...') && punctuationClass === 'sentence') {
    pause = pause * 1.5
  }

  // Debug logging for punctuation
  if (punctuationClass) {
    console.log(`Word: "${word.text}" | PuncClass: ${punctuationClass} | Pause: ${pause}s | Base: ${base}s | Profile pauses:`, profile.punctuationPauses, `| Source: ${profile.source}`)
  }

  const effective = (base + pause) / (playbackRate > 0 ? playbackRate : 1)
  return clampDuration(effective)
}

export const computeWordDurations = (
  words: ParsedWord[],
  profile: SpeechProfile,
  playbackRate: number = 1
): number[] => {
  const durations: number[] = []
  for (const word of words) {
    if (word.isWhitespace) {
      continue
    }
    durations.push(getWordDuration(word, profile, playbackRate))
  }
  return durations
}

export const estimateWordsPerMinute = (profile: SpeechProfile, playbackRate: number = 1): number => {
  const sampleLengths = [3, 4, 5, 6, 7]
  const averageDuration = sampleLengths
    .map((length) => profile.perLengthDurations[String(length)] ?? FALLBACK_SPEECH_PROFILE.perLengthDurations[String(length)])
    .reduce((acc, duration) => acc + duration, 0) / sampleLengths.length
  const effectiveDuration = averageDuration / (playbackRate > 0 ? playbackRate : 1)
  return Math.round(60 / Math.max(effectiveDuration, MIN_DURATION_SECONDS))
}
