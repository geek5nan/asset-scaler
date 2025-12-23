import { useState, useCallback, useEffect, useRef } from 'react'
import { FolderOpen, Loader2, Check, AlertCircle, MoreHorizontal, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
    scanStringsFromDirectory,
    scanAllXmlFiles,
    generateMergePreviewWithDetails,
    executeMerge,
    applyMappingToSources,
    findAndroidResourceDirectories
} from '@/lib/xmlUtils'
import {
    saveMappingConfig,
    loadMappingConfig
} from '@/lib/localeMapping'
import {
    LocaleResources,
    MergePreviewDetail,
    SourceXmlFile,
    LocaleMapping,
    LocaleMappingConfig,
    AndroidResourceDir
} from '@/types'
import { DiffPreview } from './DiffPreview'
import { ModuleSelectorDialog } from './ModuleSelectorDialog'
import { MappingList } from './MappingList'

type OperationStatus = 'idle' | 'scanning' | 'ready' | 'merging' | 'success' | 'error'

const MAX_VISIBLE_MODULES = 4

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
    const [showModuleDialog, setShowModuleDialog] = useState(false)
    const [showMappingDialog, setShowMappingDialog] = useState(false)
    const [showImportDialog, setShowImportDialog] = useState(false)
    const [importComment, setImportComment] = useState('')
    const [tempMappings, setTempMappings] = useState<LocaleMapping[]>([])
    const [focusIndex, setFocusIndex] = useState<number | null>(null)
    const dialogListRef = useRef<HTMLDivElement>(null)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
                else if (showModuleDialog) setShowModuleDialog(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showModuleDialog, showMappingDialog, showImportDialog])

    // Scroll to and focus item in dialog
    useEffect(() => {
        if (showMappingDialog && focusIndex !== null && dialogListRef.current) {
            const item = dialogListRef.current.children[focusIndex] as HTMLElement
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' })
                // Focus the input after a short delay to allow for animation/rendering
                setTimeout(() => {
                    inputRefs.current[focusIndex]?.focus()
                    // Select all text for easier editing
                    inputRefs.current[focusIndex]?.select()
                }, 100)
            }
        }
    }, [showMappingDialog, focusIndex])

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

    // Update single mapping in temp state
    const updateTempMapping = useCallback((index: number, updates: Partial<LocaleMapping>) => {
        setTempMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, ...updates } : m
        ))
    }, [])

    const toggleTempMapping = useCallback((index: number) => {
        setTempMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, enabled: !m.enabled } : m
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
                            // Also filter rawLines to keep in sync
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

    // Get visible modules (for button group)
    const visibleModules = discoveredResDirs.slice(0, MAX_VISIBLE_MODULES)
    const hasMoreModules = discoveredResDirs.length > MAX_VISIBLE_MODULES

    // Get enabled mappings and selected preview
    const enabledMappings = mappings.filter(m => m.enabled)
    const totalSourceEntries = enabledMappings.reduce((sum, m) => sum + (m.entryCount || 0), 0)
    const selectedPreview = previewDetails.find(p => p.locale === selectedLocale) || null
    const totalAdd = previewDetails.reduce((sum, p) => sum + p.addCount, 0)
    const totalUpdate = previewDetails.reduce((sum, p) => sum + p.overwriteCount, 0)

    if (!isSupported) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
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
            {/* Sidebar - Simplified */}
            <aside className="w-[280px] border-r bg-white flex-shrink-0 overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Project (Output) Section */}
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            项目 (输出)
                        </h3>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-10"
                            onClick={selectProjectDir}
                        >
                            <FolderOpen className="h-4 w-4" />
                            <span className="truncate">
                                {projectRootName || '选择 Android 项目'}
                            </span>
                        </Button>

                        {/* Module Selection */}
                        {discoveredResDirs.length > 1 && (
                            <div className="mt-3">
                                <Label className="text-xs text-muted-foreground mb-2 block">模块</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {visibleModules.map(module => {
                                        const isSelected = selectedResDir?.path === module.path
                                        return (
                                            <Button
                                                key={module.path}
                                                variant={isSelected ? 'default' : 'outline'}
                                                size="sm"
                                                className="h-7 text-xs px-2.5"
                                                onClick={() => loadResDirectory(module)}
                                            >
                                                {module.name}
                                            </Button>
                                        )
                                    })}
                                    {hasMoreModules && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs px-2"
                                            onClick={() => setShowModuleDialog(true)}
                                        >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-border" />

                    {/* Source (Input) Section */}
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            字符串 (输入)
                        </h3>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-10"
                            onClick={selectSourceDir}
                        >
                            <FolderOpen className="h-4 w-4" />
                            <span className="truncate">
                                {sourceDirHandle?.name || '选择翻译文件夹'}
                            </span>
                        </Button>

                        {sourceFiles.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                                {sourceFiles.length} 个文件, {totalSourceEntries} 条
                            </p>
                        )}
                    </div>

                    {/* Options Section */}
                    {mappings.length > 0 && (
                        <>
                            <div className="h-px bg-border" />
                            <div>
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    合并选项
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="replace-existing"
                                        checked={replaceExisting}
                                        onCheckedChange={(checked) => setReplaceExisting(!!checked)}
                                    />
                                    <Label htmlFor="replace-existing" className="text-sm cursor-pointer">
                                        替换已有字段
                                    </Label>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                                    {replaceExisting ? '将覆盖目标中已存在的 key' : '跳过目标中已存在的 key'}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </aside>

            {/* Main Content - Side by Side Layout */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden p-6 gap-4">
                    {projectRootName && sourceDirHandle && mappings.length > 0 ? (
                        <>
                            {/* Mapping List (Left Side) */}
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

                            {/* Diff Preview (Right Side) */}
                            <DiffPreview preview={selectedPreview} />
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-md">
                                <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <h2 className="text-lg font-medium text-slate-600 mb-2">
                                    开始配置
                                </h2>
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

                {/* Status Messages */}
                {status === 'success' && (
                    <div className="mx-6 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 font-medium">合并完成！文件已写入目标目录。</span>
                    </div>
                )}

                {error && (
                    <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-700">{error}</span>
                    </div>
                )}

                {/* Bottom Action Bar */}
                {previewDetails.length > 0 && (
                    <div className="flex-shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {previewDetails.length} 个语言 · +{totalAdd} 新增 · ~{totalUpdate} 更新
                        </p>
                        <Button
                            onClick={() => {
                                setImportComment('')
                                setShowImportDialog(true)
                            }}
                            disabled={status === 'merging' || (totalAdd === 0 && totalUpdate === 0)}
                        >
                            {status === 'merging' ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    合并中...
                                </>
                            ) : (
                                '开始导入'
                            )}
                        </Button>
                    </div>
                )}
            </main>

            {/* Module Selector Dialog */}
            <ModuleSelectorDialog
                open={showModuleDialog}
                onClose={() => setShowModuleDialog(false)}
                modules={discoveredResDirs}
                selectedModule={selectedResDir}
                onSelect={loadResDirectory}
            />

            {/* Mapping Editor Dialog */}
            {showMappingDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setShowMappingDialog(false)}
                    />
                    <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">编辑导入规则</h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-slate-500 hover:text-primary"
                                    onClick={resetAllTempMappings}
                                    title="恢复全部分配建议"
                                >
                                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                    全部重置
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setShowMappingDialog(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div ref={dialogListRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                            {tempMappings.map((m, idx) => (
                                <div
                                    key={m.sourceFileName}
                                    className={`p-3 rounded-lg border transition-colors ${focusIndex === idx
                                        ? 'border-primary/50 bg-primary/[0.03]'
                                        : 'bg-slate-50 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <Checkbox
                                            checked={m.enabled}
                                            onCheckedChange={() => toggleTempMapping(idx)}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-slate-700">
                                            {m.sourceFileName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-7">
                                        <Label className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">目标:</Label>
                                        <Input
                                            ref={el => inputRefs.current[idx] = el}
                                            value={m.targetFolder}
                                            onChange={(e) => updateTempMapping(idx, { targetFolder: e.target.value })}
                                            onFocus={() => setFocusIndex(idx)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    saveMappings()
                                                }
                                            }}
                                            className="h-9 text-sm font-mono flex-1 bg-white focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-slate-300"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-9 p-0 text-slate-400 hover:text-primary"
                                            onClick={() => resetTempMapping(idx)}
                                            title="恢复建议值"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowMappingDialog(false)}
                            >
                                取消
                            </Button>
                            <Button onClick={saveMappings}>
                                保存配置
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Confirmation Dialog */}
            {showImportDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setShowImportDialog(false)}
                    />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h3 className="text-lg font-semibold">确认导入</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setShowImportDialog(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <div className="text-sm text-muted-foreground">
                                即将导入 {previewDetails.length} 个语言 · +{totalAdd} 新增 · ~{totalUpdate} 更新
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="import-comment">导入说明（可选）</Label>
                                <Input
                                    id="import-comment"
                                    value={importComment}
                                    onChange={(e) => setImportComment(e.target.value)}
                                    placeholder={`Imported on ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`}
                                />
                                <p className="text-xs text-muted-foreground">
                                    这段说明将作为注释添加到导入条目之前
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowImportDialog(false)}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={() => handleMerge(importComment || undefined)}
                            >
                                确认导入
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
