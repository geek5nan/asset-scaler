import { Button } from '@/components/ui/button'
import { AndroidResourceDir } from '@/types'
import { X } from 'lucide-react'

interface ModuleSelectorDialogProps {
    open: boolean
    onClose: () => void
    modules: AndroidResourceDir[]
    selectedModule: AndroidResourceDir | null
    onSelect: (module: AndroidResourceDir) => void
}

export function ModuleSelectorDialog({
    open,
    onClose,
    modules,
    selectedModule,
    onSelect
}: ModuleSelectorDialogProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[60vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold">选择模块</h2>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(60vh-80px)]">
                    <div className="space-y-2">
                        {modules.map((module) => {
                            const isSelected = selectedModule?.path === module.path
                            return (
                                <button
                                    key={module.path}
                                    onClick={() => {
                                        onSelect(module)
                                        onClose()
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${isSelected
                                            ? 'bg-primary/10 border-primary'
                                            : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                                        }`}
                                >
                                    <div className="font-medium">{module.name}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {module.path}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
