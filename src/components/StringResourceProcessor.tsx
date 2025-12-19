import { useState, useCallback, useRef, useEffect } from 'react'
import { FolderOpen, ArrowRight, Loader2, Check, AlertCircle, RefreshCw, Save, Download, Upload, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { LocaleResources, MergePreview, SourceXmlFile, LocaleMapping, LocaleMappingConfig } from '@/types'
import {
    scanStringsFromDirectory,
    scanAllXmlFiles,
    generateMergePreview,
    executeMerge,
    applyMappingToSources
} from '@/lib/xmlUtils'
import {
    saveMappingConfig,
    loadMappingConfig,
    exportMappingConfig,
    parseImportedConfig
} from '@/lib/localeMapping'

type OperationStatus = 'idle' | 'scanning' | 'ready' | 'merging' | 'success' | 'error'

export function StringResourceProcessor() {
    // Directory handles
    const [sourceDirHandle, setSourceDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
    const [targetDirHandle, setTargetDirHandle] = useState<FileSystemDirectoryHandle | null>(null)

    // Source files and mappings
    const [sourceFiles, setSourceFiles] = useState<SourceXmlFile[]>([])
    const [mappings, setMappings] = useState<LocaleMapping[]>([])

    // Target resources
    const [targetResources, setTargetResources] = useState<LocaleResources[]>([])

    // Preview and status
    const [mergePreview, setMergePreview] = useState<MergePreview[]>([])
    const [status, setStatus] = useState<OperationStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [showMappingConfig, setShowMappingConfig] = useState(false)

    // Import comment
    const [importComment, setImportComment] = useState<string>(
        () => `Imported at ${new Date().toISOString().split('T')[0]}`
    )

    const importInputRef = useRef<HTMLInputElement>(null)

    // Check if File System Access API is supported
    const isSupported = 'showDirectoryPicker' in window

    // Load saved mappings on mount
    useEffect(() => {
        const saved = loadMappingConfig()
        if (saved) {
            setMappings(saved.mappings)
        }
    }, [])

    // Update merge preview when mappings or target changes
    useEffect(() => {
        // Generate preview when source files exist and target directory is selected
        // Note: targetResources may be empty if target directory has no existing strings.xml
        if (sourceFiles.length > 0 && mappings.length > 0 && targetDirHandle) {
            const sourceResources = applyMappingToSources(sourceFiles, mappings)
            const preview = generateMergePreview(sourceResources, targetResources)
            setMergePreview(preview)
            setStatus('ready')
        }
    }, [mappings, sourceFiles, targetResources, targetDirHandle])

    // Select source directory (non-standard structure)
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
            setShowMappingConfig(true)

            // Update preview if target is already selected
            if (targetResources.length > 0) {
                const sourceResources = applyMappingToSources(files, initialMappings)
                const preview = generateMergePreview(sourceResources, targetResources)
                setMergePreview(preview)
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
    }, [targetResources])

    // Select target directory (standard Android res structure)
    const selectTargetDir = useCallback(async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'string-target-dir' })
            setTargetDirHandle(handle)
            setStatus('scanning')
            setError(null)

            const resources = await scanStringsFromDirectory(handle)
            setTargetResources(resources)

            // Update preview if source is already selected
            if (sourceFiles.length > 0 && mappings.length > 0) {
                const sourceResources = applyMappingToSources(sourceFiles, mappings)
                const preview = generateMergePreview(sourceResources, resources)
                setMergePreview(preview)
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
    }, [sourceFiles, mappings])

    // Update a single mapping
    const updateMapping = useCallback((index: number, updates: Partial<LocaleMapping>) => {
        setMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, ...updates } : m
        ))
    }, [])

    // Toggle mapping enabled
    const toggleMapping = useCallback((index: number) => {
        setMappings(prev => prev.map((m, i) =>
            i === index ? { ...m, enabled: !m.enabled } : m
        ))
    }, [])

    // Save mappings to localStorage
    const handleSaveMappings = useCallback(() => {
        const config: LocaleMappingConfig = {
            mappings,
            lastModified: new Date().toISOString()
        }
        saveMappingConfig(config)
        setError(null)
    }, [mappings])

    // Export mappings as JSON
    const handleExportMappings = useCallback(() => {
        const config: LocaleMappingConfig = {
            mappings,
            lastModified: new Date().toISOString()
        }
        exportMappingConfig(config)
    }, [mappings])

    // Import mappings from JSON
    const handleImportMappings = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            const config = parseImportedConfig(reader.result as string)
            if (config) {
                setMappings(config.mappings)
            } else {
                setError('无效的配置文件')
            }
        }
        reader.readAsText(file)

        // Reset input
        if (importInputRef.current) {
            importInputRef.current.value = ''
        }
    }, [])

    // Execute merge
    const handleMerge = useCallback(async () => {
        if (!targetDirHandle || sourceFiles.length === 0) return

        setStatus('merging')
        setError(null)

        const sourceResources = applyMappingToSources(sourceFiles, mappings)
        const comment = importComment.trim() || undefined
        const result = await executeMerge(targetDirHandle, sourceResources, targetResources, comment)

        if (result.success) {
            setStatus('success')
            // Refresh target resources after merge
            const updated = await scanStringsFromDirectory(targetDirHandle)
            setTargetResources(updated)
        } else {
            setError(result.error || '合并失败')
            setStatus('error')
        }
    }, [targetDirHandle, sourceFiles, mappings, targetResources, importComment])

    // Reset all
    const handleReset = useCallback(() => {
        setSourceDirHandle(null)
        setTargetDirHandle(null)
        setSourceFiles([])
        setMappings([])
        setTargetResources([])
        setMergePreview([])
        setStatus('idle')
        setError(null)
        setShowMappingConfig(false)
    }, [])

    // Calculate totals
    const enabledMappings = mappings.filter(m => m.enabled)
    const totalSourceEntries = enabledMappings.reduce((sum, m) => sum + (m.entryCount || 0), 0)
    const totalTargetEntries = targetResources.reduce((sum, r) => sum + r.entries.size, 0)
    const totalAdd = mergePreview.reduce((sum, p) => sum + p.addCount, 0)
    const totalOverwrite = mergePreview.reduce((sum, p) => sum + p.overwriteCount, 0)

    if (!isSupported) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold mb-2">浏览器不支持</h2>
                    <p className="text-muted-foreground">
                        File System Access API 仅支持 Chrome 和 Edge 浏览器。
                        请使用支持的浏览器访问此功能。
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Header Description */}
            <div className="p-6 pb-0">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h2 className="text-lg font-semibold text-blue-900 mb-1">字符串资源处理器</h2>
                    <p className="text-sm text-blue-700">
                        将源目录的字符串资源合并到目标项目中，支持自定义文件名到语言的映射
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Directory Selection Row */}
                <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-start">
                    {/* Source Directory */}
                    <div className="bg-white rounded-lg border p-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            ① 源字符串资源
                        </h3>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-12"
                            onClick={selectSourceDir}
                        >
                            <FolderOpen className="h-5 w-5" />
                            {sourceDirHandle ? sourceDirHandle.name : '选择资源文件夹'}
                        </Button>

                        {sourceFiles.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                        已识别 {sourceFiles.length} 个文件
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setShowMappingConfig(!showMappingConfig)}
                                    >
                                        <Settings2 className="h-3 w-3 mr-1" />
                                        配置映射
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {enabledMappings.slice(0, 8).map(m => (
                                        <Badge key={m.sourceFileName} variant="secondary" className="text-xs">
                                            {m.locale === 'default' ? '默认' : m.locale}
                                            <span className="ml-1 text-muted-foreground">({m.entryCount})</span>
                                        </Badge>
                                    ))}
                                    {enabledMappings.length > 8 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{enabledMappings.length - 8} 更多
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    共 {enabledMappings.length} 个语言，{totalSourceEntries} 条字符串
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center h-12 mt-8">
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    </div>

                    {/* Target Directory */}
                    <div className="bg-white rounded-lg border p-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            ② 目标项目 res 目录
                        </h3>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2 h-12"
                            onClick={selectTargetDir}
                        >
                            <FolderOpen className="h-5 w-5" />
                            {targetDirHandle ? targetDirHandle.name : '选择项目 res 文件夹'}
                        </Button>

                        {targetResources.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {targetResources.slice(0, 8).map(r => (
                                        <Badge key={r.locale} variant="outline" className="text-xs">
                                            {r.locale === 'default' ? '默认' : r.locale}
                                            <span className="ml-1 text-muted-foreground">({r.entries.size})</span>
                                        </Badge>
                                    ))}
                                    {targetResources.length > 8 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{targetResources.length - 8} 更多
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    共 {targetResources.length} 个语言，{totalTargetEntries} 条字符串
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mapping Configuration */}
                {showMappingConfig && mappings.length > 0 && (
                    <div className="bg-white rounded-lg border">
                        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">语言映射配置</h3>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-7" onClick={handleSaveMappings}>
                                    <Save className="h-3 w-3 mr-1" />
                                    保存
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7" onClick={handleExportMappings}>
                                    <Download className="h-3 w-3 mr-1" />
                                    导出
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7" onClick={() => importInputRef.current?.click()}>
                                    <Upload className="h-3 w-3 mr-1" />
                                    导入
                                </Button>
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={handleImportMappings}
                                />
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium w-8">启用</th>
                                        <th className="px-4 py-2 text-left font-medium">源文件</th>
                                        <th className="px-4 py-2 text-left font-medium">→</th>
                                        <th className="px-4 py-2 text-left font-medium">目标目录</th>
                                        <th className="px-4 py-2 text-right font-medium">条数</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {mappings.map((mapping, index) => (
                                        <tr key={mapping.sourceFileName} className={!mapping.enabled ? 'opacity-50' : ''}>
                                            <td className="px-4 py-2">
                                                <Checkbox
                                                    checked={mapping.enabled}
                                                    onCheckedChange={() => toggleMapping(index)}
                                                />
                                            </td>
                                            <td className="px-4 py-2 font-mono text-xs">{mapping.sourceFileName}</td>
                                            <td className="px-4 py-2 text-muted-foreground">→</td>
                                            <td className="px-4 py-2">
                                                <Input
                                                    value={mapping.targetFolder}
                                                    onChange={(e) => updateMapping(index, {
                                                        targetFolder: e.target.value,
                                                        locale: e.target.value === 'values' ? 'default' : e.target.value.replace('values-', '')
                                                    })}
                                                    className="h-7 text-xs font-mono w-40"
                                                    disabled={!mapping.enabled}
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-right text-muted-foreground">{mapping.entryCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Merge Preview */}
                {mergePreview.length > 0 && (
                    <div className="bg-white rounded-lg border">
                        <div className="px-4 py-3 border-b bg-slate-50">
                            <h3 className="text-sm font-semibold">合并预览</h3>
                        </div>
                        <div className="divide-y max-h-48 overflow-y-auto">
                            {mergePreview.map(p => (
                                <div key={p.locale} className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm">{p.folderName}/strings.xml</span>
                                        {p.isNewFile && (
                                            <Badge className="bg-green-100 text-green-700 text-xs">新建</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        {p.addCount > 0 && (
                                            <span className="text-green-600">+{p.addCount} 新增</span>
                                        )}
                                        {p.overwriteCount > 0 && (
                                            <span className="text-amber-600">{p.overwriteCount} 覆盖</span>
                                        )}
                                        {p.addCount === 0 && p.overwriteCount === 0 && (
                                            <span className="text-muted-foreground">无变更</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-3 border-t bg-slate-50 text-sm text-muted-foreground">
                            总计: +{totalAdd} 新增, {totalOverwrite} 覆盖
                        </div>
                    </div>
                )}

                {/* Import Comment Input */}
                {mergePreview.length > 0 && (totalAdd > 0 || totalOverwrite > 0) && (
                    <div className="bg-white rounded-lg border p-4">
                        <label className="text-sm font-medium mb-2 block">
                            导入注释 <span className="text-muted-foreground font-normal">(可选，将作为 XML 注释插入)</span>
                        </label>
                        <Input
                            value={importComment}
                            onChange={(e) => setImportComment(e.target.value)}
                            placeholder="例如: Imported at 2024-12-19"
                            className="font-mono text-sm"
                        />
                    </div>
                )}

                {/* Status Messages */}
                {status === 'success' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 font-medium">合并完成！文件已写入目标目录。</span>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-700">{error}</span>
                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            {(sourceFiles.length > 0 || targetResources.length > 0) && (
                <div className="flex-shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        重置
                    </Button>

                    <Button
                        onClick={handleMerge}
                        disabled={status === 'merging' || mergePreview.length === 0 || (totalAdd === 0 && totalOverwrite === 0)}
                        className="min-w-32"
                    >
                        {status === 'merging' ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                合并中...
                            </>
                        ) : (
                            '执行合并'
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}
