'use client'

/**
 * V2 Feature Seven — deterministic voice-command parser (no AI APIs).
 *
 * Parses phrases like:
 *   "add two gallons of milk to Walmart"
 *   "add 5 kilos of basmati rice to Bangla Bazar"
 *   "milk" / "2 kg rice"
 *
 * Extracts { quantity, unit, name, storeName }. Returns confidence so the UI
 * can ask the user to confirm before saving when parsing is ambiguous.
 * Bangla numerals and common Bangla unit words are supported.
 */

import { UNITS } from '@/lib/shopnest/constants'

export type ParsedVoiceItem = {
  name: string
  quantity: number
  unit: string
  storeName: string | null
  confidence: 'high' | 'medium' | 'low'
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
  'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10,
}

const UNIT_ALIASES: Record<string, string> = {
  gallon: 'gal', gallons: 'gal', gal: 'gal',
  liter: 'L', liters: 'L', litre: 'L', litres: 'L', l: 'L',
  kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kg: 'kg', 'কেজি': 'kg',
  gram: 'g', grams: 'g', g: 'g', 'গ্রাম': 'g',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml',
  pack: 'pack', packs: 'pack', packet: 'pack',
  dozen: 'dozen', 'ডজন': 'dozen',
  piece: 'pc', pieces: 'pc', pcs: 'pc',
  bunch: 'bunch', bunches: 'bunch',
}

// convert Bangla digits to ASCII
function normalizeDigits(s: string): string {
  const bnDigits = '০১২৩৪৫৬৭৮৯'
  return s.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)))
}

export function parseVoiceCommand(transcript: string): ParsedVoiceItem | null {
  let text = normalizeDigits(transcript.trim())
  if (!text) return null
  text = text.replace(/^(please\s+)?(add|buy|get)\s+/i, '').replace(/\s+to\s+(the\s+)?(shopping\s+)?list\s*$/i, '')

  let quantity = 1
  let unit = 'pc'
  let storeName: string | null = null
  let sawQuantity = false
  let sawUnit = false

  // "to <store>" tail (only when explicitly mentioned)
  const storeMatch = text.match(/\b(?:to|from|at)\s+([a-z\u0980-\u09FF][a-z0-9\u0980-\u09FF '&-]*)$/i)
  if (storeMatch) {
    const candidate = storeMatch[1].trim()
    if (!UNIT_ALIASES[candidate.toLowerCase()]) {
      storeName = candidate.replace(/\b\w/g, (c) => c.toUpperCase())
      text = text.slice(0, storeMatch.index).trim()
    }
  }

  // leading "N unit" or "unit N"
  const leading = text.match(/^([\d.]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|dozen|এক|দুই|তিন|চার|পাঁচ|ছয়|সাত|আট|নয়|দশ)\s+([a-zA-Z\u0980-\u09FF]+)\s+(.*)$/i)
  if (leading) {
    const q = NUMBER_WORDS[leading[1].toLowerCase()] ?? parseFloat(leading[1])
    const u = UNIT_ALIASES[leading[2].toLowerCase()]
    if (Number.isFinite(q) && q > 0 && u) {
      quantity = q
      unit = u
      sawQuantity = true
      sawUnit = true
      text = leading[3]
    }
  }

  if (!sawQuantity) {
    // trailing "name … N unit" e.g. "milk 2 liters"
    const trailing = text.match(/^(.*?)\s+([\d.]+|one|two|…|dozen)\s*([a-zA-Z]+)$/i)
    if (trailing) {
      const q = NUMBER_WORDS[trailing[2].toLowerCase()] ?? parseFloat(trailing[2])
      const u = UNIT_ALIASES[trailing[3].toLowerCase()]
      if (Number.isFinite(q) && q > 0 && u) {
        quantity = q
        unit = u
        sawQuantity = true
        sawUnit = true
        text = trailing[1]
      }
    }
  }

  const name = text.replace(/\s+/g, ' ').trim()
  if (!name) return null

  const confidence: ParsedVoiceItem['confidence'] = sawQuantity && sawUnit ? 'high' : sawQuantity ? 'medium' : name.length > 2 ? 'medium' : 'low'

  return { name: name.charAt(0).toUpperCase() + name.slice(1), quantity, unit: unit as string, storeName, confidence }
}

/** True when this browser exposes the Web Speech API (free, on-device/browser speech recognition). */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
}

export const VOICE_UNITS = UNITS
