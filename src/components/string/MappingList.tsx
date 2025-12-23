import { useRef, useState } from 'react'
import { Download, Upload, Settings2, Pencil, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { LocaleMapping, MergePreviewDetail, LocaleMappingConfig } from '@/types'
import { exportMappingConfig, parseImportedConfig } from '@/lib/localeMapping'

interface MappingListProps {
    mappings: LocaleMapping[]
    previews: MergePreviewDetail[]
    selectedLocale: string | null
    onToggleMapping: (index: number) => void
    onSelectLocale: (locale: string) => void
    onImportMappings: (config: LocaleMappingConfig) => void
    onOpenSettings?: () => void
    onEditItem?: (index: number) => void
}

export function MappingList({
    mappings,
    previews,
    selectedLocale,
    onToggleMapping,
    onSelectLocale,
    onImportMappings,
    onOpenSettings,
    onEditItem
}: MappingListProps) {
    const importInputRef = useRef<HTMLInputElement>(null)
    const [showChangesOnly, setShowChangesOnly] = useState(false)

    // Build preview map for quick lookup
    const previewMap = new Map(previews.map(p => [p.locale, p]))

    // Handle export
    const handleExport = () => {
        const config: LocaleMappingConfig = {
            mappings,
            lastModified: new Date().toISOString()
        }
        exportMappingConfig(config)
    }

    // Handle import
    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            const config = parseImportedConfig(reader.result as string)
            if (config) {
                onImportMappings(config)
            }
        }
        reader.readAsText(file)

        if (importInputRef.current) {
            importInputRef.current.value = ''
        }
    }

    if (mappings.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                <p className="text-sm">请先选择翻译文件夹</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-white rounded-lg border overflow-hidden">
            {/* Header with toolbar */}
            <div className="px-4 py-2 border-b bg-slate-50 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-medium">导入规则</span>
                <div className="flex items-center gap-1">
                    <Button
                        variant={showChangesOnly ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowChangesOnly(!showChangesOnly)}
                        title={showChangesOnly ? "显示全部" : "仅显示变更"}
                    >
                        <Filter className="h-3.5 w-3.5 mr-1" />
                        {showChangesOnly ? '变更' : '全部'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={handleExport}
                        title="导出 JSON"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => importInputRef.current?.click()}
                        title="导入 JSON"
                    >
                        <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="设置"
                        onClick={onOpenSettings}
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportFile}
                    />
                </div>
            </div>

            {/* Mapping list - Two row layout per item */}
            <div className="flex-1 overflow-y-auto">
                {mappings
                    .map((mapping, index) => ({ mapping, index }))
                    .filter(({ mapping }) => {
                        if (!showChangesOnly) return true
                        const preview = previewMap.get(mapping.locale)
                        return preview && (preview.addCount > 0 || preview.overwriteCount > 0)
                    })
                    .map(({ mapping, index }) => {
                        const preview = previewMap.get(mapping.locale)
                        const isSelected = mapping.locale === selectedLocale

                        return (
                            <div
                                key={mapping.sourceFileName}
                                className={`px-4 py-2.5 border-b cursor-pointer transition-colors group ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-slate-50'
                                    } ${!mapping.enabled ? 'opacity-50' : ''}`}
                                onClick={() => mapping.enabled && onSelectLocale(mapping.locale)}
                            >
                                {/* Main Row: Checkbox + Target folder + Badges */}
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={mapping.enabled}
                                        onCheckedChange={() => onToggleMapping(index)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-4 w-4 flex-shrink-0"
                                    />

                                    <span className="font-mono text-sm font-medium text-slate-800 flex-1 truncate">
                                        {mapping.targetFolder}
                                    </span>

                                    {/* Preview badges */}
                                    {preview && (
                                        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                                            {preview.isNewFile ? (
                                                <Badge variant="secondary" className="text-[10px] h-5">
                                                    新建
                                                </Badge>
                                            ) : (
                                                <>
                                                    {preview.overwriteCount > 0 && (
                                                        <span className="text-red-500 font-medium">-{preview.overwriteCount}</span>
                                                    )}
                                                    {(preview.addCount > 0 || preview.overwriteCount > 0) && (
                                                        <span className="text-green-600 font-medium">+{preview.addCount + preview.overwriteCount}</span>
                                                    )}
                                                    {preview.addCount === 0 && preview.overwriteCount === 0 && (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Sub Row: Source file + Edit button */}
                                <div className="flex items-center mt-1 ml-6">
                                    <span className="text-xs text-slate-400">
                                        ← {mapping.sourceFileName}
                                    </span>
                                    <div className="flex-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (onEditItem) {
                                                onEditItem(index)
                                            }
                                        }}
                                    >
                                        <Pencil className="h-3 w-3 text-slate-400" />
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
            </div>
        </div>
    )
}
