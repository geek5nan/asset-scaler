import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StringActionBarProps {
    localeCount: number
    totalAdd: number
    totalUpdate: number
    canImport: boolean
    canRefresh: boolean
    onOpenImportDialog: () => void
    onRefresh: () => void
}

export function StringActionBar({
    localeCount,
    totalAdd,
    totalUpdate,
    canImport,
    canRefresh,
    onOpenImportDialog,
    onRefresh
}: StringActionBarProps) {
    return (
        <div className="flex-shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={!canRefresh}
                    title="刷新文件"
                    className="h-8 w-8 p-0"
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-border" />
                <p className="text-sm text-muted-foreground">
                    {localeCount} 个语言 · +{totalAdd} 新增 · ~{totalUpdate} 更新
                </p>
            </div>
            <Button
                onClick={onOpenImportDialog}
                disabled={!canImport}
            >
                开始导入
            </Button>
        </div>
    )
}
