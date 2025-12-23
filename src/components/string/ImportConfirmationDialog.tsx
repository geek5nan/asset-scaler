import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ImportConfirmationDialogProps {
    open: boolean
    onClose: () => void
    localeCount: number
    totalAdd: number
    totalUpdate: number
    importComment: string
    onCommentChange: (comment: string) => void
    onConfirm: (comment: string) => void
}

export function ImportConfirmationDialog({
    open,
    onClose,
    localeCount,
    totalAdd,
    totalUpdate,
    importComment,
    onCommentChange,
    onConfirm
}: ImportConfirmationDialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-semibold">确认导入</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="px-6 py-4 space-y-4">
                    <div className="text-sm text-muted-foreground">
                        即将导入 {localeCount} 个语言 · +{totalAdd} 新增 · ~{totalUpdate} 更新
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="import-comment">导入说明（可选）</Label>
                        <Input
                            id="import-comment"
                            value={importComment}
                            onChange={(e) => onCommentChange(e.target.value)}
                            placeholder={`Imported on ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`}
                        />
                        <p className="text-xs text-muted-foreground">
                            这段说明将作为注释添加到导入条目之前
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4 border-t flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={() => onConfirm(importComment || undefined as unknown as string)}>
                        确认导入
                    </Button>
                </div>
            </div>
        </div>
    )
}
