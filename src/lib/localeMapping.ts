/**
 * Locale mapping configuration utilities
 * Handles saving, loading, and exporting mapping rules
 */

import { LocaleMapping, LocaleMappingConfig } from '@/types'

const STORAGE_KEY = 'asset-scaler-locale-mapping'

/**
 * Guess locale code from filename
 * Examples:
 * - ar_strings.xml -> ar
 * - zh_CN_strings.xml -> zh-rCN
 * - bn_BD_strings.xml -> bn-rBD
 * - en_strings.xml -> default (English as default)
 * - pt_br_strings.xml -> pt-rBR
 */
export function guessLocaleFromFileName(fileName: string): { locale: string; folder: string } {
    // Remove .xml extension and common suffixes
    const baseName = fileName
        .replace(/\.xml$/i, '')
        .replace(/_strings$/i, '')
        .replace(/strings_/i, '')
        .replace(/^strings_/i, '')

    // Handle common patterns
    const parts = baseName.split(/[_-]/)

    if (parts.length === 0 || baseName === '' || baseName === 'strings') {
        return { locale: 'default', folder: 'values' }
    }

    // English is typically the default
    if (parts[0].toLowerCase() === 'en' && parts.length === 1) {
        return { locale: 'default', folder: 'values' }
    }

    // Handle language_REGION format (e.g., zh_CN, pt_BR)
    if (parts.length >= 2) {
        const lang = parts[0].toLowerCase()
        const region = parts[1].toUpperCase()

        // Check if second part looks like a region code
        if (region.length === 2 && /^[A-Z]{2}$/.test(region)) {
            const locale = `${lang}-r${region}`
            return { locale, folder: `values-${locale}` }
        }
    }

    // Single language code
    const locale = parts[0].toLowerCase()
    return { locale, folder: `values-${locale}` }
}

/**
 * Generate auto mapping suggestions from file names
 */
export function generateAutoMappings(fileNames: string[]): LocaleMapping[] {
    return fileNames.map(fileName => {
        const { locale, folder } = guessLocaleFromFileName(fileName)
        return {
            sourceFileName: fileName,
            targetFolder: folder,
            locale,
            enabled: true
        }
    })
}

/**
 * Save mapping config to localStorage
 */
export function saveMappingConfig(config: LocaleMappingConfig): void {
    try {
        // Convert Maps to plain objects for JSON serialization
        const serializable = {
            ...config,
            lastModified: new Date().toISOString()
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
    } catch (error) {
        console.error('Failed to save mapping config:', error)
    }
}

/**
 * Load mapping config from localStorage
 */
export function loadMappingConfig(): LocaleMappingConfig | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            return JSON.parse(stored) as LocaleMappingConfig
        }
    } catch (error) {
        console.error('Failed to load mapping config:', error)
    }
    return null
}

/**
 * Export mapping config as JSON file download
 */
export function exportMappingConfig(config: LocaleMappingConfig): void {
    const data = JSON.stringify(config, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'locale-mapping.json'
    a.click()
    URL.revokeObjectURL(url)
}

/**
 * Parse imported JSON config
 */
export function parseImportedConfig(content: string): LocaleMappingConfig | null {
    try {
        const parsed = JSON.parse(content)
        if (parsed.mappings && Array.isArray(parsed.mappings)) {
            return parsed as LocaleMappingConfig
        }
    } catch {
        // Invalid JSON
    }
    return null
}
