import { FolderOpen, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
    onShowModuleDialog: () => void
    onSetReplaceExisting: (replace: boolean) => void
}

const MAX_VISIBLE_MODULES = 4

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
    onShowModuleDialog,
    onSetReplaceExisting
}: StringSidebarProps) {
    const visibleModules = discoveredResDirs.slice(0, MAX_VISIBLE_MODULES)
    const hasMoreModules = discoveredResDirs.length > MAX_VISIBLE_MODULES

    return (
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
                        onClick={onSelectProjectDir}
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
                                            onClick={() => onLoadResDirectory(module)}
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
                                        onClick={onShowModuleDialog}
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
                        onClick={onSelectSourceDir}
                    >
                        <FolderOpen className="h-4 w-4" />
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
                                    onCheckedChange={(checked) => onSetReplaceExisting(!!checked)}
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
