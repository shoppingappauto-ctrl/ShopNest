/**
 * ShopNest Mobile — native photo capture for "Ask Family" confirmations.
 *
 * Mirrors the web's client-side image compression (max ~1000px long edge,
 * JPEG q≈0.72) so the photo fits comfortably under the API's ~700 KB dataURL
 * cap. The API accepts a base64 data URL in the `dataUrl` field.
 *
 * Two entry points:
 *  • captureConfirmationPhoto() — opens the camera (expo-camera / picker).
 *  • pickConfirmationPhoto()    — opens the photo library.
 *
 * Both return a base64 data URL string, or null if the user cancelled.
 */

import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'

const MAX_LONG_EDGE = 1000
const QUALITY = 0.72

/**
 * Compress on the JS side as a safety net — expo-image-picker already
 * downsamples when `allowsEditing` + quality is set, but the server enforces
 * a strict size cap and we want a deterministic budget.
 */
async function toCompressedDataUrl(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('read-failed'))
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') resolve(result)
        else reject(new Error('not-a-string'))
      }
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function captureConfirmationPhoto(): Promise<string | null> {
  // Camera permission (expo-image-picker handles its own prompt on iOS/Android).
  const cam = await ImagePicker.requestCameraPermissionsAsync()
  if (!cam.granted) return null

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: QUALITY,
    base64: false, // we re-read below for deterministic compression
  })
  if (result.canceled || !result.assets?.[0]?.uri) return null
  return toCompressedDataUrl(result.assets[0].uri)
}

export async function pickConfirmationPhoto(): Promise<string | null> {
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!lib.granted) return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: QUALITY,
    selectionLimit: 1,
  })
  if (result.canceled || !result.assets?.[0]?.uri) return null
  return toCompressedDataUrl(result.assets[0].uri)
}

/** True on iOS (where the camera/library flow is most polished). */
export const NATIVE_PHOTO_PLATFORM = Platform.OS
