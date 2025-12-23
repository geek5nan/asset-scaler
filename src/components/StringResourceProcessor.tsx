import { useState, useCallback, useEffect, useMemo } from 'react'
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
    saveMappingConfig,
    generateMappingsFromFiles
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
    const [globalChangeIndex, setGlobalChangeIndex] = useState(-1)

    // UI state
    const [status, setStatus] = useState<OperationStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [showMappingDialog, setShowMappingDialog] = useState(false)
    const [showImportDialog, setShowImportDialog] = useState(false)
    const [importComment, setImportComment] = useState('')
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, fileName: '' })
    const [importCompleted, setImportCompleted] = useState(false)
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

    // Update preview when data changes
    useEffect(() => {
        if (sourceFiles.length > 0 && mappings.length > 0 && targetDirHandle) {
            const sourceResources = applyMappingToSources(sourceFiles, mappings)
            const preview = generateMergePreviewWithDetails(sourceResources, targetResources, replaceExisting)

            setPreviewDetails(preview)

            // Auto-select first locale (alphabetically) if current selection is invalid
            const isValidSelection = selectedLocale && preview.some(p => p.locale === selectedLocale)
            if (!isValidSelection && preview.length > 0) {
                setSelectedLocale(preview[0].locale)
                setGlobalChangeIndex(0)
            }

            setStatus('ready')
        }
    }, [mappings, sourceFiles, targetResources, targetDirHandle, replaceExisting]) // Removed selectedLocale to avoid re-triggering preview generation on navigation

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

            // Generate mappings from files, preserving existing rules
            const newMappings = generateMappingsFromFiles(files, mappings)
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

    // Refresh all files
    const handleRefresh = useCallback(async () => {
        if (!targetDirHandle && !sourceDirHandle) return

        setStatus('scanning')
        setError(null)

        try {
            // Refresh target resources if project is selected
            if (targetDirHandle) {
                const resources = await scanStringsFromDirectory(targetDirHandle)
                setTargetResources(resources)
            }

            // Refresh source files if translation folder is selected
            if (sourceDirHandle) {
                const files = await scanAllXmlFiles(sourceDirHandle)
                setSourceFiles(files)

                // Update mappings with new entry counts
                const updatedMappings = generateMappingsFromFiles(files, mappings)
                setMappings(updatedMappings)
            }

            setStatus('ready')
        } catch (err) {
            setError('刷新文件失败')
            setStatus('error')
        }
    }, [targetDirHandle, sourceDirHandle, mappings])

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

        const result = await executeMerge(
            targetDirHandle,
            sourceResources,
            targetResources,
            comment,
            (current, total, fileName) => {
                setImportProgress({ current, total, fileName })
            }
        )

        if (result.success) {
            // Set completion state, wait for user to click confirm
            setImportCompleted(true)
        } else {
            setError(result.error || '合并失败')
            setStatus('error')
        }
    }, [targetDirHandle, sourceFiles, mappings, targetResources, replaceExisting])

    // Handle import completion confirmation
    const handleImportConfirm = useCallback(async () => {
        if (!targetDirHandle) return

        setShowImportDialog(false)
        setImportCompleted(false)
        setStatus('success')

        // Refresh target resources
        const updated = await scanStringsFromDirectory(targetDirHandle)
        setTargetResources(updated)
    }, [targetDirHandle])

    // Handle ESC key to close dialogs
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showImportDialog) {
                    // If import completed, use the confirm handler to refresh
                    if (importCompleted) {
                        handleImportConfirm()
                    } else if (status !== 'merging') {
                        setShowImportDialog(false)
                    }
                } else if (showMappingDialog) {
                    setShowMappingDialog(false)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showMappingDialog, showImportDialog, importCompleted, status, handleImportConfirm])

    // Get enabled mappings and data for summary
    const enabledMappings = mappings.filter(m => m.enabled)
    const totalSourceEntries = enabledMappings.reduce((sum, m) => sum + (m.entryCount || 0), 0)
    const selectedPreview = previewDetails.find(p => p.locale === selectedLocale) || null
    const totalAdd = previewDetails.reduce((sum, p) => sum + p.addCount, 0)
    const totalUpdate = previewDetails.reduce((sum, p) => sum + p.overwriteCount, 0)

    // Flat list of all changes for cross-file navigation
    const globalChanges = useMemo(() => {
        const changes: { locale: string, lineIndex: number }[] = []
        previewDetails.forEach(p => {
            p.diffLines?.forEach((line, idx) => {
                if (line.type === 'add' || line.type === 'update-old' || line.type === 'update-new') {
                    changes.push({ locale: p.locale, lineIndex: idx })
                }
            })
        })
        return changes
    }, [previewDetails])

    const navigateChange = useCallback((delta: number) => {
        if (globalChanges.length === 0) return

        let newIndex = globalChangeIndex + delta

        // Implement circular navigation
        if (newIndex < 0) {
            newIndex = globalChanges.length - 1  // Wrap to last
        } else if (newIndex >= globalChanges.length) {
            newIndex = 0  // Wrap to first
        }

        const change = globalChanges[newIndex]
        setGlobalChangeIndex(newIndex)
        if (change.locale !== selectedLocale) {
            setSelectedLocale(change.locale)
        }
    }, [globalChangeIndex, globalChanges, selectedLocale])

    // Update global index when locale is selected manually
    const handleSelectLocale = useCallback((locale: string) => {
        setSelectedLocale(locale)
        const firstChangeIdx = globalChanges.findIndex((c: { locale: string }) => c.locale === locale)
        if (firstChangeIdx >= 0) {
            setGlobalChangeIndex(firstChangeIdx)
        }
    }, [globalChanges])


    // Handle keyboard shortcuts for navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // N for next change, P for previous change (only when not in input/textarea)
            const target = e.target as HTMLElement
            const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

            // Also check if any modifier keys are pressed (Ctrl, Alt, Meta)
            const hasModifier = e.ctrlKey || e.altKey || e.metaKey

            if (!isInputField && !showImportDialog && !showMappingDialog && !hasModifier) {
                if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault()
                    e.stopPropagation()
                    navigateChange(1)
                } else if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault()
                    e.stopPropagation()
                    navigateChange(-1)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown, { capture: true })
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }, [showMappingDialog, showImportDialog, navigateChange])

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
                                    onSelectLocale={handleSelectLocale}
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
                            <DiffPreview
                                preview={selectedPreview}
                                projectRootName={projectRootName}
                                resPath={selectedResDir?.path || null}
                                activeLineIndex={
                                    globalChangeIndex >= 0 && globalChanges[globalChangeIndex]?.locale === selectedLocale
                                        ? globalChanges[globalChangeIndex].lineIndex
                                        : null
                                }
                                onNavigatePrev={() => navigateChange(-1)}
                                onNavigateNext={() => navigateChange(1)}
                                hasPrev={globalChangeIndex > 0}
                                hasNext={globalChangeIndex < globalChanges.length - 1}
                            />
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
                        canImport={totalAdd > 0 || totalUpdate > 0}
                        canRefresh={!!(targetDirHandle || sourceDirHandle)}
                        onOpenImportDialog={() => {
                            setImportComment('')
                            setShowImportDialog(true)
                        }}
                        onRefresh={handleRefresh}
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
                onClose={importCompleted ? handleImportConfirm : () => setShowImportDialog(false)}
                localeCount={previewDetails.length}
                totalAdd={totalAdd}
                totalUpdate={totalUpdate}
                importComment={importComment}
                isImporting={status === 'merging'}
                importCompleted={importCompleted}
                importProgress={importProgress}
                onCommentChange={setImportComment}
                onConfirm={handleMerge}
                onConfirmCompletion={handleImportConfirm}
            />
        </div>
    )
}
