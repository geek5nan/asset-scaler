import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Download, Trash2, Loader2, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ImageFile, ConvertConfig } from '@/types'
import { saveConfig, loadConfig, getDefaultConfig } from '@/lib/storage'
import { createImageFile, resizeImage, canvasToWebP, calculateDensities } from '@/lib/imageUtils'
import { Analytics } from '@/lib/analytics'
import JSZip from 'jszip'

interface ConvertedImage {
    density: string
    blob: Blob
}

// Extended ImageFile with processing state
interface ProcessingFile extends ImageFile {
    status: 'ready' | 'processing' | 'error'  // ready = can download, processing = converting
    progress: number
    convertedImages?: ConvertedImage[]
    error?: string
    outputName: string
    isEditing?: boolean
}

// Get recommended output densities based on input scale
function getRecommendedDensities(inputScale: number): string[] {
    switch (inputScale) {
        case 1: return ['mdpi']
        case 2: return ['mdpi', 'hdpi', 'xhdpi']
        case 3: return ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi']
        case 4: return ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
        default: return ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi']
    }
}

export function DrawableProcessor() {
    const [files, setFiles] = useState<ProcessingFile[]>([])
    const [config, setConfig] = useState<ConvertConfig>(getDefaultConfig())
    const [isDragging, setIsDragging] = useState(false)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load config from localStorage on mount
    useEffect(() => {
        const saved = loadConfig()
        if (saved) {
            setConfig(saved)
        }
    }, [])

    // Save config to localStorage when it changes
    useEffect(() => {
        saveConfig(config)
    }, [config])

    const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
        if (!selectedFiles) return

        const fileArray = Array.from(selectedFiles).filter(
            file => file.type.startsWith('image/') &&
                (file.type.includes('png') || file.type.includes('jpeg') || file.type.includes('jpg') || file.type.includes('webp'))
        )

        try {
            const imageFiles = await Promise.all(fileArray.map(createImageFile))
            const processingFiles: ProcessingFile[] = imageFiles.map(f => ({
                ...f,
                status: 'ready' as const,
                progress: 0,
                outputName: f.name.replace(/\.[^.]+$/, '')
            }))
            setFiles(prev => [...prev, ...processingFiles])

            // Track file upload
            const totalSize = imageFiles.reduce((sum, f) => sum + f.size, 0)
            Analytics.fileUpload(imageFiles.length, totalSize)
        } catch (error) {
            console.error('Failed to process files:', error)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent | DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const files = (e as DragEvent).dataTransfer?.files || (e as React.DragEvent).dataTransfer?.files
        if (files) {
            handleFileSelect(files)
        }
    }, [handleFileSelect])

    // Window-level drag events for fullscreen overlay
    useEffect(() => {
        let dragCounter = 0

        const handleWindowDragEnter = (e: DragEvent) => {
            e.preventDefault()
            dragCounter++
            if (e.dataTransfer?.types.includes('Files')) {
                setIsDragging(true)
            }
        }

        const handleWindowDragOver = (e: DragEvent) => {
            e.preventDefault()
        }

        const handleWindowDragLeave = (e: DragEvent) => {
            e.preventDefault()
            dragCounter--
            if (dragCounter <= 0 ||
                e.clientX <= 0 || e.clientY <= 0 ||
                e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                dragCounter = 0
                setIsDragging(false)
            }
        }

        const handleWindowDrop = (e: DragEvent) => {
            e.preventDefault()
            dragCounter = 0
            setIsDragging(false)
            if (e.dataTransfer?.files) {
                handleFileSelect(e.dataTransfer.files)
            }
        }

        const handleDragEnd = () => {
            dragCounter = 0
            setIsDragging(false)
        }

        window.addEventListener('dragenter', handleWindowDragEnter)
        window.addEventListener('dragover', handleWindowDragOver)
        window.addEventListener('dragleave', handleWindowDragLeave)
        window.addEventListener('drop', handleWindowDrop)
        window.addEventListener('dragend', handleDragEnd)

        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter)
            window.removeEventListener('dragover', handleWindowDragOver)
            window.removeEventListener('dragleave', handleWindowDragLeave)
            window.removeEventListener('drop', handleWindowDrop)
            window.removeEventListener('dragend', handleDragEnd)
        }
    }, [handleFileSelect])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    const removeFile = useCallback((id: string) => {
        setFiles(prev => {
            const file = prev.find(f => f.id === id)
            if (file) {
                URL.revokeObjectURL(file.preview)
            }
            return prev.filter(f => f.id !== id)
        })
        Analytics.removeFile()
    }, [])

    const startEditing = useCallback((id: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, isEditing: true } : f
        ))
    }, [])

    const updateOutputName = useCallback((id: string, newName: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, outputName: newName } : f
        ))
    }, [])

    const finishEditing = useCallback((id: string) => {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, isEditing: false } : f
        ))
        Analytics.renameFile()
    }, [])

    const downloadFile = useCallback(async (file: ProcessingFile) => {
        setDownloadingId(file.id)
        try {
            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
            ))

            const densities = calculateDensities(config.inputScale)
            const allDensities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable'] as const
            const convertedImages: ConvertedImage[] = []

            const img = new Image()
            img.src = file.preview

            await new Promise<void>((resolve, reject) => {
                img.onload = async () => {
                    try {
                        const selectedDensities = config.selectedDensities
                        const totalSteps = selectedDensities.length
                        let currentStep = 0

                        for (const densityName of allDensities) {
                            if (!selectedDensities.includes(densityName)) continue

                            const density = densityName === 'drawable' ? densities.mdpi : densities[densityName]
                            const width = Math.round(file.width * density.scale)
                            const height = Math.round(file.height * density.scale)
                            const canvas = resizeImage(img, width, height)
                            const webpBlob = await canvasToWebP(canvas, config.quality, config.lossless)

                            const folderName = densityName === 'drawable' ? 'drawable' : `drawable-${densityName}`
                            convertedImages.push({ density: folderName, blob: webpBlob })

                            currentStep++
                            setFiles(prev => prev.map(f =>
                                f.id === file.id ? { ...f, progress: Math.round((currentStep / totalSteps) * 100) } : f
                            ))
                        }
                        resolve()
                    } catch (error) { reject(error) }
                }
                img.onerror = () => reject(new Error('Failed to load image'))
            })

            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'ready' as const, progress: 100 } : f
            ))

            const zip = new JSZip()
            for (const img of convertedImages!) {
                zip.file(`${img.density}/${file.outputName}.webp`, img.blob)
            }
            const blob = await zip.generateAsync({ type: 'blob' })

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${file.outputName}-drawable.zip`
            a.click()
            URL.revokeObjectURL(url)

            Analytics.downloadAssets(1, 'single')
        } catch (error) {
            setFiles(prev => prev.map(f =>
                f.id === file.id ? { ...f, status: 'error' as const, error: '转换失败' } : f
            ))
        } finally {
            setDownloadingId(null)
        }
    }, [config])

    const downloadAll = useCallback(async () => {
        const readyFiles = files.filter(f => f.status === 'ready')
        if (readyFiles.length === 0) return

        if (readyFiles.length === 1) {
            downloadFile(readyFiles[0])
            return
        }

        setDownloadingId('all')
        try {
            const densities = calculateDensities(config.inputScale)
            const allDensities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable'] as const
            const processedFiles: { file: ProcessingFile; images: ConvertedImage[] }[] = []

            for (const file of readyFiles) {
                setFiles(prev => prev.map(f =>
                    f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
                ))

                const convertedImages: ConvertedImage[] = []
                const img = new Image()
                img.src = file.preview

                await new Promise<void>((resolve, reject) => {
                    img.onload = async () => {
                        try {
                            const selectedDensities = config.selectedDensities
                            for (const densityName of allDensities) {
                                if (!selectedDensities.includes(densityName)) continue
                                const density = densityName === 'drawable' ? densities.mdpi : densities[densityName]
                                const width = Math.round(file.width * density.scale)
                                const height = Math.round(file.height * density.scale)
                                const canvas = resizeImage(img, width, height)
                                const webpBlob = await canvasToWebP(canvas, config.quality, config.lossless)
                                const folderName = densityName === 'drawable' ? 'drawable' : `drawable-${densityName}`
                                convertedImages.push({ density: folderName, blob: webpBlob })
                            }
                            resolve()
                        } catch (error) { reject(error) }
                    }
                    img.onerror = () => reject(new Error('Failed to load image'))
                })

                setFiles(prev => prev.map(f =>
                    f.id === file.id ? { ...f, status: 'ready' as const, progress: 100 } : f
                ))

                processedFiles.push({ file, images: convertedImages })
            }

            const masterZip = new JSZip()
            for (const { file, images } of processedFiles) {
                for (const img of images) {
                    masterZip.file(`${img.density}/${file.outputName}.webp`, img.blob)
                }
            }
            const blob = await masterZip.generateAsync({ type: 'blob' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'drawable-resources.zip'
            a.click()
            URL.revokeObjectURL(url)

            Analytics.downloadAssets(readyFiles.length, 'zip')
        } finally {
            setDownloadingId(null)
        }
    }, [files, downloadFile, config])

    const clearAll = useCallback(() => {
        files.forEach(file => URL.revokeObjectURL(file.preview))
        setFiles([])
    }, [files])

    const readyCount = files.filter(f => f.status === 'ready').length
    const processingCount = files.filter(f => f.status === 'processing').length

    return (
        <div className="flex flex-1 overflow-hidden relative">
            {/* Fullscreen Drag Overlay */}
            {isDragging && (
                <div
                    className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                    onDrop={handleDrop as unknown as React.DragEventHandler}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <div className="bg-white rounded-2xl shadow-2xl p-12 text-center border-2 border-dashed border-primary max-w-lg w-full">
                        <Upload className="h-16 w-16 mx-auto mb-4 text-primary animate-bounce" />
                        <h2 className="text-2xl font-bold mb-2">松开鼠标上传</h2>
                        <p className="text-muted-foreground">支持 PNG、JPG、WebP 格式</p>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <aside className="w-[280px] border-r bg-white flex-shrink-0 overflow-y-auto">
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">输入</h3>
                        <Label className="text-sm font-medium mb-3 block">输入图片倍数</Label>
                        <RadioGroup
                            value={config.inputScale.toString()}
                            onValueChange={(value) => setConfig(prev => ({ ...prev, inputScale: parseInt(value) }))}
                            className="grid grid-cols-2 gap-2"
                        >
                            {[
                                { value: '1', label: '1x', desc: 'mdpi' },
                                { value: '2', label: '2x', desc: 'xhdpi' },
                                { value: '3', label: '3x', desc: 'xxhdpi' },
                                { value: '4', label: '4x', desc: 'xxxhdpi' },
                            ].map(({ value, label, desc }) => (
                                <div
                                    key={value}
                                    className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${config.inputScale.toString() === value
                                        ? 'bg-primary/5 border-primary'
                                        : 'hover:bg-slate-50'
                                        }`}
                                    onClick={() => {
                                        const newScale = parseInt(value)
                                        setConfig(prev => ({
                                            ...prev,
                                            inputScale: newScale,
                                            selectedDensities: getRecommendedDensities(newScale)
                                        }))
                                        Analytics.changeInputScale(newScale)
                                    }}
                                >
                                    <RadioGroupItem value={value} id={`r${value}`} className="sr-only" />
                                    <span className="font-semibold">{label}</span>
                                    <span className="text-xs text-muted-foreground">{desc}</span>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>

                    <div className="h-px bg-border" />

                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">输出</h3>
                        <Label className="text-sm font-medium mb-3 block">编码模式</Label>
                        <RadioGroup
                            value={config.lossless ? 'lossless' : 'lossy'}
                            onValueChange={(value) => {
                                const isLossless = value === 'lossless'
                                setConfig(prev => ({ ...prev, lossless: isLossless }))
                                Analytics.changeEncodingMode(isLossless ? 'lossless' : 'lossy')
                            }}
                            className="space-y-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="lossy" id="lossy" />
                                <Label htmlFor="lossy" className="text-sm cursor-pointer">
                                    Lossy (有损压缩)
                                    <span className="text-xs text-muted-foreground ml-2">文件更小</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="lossless" id="lossless" />
                                <Label htmlFor="lossless" className="text-sm cursor-pointer">
                                    Lossless (无损压缩)
                                    <span className="text-xs text-muted-foreground ml-2">保留原始质量</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div>
                        <Label className="text-sm font-medium mb-3 block">
                            {config.lossless ? '压缩力度' : 'WebP 质量'}
                        </Label>
                        <div className="flex items-center gap-3">
                            <Slider
                                value={[config.quality]}
                                onValueChange={([value]) => {
                                    setConfig(prev => ({ ...prev, quality: value }))
                                }}
                                max={100}
                                min={config.lossless ? 0 : 10}
                                step={1}
                                className="flex-1"
                            />
                            <Input
                                type="number"
                                value={config.quality}
                                onChange={(e) => {
                                    const val = Math.min(100, Math.max(config.lossless ? 0 : 10, parseInt(e.target.value) || 0))
                                    setConfig(prev => ({ ...prev, quality: val }))
                                }}
                                className="w-16 h-8 text-center text-sm"
                                min={config.lossless ? 0 : 10}
                                max={100}
                            />
                        </div>
                        {config.lossless && (
                            <p className="text-xs text-muted-foreground mt-2">
                                0 = 最快压缩，100 = 最小文件
                            </p>
                        )}
                    </div>

                    <div>
                        <Label className="text-sm font-medium mb-3 block">输出目录</Label>
                        <div className="space-y-2">
                            {[
                                { key: 'mdpi', label: 'drawable-mdpi', desc: '1x' },
                                { key: 'hdpi', label: 'drawable-hdpi', desc: '1.5x' },
                                { key: 'xhdpi', label: 'drawable-xhdpi', desc: '2x' },
                                { key: 'xxhdpi', label: 'drawable-xxhdpi', desc: '3x' },
                                { key: 'xxxhdpi', label: 'drawable-xxxhdpi', desc: '4x' },
                                { key: 'drawable', label: 'drawable', desc: '通用' },
                            ].map(({ key, label, desc }) => (
                                <div key={key} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`density-${key}`}
                                        checked={config.selectedDensities.includes(key)}
                                        onCheckedChange={(checked) => {
                                            setConfig(prev => ({
                                                ...prev,
                                                selectedDensities: checked
                                                    ? [...prev.selectedDensities, key]
                                                    : prev.selectedDensities.filter(d => d !== key)
                                            }))
                                            Analytics.toggleDensity(key, !!checked)
                                        }}
                                    />
                                    <Label htmlFor={`density-${key}`} className="text-sm cursor-pointer flex-1">
                                        {label}
                                        <span className="text-xs text-muted-foreground ml-2">({desc})</span>
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Upload Area */}
                <div className="p-6 flex-shrink-0">
                    <div
                        className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'}
          `}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
                        <h2 className="text-lg font-semibold mb-1">
                            {isDragging ? '松开鼠标上传' : '拖拽图片到这里'}
                        </h2>
                        <p className="text-sm text-muted-foreground">支持 PNG、JPG、WebP 格式</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />
                    </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {files.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            <p className="text-sm">暂无文件，请上传图片</p>
                        </div>
                    ) : (
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
                                                    onChange={(e) => updateOutputName(file.id, e.target.value)}
                                                    className="h-7 text-sm"
                                                    autoFocus
                                                    onBlur={() => finishEditing(file.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === 'Escape') finishEditing(file.id)
                                                    }}
                                                />
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => finishEditing(file.id)}>
                                                    <Check className="h-4 w-4 text-green-600" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-medium truncate">{file.outputName}.webp</p>
                                                {file.status === 'ready' && (
                                                    <button onClick={() => startEditing(file.id)} className="text-muted-foreground hover:text-foreground">
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
                                            <Button size="sm" variant="outline" onClick={() => downloadFile(file)} disabled={downloadingId === file.id} className="h-8">
                                                {downloadingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            </Button>
                                        )}
                                        <Button size="sm" variant="ghost" onClick={() => removeFile(file.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom Bar */}
                {files.length > 0 && (
                    <div className="flex-shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {processingCount > 0 && `${processingCount} 个处理中 · `}
                            {readyCount > 0 && `${readyCount} 个待下载`}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={clearAll}>清空全部</Button>
                            {readyCount > 0 && (
                                <Button size="sm" onClick={downloadAll} disabled={downloadingId === 'all'}>
                                    {downloadingId === 'all' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                                    全部下载
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
