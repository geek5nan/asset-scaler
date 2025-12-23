import { useState, useCallback, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import {
    scanStringsFromDirectory,
    scanAllXmlFiles,
    generateMergePreviewWithDetails,
    executeMerge,
    applyMappingToSources,
    findAndroidResourceDirectories
} from '@/lib/xmlUtils'
import {
    loadMappingConfig,
    saveMappingConfig
} from '@/lib/localeMapping'
import {
    LocaleResources,
    MergePreviewDetail,
    SourceXmlFile,
    LocaleMapping,
    LocaleMappingConfig,
    AndroidResourceDir,
    OperationStatus
} from '@/types'

// Import sub-components
import { DiffPreview } from './string/DiffPreview'
import { MappingList } from './string/MappingList'
import { StringSidebar } from './string/StringSidebar'
import { StatusBanners } from './string/StatusBanners'
import { StringActionBar } from './string/StringActionBar'
import { MappingEditorDialog } from './string/MappingEditorDialog'
import { ImportConfirmationDialog } from './string/ImportConfirmationDialog'

export function StringResourceProcessor() {
    // Project state
    const [projectRootName, setProjectRootName] = useState<string | null>(null)
    const [discoveredResDirs, setDiscoveredResDirs] = useState<AndroidResourceDir[]>([])
    const [selectedResDir, setSelectedResDir] = useState<AndroidResourceDir | null>(null)
    const [targetDirHandle, setTargetDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
    const [targetResources, setTargetResources] = useState<LocaleResources[]>([])

    // Source state
    const [sourceDirHandle, setSourceDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
    const [sourceFiles, setSourceFiles] = useState<SourceXmlFile[]>([])

    // Mapping state
    const [mappings, setMappings] = useState<LocaleMapping[]>([])

    // Options
    const [replaceExisting, setReplaceExisting] = useState(true)

    // Preview state
    const [previewDetails, setPreviewDetails] = useState<MergePreviewDetail[]>([])
    const [selectedLocale, setSelectedLocale] = useState<string | null>(null)

    // UI state
    const [status, setStatus] = useState<OperationStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [showMappingDialog, setShowMappingDialog] = useState(false)
    const [showImportDialog, setShowImportDialog] = useState(false)
    const [importComment, setImportComment] = useState('')
    const [tempMappings, setTempMappings] = useState<LocaleMapping[]>([])
    const [focusIndex, setFocusIndex] = useState<number | null>(null)

    // Check if File System Access API is supported
    const isSupported = 'showDirectoryPicker' in window

    // Load saved mappings on mount
    useEffect(() => {
        const saved = loadMappingConfig()
        if (saved) {
            setMappings(saved.mappings)
        }
    }, [])

    // Handle ESC key to close dialogs
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showImportDialog) setShowImportDialog(false)
                else if (showMappingDialog) setShowMappingDialog(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showMappingDialog, showImportDialog])

    // Update preview when data changes
    useEffect(() => {
        if (sourceFiles.length > 0 && mappings.length > 0 && targetDirHandle) {
            const sourceResources = applyMappingToSources(sourceFiles, mappings)
            const preview = generateMergePreviewWithDetails(sourceResources, targetResources, replaceExisting)
            setPreviewDetails(preview)

            // Auto-select first locale if none selected
            if (!selectedLocale && preview.length > 0) {
                setSelectedLocale(preview[0].locale)
            }

            setStatus('ready')
        }
    }, [mappings, sourceFiles, targetResources, targetDirHandle, replaceExisting, selectedLocale])

    // Auto-save mappings when they change
    useEffect(() => {
        if (mappings.length > 0) {
            const config: LocaleMappingConfig = {
                mappings,
                lastModified: new Date().toISOString()
            }
            saveMappingConfig(config)
        }
    }, [mappings])

    // Load a specific res directory
    const loadResDirectory = useCallback(async (resDir: AndroidResourceDir) => {
        setSelectedResDir(resDir)
        setTargetDirHandle(resDir.handle)
        setStatus('scanning')
        try {
            const resources = await scanStringsFromDirectory(resDir.handle)
            setTargetResources(resources)
            setStatus(sourceFiles.length > 0 ? 'ready' : 'idle')
        } catch {
            setError('读取目标资源失败')
            setStatus('error')
        }
    }, [sourceFiles.length])

    // Select project directory (Step 1)
    const selectProjectDir = useCallback(async () => {
        try {
            const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'string-target-dir' })
            setProjectRootName(rootHandle.name)
            setStatus('scanning')
            setError(null)

            const resDirs = await findAndroidResourceDirectories(rootHandle)
            setDiscoveredResDirs(resDirs)

            if (resDirs.length === 0) {
                setError('未在所选目录中找到 Android 资源目录 (src/main/res)')
                setStatus('error')
            } else if (resDirs.length === 1) {
                await loadResDirectory(resDirs[0])
            } else {
                const appModule = resDirs.find(d => d.name.toLowerCase() === 'app')
                if (appModule) {
                    await loadResDirectory(appModule)
                } else {
                    await loadResDirectory(resDirs[0])
                }
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                setError('选择项目失败')
                setStatus('error')
            }
        }
    }, [loadResDirectory])

    // Select source directory (Step 2)
    const selectSourceDir = useCallback(async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'read', id: 'string-source-dir' })
            setSourceDirHandle(handle)
            setStatus('scanning')
            setError(null)

            const files = await scanAllXmlFiles(handle)
            setSourceFiles(files)

            // Generate initial mappings from files, preserving existing rules where possible
            const existingMappingMap = new Map(mappings.map(m => [m.sourceFileName, m]))

            const newMappings: LocaleMapping[] = files.map(f => {
                // Try to find existing mapping for this source file
                const existing = existingMappingMap.get(f.fileName)
                if (existing) {
                    // Preserve existing rule, but update entryCount
                    return { ...existing, entryCount: f.entries.size }
                }
                // Generate new mapping for new source file
                return {
                    sourceFileName: f.fileName,
                    targetFolder: f.suggestedFolder,
                    locale: f.suggestedLocale,
                    enabled: true,
                    entryCount: f.entries.size
                }
            })
            // Sort by targetFolder for better organization
            newMappings.sort((a, b) => a.targetFolder.localeCompare(b.targetFolder))
            setMappings(newMappings)

            if (targetDirHandle) {
                setStatus('ready')
            } else {
                setStatus('idle')
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                setError('选择目录失败')
                setStatus('error')
            }
        }
    }, [targetDirHandle, mappings])

    // Toggle mapping enabled
    const toggleMapping = useCallback((index: number) => {
        setMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, enabled: !m.enabled } : m
        ))
    }, [])

    const toggleTempMapping = useCallback((index: number) => {
        setTempMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, enabled: !m.enabled } : m
        ))
    }, [])

    const updateTempMapping = useCallback((index: number, updates: Partial<LocaleMapping>) => {
        setTempMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, ...updates } : m
        ))
    }, [])

    const saveMappings = useCallback(() => {
        setMappings(tempMappings)
        setShowMappingDialog(false)
    }, [tempMappings])

    // Reset a single mapping to its initial suggested values
    const resetTempMapping = useCallback((index: number) => {
        setTempMappings(prev => {
            const m = prev[index]
            const sourceFile = sourceFiles.find(f => f.fileName === m.sourceFileName)
            if (sourceFile) {
                return prev.map((item, i) =>
                    i === index ? {
                        ...item,
                        targetFolder: sourceFile.suggestedFolder,
                        locale: sourceFile.suggestedLocale,
                        enabled: true
                    } : item
                )
            }
            return prev
        })
    }, [sourceFiles])

    // Reset all mappings to initial suggested values
    const resetAllTempMappings = useCallback(() => {
        setTempMappings(prev => prev.map(m => {
            const sourceFile = sourceFiles.find(f => f.fileName === m.sourceFileName)
            if (sourceFile) {
                return {
                    ...m,
                    targetFolder: sourceFile.suggestedFolder,
                    locale: sourceFile.suggestedLocale,
                    enabled: true
                }
            }
            return m
        }))
    }, [sourceFiles])

    // Handle import mappings
    const handleImportMappings = useCallback((config: LocaleMappingConfig) => {
        setMappings(config.mappings)
    }, [])

    // Execute merge with optional comment
    const handleMerge = useCallback(async (comment?: string) => {
        if (!targetDirHandle || sourceFiles.length === 0) return

        setShowImportDialog(false)
        setStatus('merging')
        setError(null)

        let sourceResources = applyMappingToSources(sourceFiles, mappings)

        if (!replaceExisting) {
            const targetMap = new Map(targetResources.map(r => [r.locale, r]))
            sourceResources = sourceResources.map(source => {
                const target = targetMap.get(source.locale)
                if (target) {
                    const filteredEntries = new Map<string, string>()
                    const filteredRawLines = new Map<string, string>()
                    source.entries.forEach((value, key) => {
                        if (!target.entries.has(key)) {
                            filteredEntries.set(key, value)
                            if (source.rawLines?.has(key)) {
                                filteredRawLines.set(key, source.rawLines.get(key)!)
                            }
                        }
                    })
                    return { ...source, entries: filteredEntries, rawLines: filteredRawLines }
                }
                return source
            })
        }

        const result = await executeMerge(targetDirHandle, sourceResources, targetResources, comment)

        if (result.success) {
            setStatus('success')
            const updated = await scanStringsFromDirectory(targetDirHandle)
            setTargetResources(updated)
        } else {
            setError(result.error || '合并失败')
            setStatus('error')
        }
    }, [targetDirHandle, sourceFiles, mappings, targetResources, replaceExisting])

    // Get enabled mappings and data for summary
    const enabledMappings = mappings.filter(m => m.enabled)
    const totalSourceEntries = enabledMappings.reduce((sum, m) => sum + (m.entryCount || 0), 0)
    const selectedPreview = previewDetails.find(p => p.locale === selectedLocale) || null
    const totalAdd = previewDetails.reduce((sum, p) => sum + p.addCount, 0)
    const totalUpdate = previewDetails.reduce((sum, p) => sum + p.overwriteCount, 0)

    if (!isSupported) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <h2 className="text-lg font-semibold mb-2">浏览器不支持</h2>
                    <p className="text-muted-foreground">
                        File System Access API 仅支持 Chrome 和 Edge 浏览器。
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-1 overflow-hidden">
            <StringSidebar
                projectRootName={projectRootName}
                discoveredResDirs={discoveredResDirs}
                selectedResDir={selectedResDir}
                sourceDirName={sourceDirHandle?.name || null}
                sourceFileCount={sourceFiles.length}
                totalSourceEntries={totalSourceEntries}
                replaceExisting={replaceExisting}
                onSelectProjectDir={selectProjectDir}
                onSelectSourceDir={selectSourceDir}
                onLoadResDirectory={loadResDirectory}
                onReplaceExistingChange={setReplaceExisting}
            />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                <div className="flex-1 flex overflow-hidden p-6 gap-4">
                    {projectRootName && sourceDirHandle && mappings.length > 0 ? (
                        <>
                            <div className="w-[280px] flex-shrink-0">
                                <MappingList
                                    mappings={mappings}
                                    previews={previewDetails}
                                    selectedLocale={selectedLocale}
                                    onToggleMapping={toggleMapping}
                                    onSelectLocale={setSelectedLocale}
                                    onImportMappings={handleImportMappings}
                                    onOpenSettings={() => {
                                        setTempMappings([...mappings])
                                        setFocusIndex(null)
                                        setShowMappingDialog(true)
                                    }}
                                    onEditItem={(index) => {
                                        setTempMappings([...mappings])
                                        setFocusIndex(index)
                                        setShowMappingDialog(true)
                                    }}
                                />
                            </div>
                            <DiffPreview preview={selectedPreview} />
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-md">
                                <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <h2 className="text-lg font-medium text-slate-600 mb-2">开始配置</h2>
                                <p className="text-sm text-muted-foreground">
                                    {!projectRootName
                                        ? '首先选择 Android 项目目录'
                                        : !sourceDirHandle
                                            ? '然后选择包含翻译文件的目录'
                                            : '配置映射关系后即可预览变更'
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <StatusBanners status={status} error={error} />

                {previewDetails.length > 0 && (
                    <StringActionBar
                        localeCount={previewDetails.length}
                        totalAdd={totalAdd}
                        totalUpdate={totalUpdate}
                        isMerging={status === 'merging'}
                        canImport={totalAdd > 0 || totalUpdate > 0}
                        onOpenImportDialog={() => {
                            setImportComment('')
                            setShowImportDialog(true)
                        }}
                    />
                )}
            </main>


            <MappingEditorDialog
                open={showMappingDialog}
                onClose={() => setShowMappingDialog(false)}
                mappings={tempMappings}
                focusIndex={focusIndex}
                onToggle={toggleTempMapping}
                onUpdate={updateTempMapping}
                onResetOne={resetTempMapping}
                onResetAll={resetAllTempMappings}
                onSave={saveMappings}
            />

            <ImportConfirmationDialog
                open={showImportDialog}
                onClose={() => setShowImportDialog(false)}
                localeCount={previewDetails.length}
                totalAdd={totalAdd}
                totalUpdate={totalUpdate}
                importComment={importComment}
                onCommentChange={setImportComment}
                onConfirm={handleMerge}
            />
        </div>
    )
}
