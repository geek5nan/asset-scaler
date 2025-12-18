import { ImageFile } from '@/types'

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.width, height: img.height })
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}

export function createImageFile(file: File): Promise<ImageFile> {
  return new Promise(async (resolve, reject) => {
    try {
      const dimensions = await getImageDimensions(file)
      const preview = URL.createObjectURL(file)
      
      resolve({
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        width: dimensions.width,
        height: dimensions.height,
        size: file.size,
        preview,
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function resizeImage(
  image: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')
  
  ctx.drawImage(image, 0, 0, width, height)
  return canvas
}

export function canvasToWebP(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to WebP'))
        }
      },
      'image/webp',
      quality / 100
    )
  })
}

export function calculateDensities(inputScale: number) {
  const baseScale = 1 / inputScale
  
  return {
    mdpi: { scale: baseScale * 1 },
    hdpi: { scale: baseScale * 1.5 },
    xhdpi: { scale: baseScale * 2 },
    xxhdpi: { scale: baseScale * 3 },
    xxxhdpi: { scale: baseScale * 4 },
  }
}

