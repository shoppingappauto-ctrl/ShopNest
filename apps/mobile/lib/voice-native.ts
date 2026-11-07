/**
 * ShopNest Mobile — voice input hook (optional, native module bridge).
 *
 * Per the task spec: text input + parseVoiceCommand is the ALWAYS-AVAILABLE
 * path (no permissions, no native module). A clearly-marked optional path
 * uses a community speech-to-text module if present.
 *
 * We DO NOT bundle a hard dependency on any specific speech module (the task
 * spec says: use only the listed dependencies). Instead, this hook lazily
 * probes for an optional peer dep at runtime — if missing, it falls back to
 * text input. This keeps the build hermetic while leaving a clean extension
 * point for production teams to add e.g. `@react-native-voice/voice` or
 * `expo-av` speech.
 *
 * Documented in apps/mobile/README.md.
 */

import { useCallback, useEffect, useState } from 'react'
import { parseVoiceCommand, type ParsedVoiceItem } from '@shopnest/shared'

export type VoiceState = 'idle' | 'listening' | 'unsupported' | 'error'

type NativeVoiceModule = {
  start?: (locale: string, onResult: (text: string) => void, onError?: (e: unknown) => void) => void
  stop?: () => void
  isAvailable?: () => boolean | Promise<boolean>
}

/**
 * Look up an optional native voice module. We try a couple of well-known
 * names but never throw if any are missing. Returns null if none are wired.
 */
function findNativeVoice(): NativeVoiceModule | null {
  const g = globalThis as unknown as Record<string, unknown>
  const candidates = ['Voice', 'ExpoVoice', 'RNVoice', 'ShopNestVoice']
  for (const key of candidates) {
    const m = g[key]
    if (m && typeof m === 'object') return m as NativeVoiceModule
  }
  return null
}

export function useVoiceInput() {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')

  const nativeAvailable = useCallback(() => {
    const mod = findNativeVoice()
    if (!mod) return false
    if (typeof mod.isAvailable === 'function') {
      try {
        const r = mod.isAvailable()
        return typeof r === 'boolean' ? r : false
      } catch {
        return false
      }
    }
    return true // module present, assume available
  }, [])

  /** Begin native speech recognition (no-op when unsupported). */
  const startListening = useCallback(() => {
    const mod = findNativeVoice()
    if (!mod || typeof mod.start !== 'function') {
      setState('unsupported')
      return
    }
    setState('listening')
    try {
      mod.start(
        'en-US',
        (text: string) => {
          setTranscript(text)
          setState('idle')
        },
        () => setState('error'),
      )
    } catch {
      setState('error')
    }
  }, [])

  const stopListening = useCallback(() => {
    const mod = findNativeVoice()
    if (mod && typeof mod.stop === 'function') mod.stop()
    setState('idle')
  }, [])

  return {
    nativeAvailable,
    state,
    transcript,
    setTranscript,
    startListening,
    stopListening,
  }
}

/**
 * The always-available parsing path: take a free-form text transcript
 * ("add 2 gallons of milk to Walmart") and return { name, quantity, unit,
 * storeName, confidence } via the shared parser. Returns null if it can't
 * find a name.
 */
export function parseTranscript(transcript: string): ParsedVoiceItem | null {
  return parseVoiceCommand(transcript)
}
