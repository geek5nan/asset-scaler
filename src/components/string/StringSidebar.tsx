import { ChevronDown, FolderOpen, Search } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AndroidResourceDir } from '@/types'

interface StringSidebarProps {
    projectRootName: string | null
    discoveredResDirs: AndroidResourceDir[]
    selectedResDir: AndroidResourceDir | null
    sourceDirName: string | null
    sourceFileCount: number
    totalSourceEntries: number
    replaceExisting: boolean
    onSelectProjectDir: () => void
    onSelectSourceDir: () => void
    onLoadResDirectory: (dir: AndroidResourceDir) => void
    onReplaceExistingChange: (replace: boolean) => void
}

export function StringSidebar({
    projectRootName,
    discoveredResDirs,
    selectedResDir,
    sourceDirName,
    sourceFileCount,
    totalSourceEntries,
    replaceExisting,
    onSelectProjectDir,
    onSelectSourceDir,
    onLoadResDirectory,
    onReplaceExistingChange
}: StringSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const filteredModules = discoveredResDirs.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (!isOpen) setSearchTerm('')
    }, [isOpen])

    return (
        <aside className="w-[280px] border-r bg-white flex-shrink-0 overflow-y-auto">
            <div className="p-6 space-y-6">
                {/* Project (Output) Section */}
                <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        项目
                    </h3>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-10"
                        onClick={onSelectProjectDir}
                    >
                        <FolderOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                            {projectRootName || '选择 Android 项目'}
                        </span>
                    </Button>

                    {/* Module Selection (ComboBox) */}
                    {discoveredResDirs.length > 1 && (
                        <div className="mt-4" ref={containerRef}>
                            <Label className="text-[11px] font-medium text-slate-500 mb-1.5 block uppercase tracking-wider">
                                模块选择
                            </Label>
                            <div className="relative group">
                                <div className="relative">
                                    <Input
                                        ref={inputRef}
                                        placeholder="搜索或选择模块..."
                                        value={isOpen ? searchTerm : (selectedResDir?.name || '')}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value)
                                            if (!isOpen) setIsOpen(true)
                                        }}
                                        onFocus={() => setIsOpen(true)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                                setIsOpen(false)
                                                inputRef.current?.blur()
                                            }
                                        }}
                                        className="h-9 pl-8 pr-8 text-xs bg-slate-50 border-slate-200 focus:bg-white transition-all shadow-sm"
                                    />
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isOpen && (
                                    <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {filteredModules.length > 0 ? (
                                                filteredModules.map((module) => (
                                                    <button
                                                        key={module.path}
                                                        className={`w-full text-left px-3 py-2 text-xs transition-colors truncate
                                                            ${selectedResDir?.path === module.path
                                                                ? 'bg-primary/10 text-primary font-medium'
                                                                : 'hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                        onClick={() => {
                                                            onLoadResDirectory(module)
                                                            setIsOpen(false)
                                                        }}
                                                    >
                                                        {module.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-3 py-2 text-[11px] text-slate-400 text-center">
                                                    未找到匹配模块
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-px bg-border" />

                {/* Source (Input) Section */}
                <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        字符串
                    </h3>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-10"
                        onClick={onSelectSourceDir}
                    >
                        <FolderOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                            {sourceDirName || '选择翻译文件夹'}
                        </span>
                    </Button>

                    {sourceFileCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            {sourceFileCount} 个文件, {totalSourceEntries} 条
                        </p>
                    )}
                </div>

                {/* Options Section */}
                {sourceFileCount > 0 && (
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
                                    onCheckedChange={(checked) => onReplaceExistingChange(!!checked)}
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
    )
}
