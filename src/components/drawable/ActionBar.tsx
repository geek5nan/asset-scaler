import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActionBarProps {
    readyCount: number
    processingCount: number
    downloadingId: string | null
    onClearAll: () => void
    onDownloadAll: () => void
}

export function ActionBar({
    readyCount,
    processingCount,
    downloadingId,
    onClearAll,
    onDownloadAll
}: ActionBarProps) {
    return (
        <div className="flex-shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
                {processingCount > 0 && `${processingCount} 个处理中 · `}
                {readyCount > 0 && `${readyCount} 个待下载`}
            </p>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClearAll}>清空全部</Button>
                {readyCount > 0 && (
                    <Button size="sm" onClick={onDownloadAll} disabled={downloadingId === 'all'}>
                        {downloadingId === 'all' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                        全部下载
                    </Button>
                )}
            </div>
        </div>
    )
}
