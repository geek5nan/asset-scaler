import { ConvertConfig } from '@/types'

const STORAGE_KEY = 'image-converter-config'

export function saveConfig(config: ConvertConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('Failed to save config:', error)
  }
}

export function loadConfig(): ConvertConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as ConvertConfig
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
  return null
}

export function getDefaultConfig(): ConvertConfig {
  return {
    inputScale: 3,
    quality: 75,
    selectedDensities: ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi'], // 默认生成这4个密度
  }
}

