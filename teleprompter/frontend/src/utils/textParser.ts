/**
 * Parse text into individual words while preserving whitespace and structure.
 * Returns an array of word objects with their text and index.
 */

export interface ParsedWord {
  text: string
  index: number
  isWhitespace: boolean
}

/**
 * Split text into words for teleprompter scrolling.
 * Preserves punctuation with words (don't split on apostrophes, hyphens).
 * Handles whitespace properly (newlines, multiple spaces).
 */
export function parseTextIntoWords(text: string): ParsedWord[] {
  if (!text.trim()) {
    return []
  }

  const words: ParsedWord[] = []
  let wordIndex = 0

  // Split on whitespace but preserve the whitespace itself
  // This regex matches: (word characters + punctuation) OR (whitespace)
  const tokens = text.split(/(\s+)/)

  for (const token of tokens) {
    if (!token) continue // Skip empty strings from split

    const isWhitespace = /^\s+$/.test(token)

    if (isWhitespace) {
      // Preserve whitespace as separate tokens (for proper rendering)
      // But don't give it an index - it's not a "word" for timing calculations
      words.push({
        text: token,
        index: -1, // No index for whitespace
        isWhitespace: true,
      })
    } else {
      // This is a word (may include punctuation)
      words.push({
        text: token,
        index: wordIndex,
        isWhitespace: false,
      })
      wordIndex++ // Only increment for actual words
    }
  }

  return words
}

/**
 * Count the total number of actual words (excluding whitespace) in text.
 */
export function countWords(text: string): number {
  const parsed = parseTextIntoWords(text)
  return parsed.filter((w) => !w.isWhitespace).length
}

/**
 * Get the word at a specific index (ignoring whitespace in counting).
 */
export function getWordAtIndex(
  words: ParsedWord[],
  targetIndex: number
): ParsedWord | null {
  const nonWhitespaceWords = words.filter((w) => !w.isWhitespace)
  if (targetIndex < 0 || targetIndex >= nonWhitespaceWords.length) {
    return null
  }
  return nonWhitespaceWords[targetIndex]
}
