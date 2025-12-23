/**
 * XML parsing utilities for Android string resources
 * Enhanced with File System Access API support
 */

import { LocaleResources, MergePreview, MergePreviewDetail, DiffItem, SourceXmlFile, LocaleMapping, AndroidResourceDir } from '@/types'
import { guessLocaleFromFileName } from './localeMapping'

export interface ParseResult {
    success: boolean
    entries: Map<string, string>
    error?: string
}

/**
 * Scan a directory recursively to find Android res directories (src/main/res)
 */
export async function findAndroidResourceDirectories(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string = '',
    depth: number = 0
): Promise<AndroidResourceDir[]> {
    const results: AndroidResourceDir[] = []
    const MAX_DEPTH = 5 // Avoid deep recursion

    if (depth > MAX_DEPTH) return []

    if (currentPath.endsWith('/res') || (currentPath === '' && await isResDirectory(dirHandle))) {
        const moduleName = currentPath ? currentPath.split('/')[0] : dirHandle.name
        results.push({
            name: moduleName,
            path: currentPath || '.',
            handle: dirHandle
        })
        return results
    }

    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
            const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name

            // Optimization: ignore common non-project directories
            if (['.git', '.gradle', '.idea', 'build', 'node_modules'].includes(entry.name)) continue

            const nextHandle = await dirHandle.getDirectoryHandle(entry.name)

            // Check for src/main/res pattern
            if (entry.name === 'src') {
                try {
                    const mainHandle = await nextHandle.getDirectoryHandle('main')
                    const resHandle = await mainHandle.getDirectoryHandle('res')
                    const moduleName = currentPath || dirHandle.name
                    results.push({
                        name: moduleName,
                        path: `${nextPath}/main/res`,
                        handle: resHandle
                    })
                    continue // Found it, no need to go deeper in this branch
                } catch {
                    // Not a src/main/res path
                }
            }

            // Recursive search
            const subResults = await findAndroidResourceDirectories(nextHandle, nextPath, depth + 1)
            results.push(...subResults)
        }
    }

    return results
}

/**
 * Helper to check if a directory looks like an Android res directory
 */
async function isResDirectory(dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
    try {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory' && entry.name.startsWith('values')) {
                return true
            }
        }
    } catch {
        // Ignore errors
    }
    return false
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
 * Generate merge preview with detailed diff items
 * Now uses rawContent to preserve original file order and comments
 */
export function generateMergePreviewWithDetails(
    sourceResources: LocaleResources[],
    targetResources: LocaleResources[],
    replaceExisting: boolean
): MergePreviewDetail[] {
    const previews: MergePreviewDetail[] = []
    const targetMap = new Map(targetResources.map(r => [r.locale, r]))

    for (const source of sourceResources) {
        const target = targetMap.get(source.locale)
        const addedItems: DiffItem[] = []
        const updatedItems: DiffItem[] = []
        const unchangedItems: DiffItem[] = []
        const diffLines: import('@/types').XmlDiffLine[] = []

        if (target && target.rawContent) {
            // Track which target keys are updates
            const updateMap = new Map<string, string>() // key -> new value
            const processedKeys = new Set<string>()

            // Build update map from source
            source.entries.forEach((value, key) => {
                processedKeys.add(key)
                if (target.entries.has(key)) {
                    const oldValue = target.entries.get(key)!
                    if (oldValue !== value && replaceExisting) {
                        updateMap.set(key, value)
                        updatedItems.push({
                            key,
                            type: 'update',
                            newValue: value,
                            oldValue
                        })
                    } else {
                        unchangedItems.push({
                            key,
                            type: 'unchanged',
                            newValue: oldValue
                        })
                    }
                } else {
                    addedItems.push({
                        key,
                        type: 'add',
                        newValue: value
                    })
                }
            })

            // Add remaining target entries that are not in source
            target.entries.forEach((value, key) => {
                if (!processedKeys.has(key)) {
                    unchangedItems.push({
                        key,
                        type: 'unchanged',
                        newValue: value
                    })
                }
            })

            // Parse rawContent line by line to generate diffLines
            const lines = target.rawContent.split('\n')
            const stringRegex = /<string\s+name="([^"]+)"[^>]*>/

            lines.forEach((line, index) => {
                const match = line.match(stringRegex)
                const lineNumber = index + 1

                if (match) {
                    const key = match[1]
                    if (updateMap.has(key)) {
                        // This line will be updated - show old then new
                        diffLines.push({
                            lineNumber,
                            content: line,
                            type: 'update-old',
                            stringKey: key
                        })
                        // Generate new line content
                        const newValue = updateMap.get(key)!
                        const newLine = line.replace(
                            />.*<\/string>/,
                            `>${newValue}</string>`
                        )
                        diffLines.push({
                            lineNumber: 0, // new line, no number
                            content: newLine,
                            type: 'update-new',
                            stringKey: key
                        })
                    } else {
                        // Unchanged line
                        diffLines.push({
                            lineNumber,
                            content: line,
                            type: 'unchanged',
                            stringKey: key
                        })
                    }
                } else {
                    // Non-string line (comments, tags, etc.) - keep as is
                    diffLines.push({
                        lineNumber,
                        content: line,
                        type: 'unchanged'
                    })
                }
            })

            // Add new entries at the end (before closing </resources>)
            if (addedItems.length > 0) {
                // Find the index of closing </resources> tag
                const closingIndex = diffLines.findIndex(l => l.content.includes('</resources>'))
                const insertIndex = closingIndex >= 0 ? closingIndex : diffLines.length

                addedItems.forEach(item => {
                    diffLines.splice(insertIndex, 0, {
                        lineNumber: 0,
                        content: `    <string name="${item.key}">${item.newValue}</string>`,
                        type: 'add',
                        stringKey: item.key
                    })
                })
            }

            previews.push({
                locale: source.locale,
                folderName: source.folderName,
                sourceCount: source.entries.size,
                targetCount: target.entries.size,
                addCount: addedItems.length,
                overwriteCount: updatedItems.length,
                isNewFile: false,
                addedItems,
                updatedItems,
                unchangedItems,
                diffLines
            })
        } else if (target) {
            // Target exists but no rawContent - fallback to simple diff
            source.entries.forEach((value, key) => {
                if (target.entries.has(key)) {
                    const oldValue = target.entries.get(key)!
                    if (oldValue !== value && replaceExisting) {
                        updatedItems.push({ key, type: 'update', newValue: value, oldValue })
                    } else {
                        unchangedItems.push({ key, type: 'unchanged', newValue: oldValue })
                    }
                } else {
                    addedItems.push({ key, type: 'add', newValue: value })
                }
            })

            // Generate simple diffLines from items
            unchangedItems.forEach((item, idx) => {
                diffLines.push({
                    lineNumber: idx + 1,
                    content: `    <string name="${item.key}">${item.newValue}</string>`,
                    type: 'unchanged',
                    stringKey: item.key
                })
            })
            updatedItems.forEach(item => {
                diffLines.push({
                    lineNumber: 0,
                    content: `    <string name="${item.key}">${item.oldValue}</string>`,
                    type: 'update-old',
                    stringKey: item.key
                })
                diffLines.push({
                    lineNumber: 0,
                    content: `    <string name="${item.key}">${item.newValue}</string>`,
                    type: 'update-new',
                    stringKey: item.key
                })
            })
            addedItems.forEach(item => {
                diffLines.push({
                    lineNumber: 0,
                    content: `    <string name="${item.key}">${item.newValue}</string>`,
                    type: 'add',
                    stringKey: item.key
                })
            })

            previews.push({
                locale: source.locale,
                folderName: source.folderName,
                sourceCount: source.entries.size,
                targetCount: target.entries.size,
                addCount: addedItems.length,
                overwriteCount: updatedItems.length,
                isNewFile: false,
                addedItems,
                updatedItems,
                unchangedItems,
                diffLines
            })
        } else {
            // New locale - all items are additions
            // Add XML declaration and opening resources tag
            diffLines.push({
                lineNumber: 1,
                content: '<?xml version="1.0" encoding="utf-8"?>',
                type: 'add'
            })
            diffLines.push({
                lineNumber: 2,
                content: '<resources>',
                type: 'add'
            })

            source.entries.forEach((value, key) => {
                addedItems.push({
                    key,
                    type: 'add',
                    newValue: value
                })
                diffLines.push({
                    lineNumber: 0,
                    content: `    <string name="${key}">${value}</string>`,
                    type: 'add',
                    stringKey: key
                })
            })

            // Add closing resources tag
            diffLines.push({
                lineNumber: 0,
                content: '</resources>',
                type: 'add'
            })

            previews.push({
                locale: source.locale,
                folderName: source.folderName,
                sourceCount: source.entries.size,
                targetCount: 0,
                addCount: addedItems.length,
                overwriteCount: 0,
                isNewFile: true,
                addedItems,
                updatedItems: [],
                unchangedItems: [],
                diffLines
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


