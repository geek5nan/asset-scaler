import { Trash2, Loader2, Pencil, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ProcessingFile } from '@/types'

interface FileListProps {
    files: ProcessingFile[]
    downloadingId: string | null
    onRemove: (id: string) => void
    onStartEdit: (id: string) => void
    onUpdateOutputName: (id: string, name: string) => void
    onFinishEdit: (id: string) => void
    onDownload: (file: ProcessingFile) => void
}

export function FileList({
    files,
    downloadingId,
    onRemove,
    onStartEdit,
    onUpdateOutputName,
    onFinishEdit,
    onDownload
}: FileListProps) {
    if (files.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">暂无文件，请上传图片</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-2">
                {files.map((file) => (
                    <div key={file.id} className="flex items-center gap-4 p-3 bg-white rounded-lg border">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                            <img src={file.preview} alt={file.name} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            {file.isEditing ? (
                                <div className="flex items-center gap-2 mb-1">
                                    <Input
                                        value={file.outputName}
                                        onChange={(e) => onUpdateOutputName(file.id, e.target.value)}
                                        className="h-7 text-sm"
                                        autoFocus
                                        onBlur={() => onFinishEdit(file.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === 'Escape') onFinishEdit(file.id)
                                        }}
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onFinishEdit(file.id)}>
                                        <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium truncate">{file.outputName}.webp</p>
                                    {file.status === 'ready' && (
                                        <button onClick={() => onStartEdit(file.id)} className="text-muted-foreground hover:text-foreground">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">{file.width} × {file.height} · {(file.size / 1024).toFixed(1)} KB</p>
                            {file.status === 'processing' && <Progress value={file.progress} className="h-1 mt-1.5" />}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {file.status === 'processing' && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{file.progress}%</span>
                                </div>
                            )}
                            {file.status === 'ready' && downloadingId !== file.id && (
                                <Badge variant="secondary" className="text-xs">待下载</Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {file.status === 'ready' && (
                                <Button size="sm" variant="outline" onClick={() => onDownload(file)} disabled={downloadingId === file.id} className="h-8">
                                    {downloadingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => onRemove(file.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
