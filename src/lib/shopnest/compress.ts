'use client'

/**
 * Client-side image compression before upload:
 * resizes to max 1000px on the long edge and re-encodes as JPEG (~0.7 quality),
 * keeping photo storage costs low.
 */
export async function compressImageFile(file: File, maxSize = 1000, quality = 0.72): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode the image.'))
    image.src = dataUrl
  })

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, w, h)

  const compressed = canvas.toDataURL('image/jpeg', quality)
  return compressed.length < dataUrl.length ? compressed : dataUrl
}
