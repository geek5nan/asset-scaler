import { useState, useCallback, useEffect, useRef } from 'react'
import { FolderOpen, Loader2, Check, AlertCircle, MoreHorizontal, X } from 'lucide-react'
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
    const [focusIndex, setFocusIndex] = useState<number | null>(null)
    const dialogListRef = useRef<HTMLDivElement>(null)

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
                if (showMappingDialog) setShowMappingDialog(false)
                else if (showModuleDialog) setShowModuleDialog(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showModuleDialog, showMappingDialog])

    // Scroll to focused item in dialog
    useEffect(() => {
        if (showMappingDialog && focusIndex !== null && dialogListRef.current) {
            const item = dialogListRef.current.children[focusIndex] as HTMLElement
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

            // Generate initial mappings from files
            const initialMappings: LocaleMapping[] = files.map(f => ({
                sourceFileName: f.fileName,
                targetFolder: f.suggestedFolder,
                locale: f.suggestedLocale,
                enabled: true,
                entryCount: f.entries.size
            }))
            setMappings(initialMappings)

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
    }, [targetDirHandle])

    // Toggle mapping enabled
    const toggleMapping = useCallback((index: number) => {
        setMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, enabled: !m.enabled } : m
        ))
    }, [])

    // Update single mapping
    const updateMapping = useCallback((index: number, updates: Partial<LocaleMapping>) => {
        setMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, ...updates } : m
        ))
    }, [])

    // Handle import mappings
    const handleImportMappings = useCallback((config: LocaleMappingConfig) => {
        setMappings(config.mappings)
    }, [])

    // Execute merge
    const handleMerge = useCallback(async () => {
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
                    source.entries.forEach((value, key) => {
                        if (!target.entries.has(key)) {
                            filteredEntries.set(key, value)
                        }
                    })
                    return { ...source, entries: filteredEntries }
                }
                return source
            })
        }

        const result = await executeMerge(targetDirHandle, sourceResources, targetResources)

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
                                        setFocusIndex(null)
                                        setShowMappingDialog(true)
                                    }}
                                    onEditItem={(index) => {
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
                            onClick={handleMerge}
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
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setShowMappingDialog(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div ref={dialogListRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                            {mappings.map((m, idx) => (
                                <div
                                    key={m.sourceFileName}
                                    className={`p-3 rounded-lg border ${focusIndex === idx ? 'ring-2 ring-primary bg-primary/5' : 'bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <Checkbox
                                            checked={m.enabled}
                                            onCheckedChange={() => toggleMapping(idx)}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm text-slate-600">
                                            {m.sourceFileName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-7">
                                        <Label className="text-xs text-slate-500">目标:</Label>
                                        <Input
                                            value={m.targetFolder}
                                            onChange={(e) => updateMapping(idx, { targetFolder: e.target.value })}
                                            className="h-8 text-sm font-mono flex-1"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 border-t flex justify-end">
                            <Button onClick={() => setShowMappingDialog(false)}>
                                完成
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
