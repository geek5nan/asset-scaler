export interface ImageFile {
  id: string
  file: File
  name: string
  width: number
  height: number
  size: number
  preview: string
}

export interface ConvertConfig {
  inputScale: number // 1, 2, 3, or 4
  quality: number // 0-100
  selectedDensities: string[] // e.g. ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable']
}

export interface ConvertProgress {
  current: number
  total: number
  currentFile?: string
  currentDensity?: string
}

export interface ConvertResult {
  files: number
  folders: number
  totalFiles: number
  zipBlob: Blob
}

