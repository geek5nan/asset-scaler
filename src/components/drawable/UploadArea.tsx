import { Upload } from 'lucide-react'

interface UploadAreaProps {
    isDragging: boolean
    onDrop: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onClick: () => void
    inputRef: React.RefObject<HTMLInputElement>
    onFileSelect: (files: FileList | null) => void
}

export function UploadArea({
    isDragging,
    onDrop,
    onDragOver,
    onDragLeave,
    onClick,
    inputRef,
    onFileSelect
}: UploadAreaProps) {
    return (
        <>
            {/* Fullscreen Drag Overlay */}
            {isDragging && (
                <div
                    className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                    onDrop={onDrop}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <div className="bg-white rounded-2xl shadow-2xl p-12 text-center border-2 border-dashed border-primary max-w-lg w-full">
                        <Upload className="h-16 w-16 mx-auto mb-4 text-primary animate-bounce" />
                        <h2 className="text-2xl font-bold mb-2">松开鼠标上传</h2>
                        <p className="text-muted-foreground">支持 PNG、JPG、WebP 格式</p>
                    </div>
                </div>
            )}

            <div className="p-6 flex-shrink-0">
                <div
                    className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'}
          `}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={onClick}
                >
                    <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
                    <h2 className="text-lg font-semibold mb-1">
                        {isDragging ? '松开鼠标上传' : '拖拽图片到这里'}
                    </h2>
                    <p className="text-sm text-muted-foreground">支持 PNG、JPG、WebP 格式</p>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => onFileSelect(e.target.files)}
                    />
                </div>
            </div>
        </>
    )
}
