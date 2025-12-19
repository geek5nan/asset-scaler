/**
 * XML parsing utilities for Android string resources
 * Enhanced with File System Access API support
 */

import { LocaleResources, MergePreview, SourceXmlFile, LocaleMapping } from '@/types'
import { guessLocaleFromFileName } from './localeMapping'

export interface ParseResult {
    success: boolean
    entries: Map<string, string>
    error?: string
}

/**
 * Extract locale from folder name (e.g., 'values-zh' -> 'zh', 'values' -> 'default')
 */
export function extractLocaleFromFolderName(folderName: string): string {
    if (folderName === 'values') {
        return 'default'
    }
    // Handle formats like 'values-zh', 'values-zh-rCN', 'values-pt-rBR'
    const match = folderName.match(/^values-(.+)$/)
    return match ? match[1] : 'default'
}

/**
 * Parse XML content and extract string resources as Map
 */
export function parseStringsXml(content: string): ParseResult {
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(content, 'application/xml')

        const parseError = doc.querySelector('parsererror')
        if (parseError) {
            return { success: false, entries: new Map(), error: 'XML 格式错误' }
        }

        const resources = doc.querySelector('resources')
        if (!resources) {
            return { success: false, entries: new Map(), error: '未找到 <resources> 标签' }
        }

        const entries = new Map<string, string>()
        const stringElements = resources.querySelectorAll('string')

        stringElements.forEach(el => {
            const name = el.getAttribute('name')
            if (name) {
                // Get the full inner content (preserving any CDATA, escapes, etc.)
                entries.set(name, el.textContent || '')
            }
        })

        return { success: true, entries }
    } catch (error) {
        return {
            success: false,
            entries: new Map(),
            error: error instanceof Error ? error.message : '解析失败'
        }
    }
}

/**
 * Scan a directory for strings.xml files in values* folders (standard Android structure)
 */
export async function scanStringsFromDirectory(
    dirHandle: FileSystemDirectoryHandle
): Promise<LocaleResources[]> {
    const results: LocaleResources[] = []

    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory' && entry.name.startsWith('values')) {
            try {
                const valuesDirHandle = await dirHandle.getDirectoryHandle(entry.name)
                const stringsFileHandle = await valuesDirHandle.getFileHandle('strings.xml')
                const file = await stringsFileHandle.getFile()
                const content = await file.text()

                const parseResult = parseStringsXml(content)
                if (parseResult.success) {
                    results.push({
                        locale: extractLocaleFromFolderName(entry.name),
                        folderName: entry.name,
                        entries: parseResult.entries,
                        rawContent: content
                    })
                }
            } catch {
                // strings.xml doesn't exist in this values folder, skip
            }
        }
    }

    return results
}

/**
 * Scan a directory for ALL XML files (non-standard structure like {lang}_strings.xml)
 */
export async function scanAllXmlFiles(
    dirHandle: FileSystemDirectoryHandle
): Promise<SourceXmlFile[]> {
    const results: SourceXmlFile[] = []

    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.xml')) {
            try {
                const fileHandle = await dirHandle.getFileHandle(entry.name)
                const file = await fileHandle.getFile()
                const content = await file.text()

                const parseResult = parseStringsXml(content)
                if (parseResult.success) {
                    const { locale, folder } = guessLocaleFromFileName(entry.name)
                    results.push({
                        fileName: entry.name,
                        file,
                        entries: parseResult.entries,
                        suggestedLocale: locale,
                        suggestedFolder: folder
                    })
                }
            } catch {
                // Skip files that can't be read
            }
        }
    }

    // Sort by filename
    results.sort((a, b) => a.fileName.localeCompare(b.fileName))
    return results
}

/**
 * Convert source files to LocaleResources using mapping rules
 */
export function applyMappingToSources(
    sourceFiles: SourceXmlFile[],
    mappings: LocaleMapping[]
): LocaleResources[] {
    const mappingMap = new Map(mappings.map(m => [m.sourceFileName, m]))
    const results: LocaleResources[] = []

    for (const source of sourceFiles) {
        const mapping = mappingMap.get(source.fileName)
        if (mapping && mapping.enabled) {
            results.push({
                locale: mapping.locale,
                folderName: mapping.targetFolder,
                entries: source.entries
            })
        }
    }

    return results
}

/**
 * Generate merge preview between source and target resources
 */
export function generateMergePreview(
    sourceResources: LocaleResources[],
    targetResources: LocaleResources[]
): MergePreview[] {
    const previews: MergePreview[] = []
    const targetMap = new Map(targetResources.map(r => [r.locale, r]))

    for (const source of sourceResources) {
        const target = targetMap.get(source.locale)

        if (target) {
            // Existing locale - calculate adds and overwrites
            let addCount = 0
            let overwriteCount = 0

            source.entries.forEach((value, key) => {
                if (target.entries.has(key)) {
                    if (target.entries.get(key) !== value) {
                        overwriteCount++
                    }
                } else {
                    addCount++
                }
            })

            previews.push({
                locale: source.locale,
                folderName: source.folderName,
                sourceCount: source.entries.size,
                targetCount: target.entries.size,
                addCount,
                overwriteCount,
                isNewFile: false
            })
        } else {
            // New locale
            previews.push({
                locale: source.locale,
                folderName: source.folderName,
                sourceCount: source.entries.size,
                targetCount: 0,
                addCount: source.entries.size,
                overwriteCount: 0,
                isNewFile: true
            })
        }
    }

    return previews
}

/**
 * Merge source entries into target entries
 */
export function mergeEntries(
    target: Map<string, string>,
    source: Map<string, string>
): Map<string, string> {
    const merged = new Map(target)
    source.forEach((value, key) => {
        merged.set(key, value)
    })
    return merged
}

/**
 * Generate strings.xml content from entries map (for new files only)
 */
export function generateStringsXmlContent(entries: Map<string, string>, indent: string = '    ', comment?: string): string {
    const lines: string[] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<resources>'
    ]

    // Add comment if provided
    if (comment && entries.size > 0) {
        lines.push(`${indent}<!-- ${comment} -->`)
    }

    entries.forEach((value, name) => {
        const escapedValue = escapeXmlValue(value)
        lines.push(`${indent}<string name="${name}">${escapedValue}</string>`)
    })

    lines.push('</resources>')
    lines.push('')

    return lines.join('\n')
}

/**
 * Escape special XML characters
 */
function escapeXmlValue(value: string): string {
    // If already contains XML entities, assume it's pre-escaped
    if (value.includes('&amp;') || value.includes('&lt;') || value.includes('&gt;')) {
        return value
    }
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

/**
 * Detect indentation style from existing XML content
 * Uses the last <string> element before </resources> for reliable detection
 */
function detectIndentation(content: string): string {
    const lines = content.split('\n')

    // Find </resources> line and work backwards to find the last <string> element
    let closingIndex = -1
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('</resources>')) {
            closingIndex = i
            break
        }
    }

    // Search backwards from </resources> to find the last element with indentation
    if (closingIndex > 0) {
        for (let i = closingIndex - 1; i >= 0; i--) {
            const line = lines[i]
            // Match any line that starts with whitespace followed by <
            const match = line.match(/^(\s+)</)
            if (match && match[1]) {
                return match[1]
            }
        }
    }

    // Default to 4 spaces
    return '    '
}

/**
 * Merge source entries into existing XML content, preserving formatting
 * - Removes replaced entries from their original position
 * - Appends all new/updated entries at the end (before </resources>)
 * - Optionally adds a comment before the new entries
 */
export function mergeIntoExistingXml(
    originalContent: string,
    sourceEntries: Map<string, string>,
    comment?: string
): string {
    const indent = detectIndentation(originalContent)
    const lines = originalContent.split('\n')

    // Find which entries need to be added/replaced
    const entriesToAdd: Map<string, string> = new Map()
    const namesToRemove: Set<string> = new Set()

    sourceEntries.forEach((value, name) => {
        entriesToAdd.set(name, value)
        namesToRemove.add(name) // Will remove if exists
    })

    // Process lines: remove entries that will be replaced
    const resultLines: string[] = []
    let closingTagIndex = -1
    let i = 0

    while (i < lines.length) {
        const line = lines[i]

        // Check if this line contains </resources>
        if (line.includes('</resources>')) {
            closingTagIndex = resultLines.length
            resultLines.push(line)
            i++
            continue
        }

        // Check if this line starts a <string> element we need to remove
        const stringMatch = line.match(/<string\s+name="([^"]+)"/)
        if (stringMatch && namesToRemove.has(stringMatch[1])) {
            // Check if it's a single-line or multi-line string
            if (line.includes('</string>')) {
                // Single line - skip it
                i++
                continue
            } else {
                // Multi-line - skip until closing </string>
                while (i < lines.length && !lines[i].includes('</string>')) {
                    i++
                }
                i++ // Skip the closing </string> line too
                continue
            }
        }

        resultLines.push(line)
        i++
    }

    // Insert new entries before </resources>
    if (closingTagIndex === -1) {
        // Malformed XML, just append at the end
        closingTagIndex = resultLines.length
        resultLines.push('</resources>')
    }

    // Build new entries with optional comment
    const newEntryLines: string[] = []

    // Add comment if provided
    if (comment && entriesToAdd.size > 0) {
        newEntryLines.push(`${indent}<!-- ${comment} -->`)
    }

    entriesToAdd.forEach((value, name) => {
        const escapedValue = escapeXmlValue(value)
        newEntryLines.push(`${indent}<string name="${name}">${escapedValue}</string>`)
    })

    // Insert before </resources>
    resultLines.splice(closingTagIndex, 0, ...newEntryLines)

    return resultLines.join('\n')
}

/**
 * Write strings.xml to target directory (preserving existing content structure)
 */
export async function writeStringsXml(
    targetDirHandle: FileSystemDirectoryHandle,
    folderName: string,
    content: string
): Promise<void> {
    // Get or create the values-* folder
    let valuesDirHandle: FileSystemDirectoryHandle
    try {
        valuesDirHandle = await targetDirHandle.getDirectoryHandle(folderName, { create: true })
    } catch {
        throw new Error(`无法创建目录: ${folderName}`)
    }

    // Create or overwrite strings.xml
    const fileHandle = await valuesDirHandle.getFileHandle('strings.xml', { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
}

/**
 * Execute the merge operation (preserving original file formatting)
 */
export async function executeMerge(
    targetDirHandle: FileSystemDirectoryHandle,
    sourceResources: LocaleResources[],
    targetResources: LocaleResources[],
    comment?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const targetMap = new Map(targetResources.map(r => [r.locale, r]))

        for (const source of sourceResources) {
            const target = targetMap.get(source.locale)

            let content: string
            if (target && target.rawContent) {
                // Merge into existing file, preserving formatting
                content = mergeIntoExistingXml(target.rawContent, source.entries, comment)
            } else {
                // New file - generate from scratch
                content = generateStringsXmlContent(source.entries, '    ', comment)
            }

            await writeStringsXml(targetDirHandle, source.folderName, content)
        }

        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '合并失败'
        }
    }
}


