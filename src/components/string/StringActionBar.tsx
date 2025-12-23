import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StringActionBarProps {
    localeCount: number
    totalAdd: number
    totalUpdate: number
    isMerging: boolean
    canImport: boolean
    onOpenImportDialog: () => void
}

export function StringActionBar({
    localeCount,
    totalAdd,
    totalUpdate,
    isMerging,
    canImport,
    onOpenImportDialog
}: StringActionBarProps) {
    return (
        <div className="flex-shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
                {localeCount} 个语言 · +{totalAdd} 新增 · ~{totalUpdate} 更新
            </p>
            <Button
                onClick={onOpenImportDialog}
                disabled={isMerging || !canImport}
            >
                {isMerging ? (
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        合并中...
                    </>
                ) : (
                    '开始导入'
                )}
            </Button>
        </div>
    )
}
