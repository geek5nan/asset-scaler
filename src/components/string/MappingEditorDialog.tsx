import { useRef, useEffect } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocaleMapping } from '@/types'

interface MappingEditorDialogProps {
    open: boolean
    onClose: () => void
    mappings: LocaleMapping[]
    focusIndex: number | null
    onToggle: (index: number) => void
    onUpdate: (index: number, updates: Partial<LocaleMapping>) => void
    onResetOne: (index: number) => void
    onResetAll: () => void
    onSave: () => void
}

export function MappingEditorDialog({
    open,
    onClose,
    mappings,
    focusIndex,
    onToggle,
    onUpdate,
    onResetOne,
    onResetAll,
    onSave
}: MappingEditorDialogProps) {
    const dialogListRef = useRef<HTMLDivElement>(null)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Scroll to and focus item in dialog
    useEffect(() => {
        if (open && focusIndex !== null && dialogListRef.current) {
            const item = dialogListRef.current.children[focusIndex] as HTMLElement
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                    inputRefs.current[focusIndex]?.focus()
                    inputRefs.current[focusIndex]?.select()
                }, 100)
            }
        }
    }, [open, focusIndex])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold">编辑导入规则</h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-slate-500 hover:text-primary"
                            onClick={onResetAll}
                            title="恢复全部分配建议"
                        >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            全部重置
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div ref={dialogListRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {mappings.map((m, idx) => (
                        <div
                            key={m.sourceFileName}
                            className={`p-3 rounded-lg border transition-colors ${focusIndex === idx
                                ? 'border-primary/50 bg-primary/[0.03]'
                                : 'bg-slate-50 border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <Checkbox
                                    checked={m.enabled}
                                    onCheckedChange={() => onToggle(idx)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm font-medium text-slate-700">
                                    {m.sourceFileName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 ml-7">
                                <Label className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">目标:</Label>
                                <Input
                                    ref={el => inputRefs.current[idx] = el}
                                    value={m.targetFolder}
                                    onChange={(e) => onUpdate(idx, { targetFolder: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            onSave()
                                        }
                                    }}
                                    className="h-9 text-sm font-mono flex-1 bg-white focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-slate-300"
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 text-slate-400 hover:text-primary"
                                    onClick={() => onResetOne(idx)}
                                    title="恢复建议值"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-4 border-t flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={onSave}>保存配置</Button>
                </div>
            </div>
        </div>
    )
}
