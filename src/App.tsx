import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, Upload, Download, Trash2, CheckCircle2, Loader2, Pencil, Check } from 'lucide-react'
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
import JSZip from 'jszip'

// 存储转换后的图片数据
interface ConvertedImage {
  density: string
  blob: Blob
}

// Extended ImageFile with processing state
interface ProcessingFile extends ImageFile {
  status: 'ready' | 'processing' | 'done' | 'error'  // ready = uploaded, waiting for download
  progress: number
  convertedImages?: ConvertedImage[] // 存储各密度的转换结果
  error?: string
  outputName: string
  isEditing?: boolean
}

function App() {
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

  // No auto-process - conversion happens when user clicks download

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
        status: 'ready' as const,  // Ready for download, not yet processed
        progress: 0,
        outputName: f.name.replace(/\.[^.]+$/, '')
      }))
      setFiles(prev => [...prev, ...processingFiles])
    } catch (error) {
      console.error('Failed to process files:', error)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
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
  }, [])

  // 下载时先转换（如果还没转换），然后打包 ZIP
  const downloadFile = useCallback(async (file: ProcessingFile) => {
    setDownloadingId(file.id)

    try {
      let convertedImages = file.convertedImages

      // If not yet processed, process now with current config
      if (file.status === 'ready' || !convertedImages || convertedImages.length === 0) {
        // Update status to processing
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
        ))

        const densities = calculateDensities(config.inputScale)
        const allDensities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable'] as const
        convertedImages = []

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
                convertedImages!.push({ density: folderName, blob: webpBlob })

                currentStep++
                setFiles(prev => prev.map(f =>
                  f.id === file.id ? { ...f, progress: Math.round((currentStep / totalSteps) * 100) } : f
                ))
              }
              resolve()
            } catch (error) {
              reject(error)
            }
          }
          img.onerror = () => reject(new Error('Failed to load image'))
        })

        // Update file with converted images
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: 'done' as const, progress: 100, convertedImages } : f
        ))
      }

      // Now generate and download ZIP
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
    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, status: 'error' as const, error: '转换失败' } : f
      ))
    } finally {
      setDownloadingId(null)
    }
  }, [config])

  const downloadAll = useCallback(async () => {
    const readyOrDoneFiles = files.filter(f => f.status === 'ready' || f.status === 'done')
    if (readyOrDoneFiles.length === 0) return

    if (readyOrDoneFiles.length === 1) {
      downloadFile(readyOrDoneFiles[0])
      return
    }

    setDownloadingId('all')
    try {
      // Process all ready files first
      const densities = calculateDensities(config.inputScale)
      const allDensities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'drawable'] as const

      const processedFiles: { file: ProcessingFile; images: ConvertedImage[] }[] = []

      for (const file of readyOrDoneFiles) {
        let convertedImages = file.convertedImages

        if (file.status === 'ready' || !convertedImages || convertedImages.length === 0) {
          setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
          ))

          convertedImages = []
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
                  convertedImages!.push({ density: folderName, blob: webpBlob })
                }
                resolve()
              } catch (error) {
                reject(error)
              }
            }
            img.onerror = () => reject(new Error('Failed to load image'))
          })

          setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'done' as const, progress: 100, convertedImages } : f
          ))
        }

        processedFiles.push({ file, images: convertedImages! })
      }

      // Generate combined ZIP
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
    } finally {
      setDownloadingId(null)
    }
  }, [files, downloadFile, config])

  const clearAll = useCallback(() => {
    files.forEach(file => URL.revokeObjectURL(file.preview))
    setFiles([])
  }, [files])

  const doneCount = files.filter(f => f.status === 'done').length
  const processingCount = files.filter(f => f.status === 'processing').length

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="h-14 border-b bg-white flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">AssetScaler</h1>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[280px] border-r bg-white flex-shrink-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Input Scale */}
            <div>
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
                    onClick={() => setConfig(prev => ({ ...prev, inputScale: parseInt(value) }))}
                  >
                    <RadioGroupItem value={value} id={`r${value}`} className="sr-only" />
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Encoding Mode - Match Android Studio */}
            <div>
              <Label className="text-sm font-medium mb-3 block">编码模式</Label>
              <RadioGroup
                value={config.lossless ? 'lossless' : 'lossy'}
                onValueChange={(value) => setConfig(prev => ({ ...prev, lossless: value === 'lossless' }))}
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

            <div className="h-px bg-border" />

            {/* Quality */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm font-medium">
                  {config.lossless ? '压缩力度' : 'WebP 质量'}
                </Label>
                <Badge variant="secondary">{config.quality}%</Badge>
              </div>
              {!config.lossless && (
                <div className="flex gap-2 mb-3">
                  {[50, 75, 90].map(q => (
                    <button
                      key={q}
                      onClick={() => setConfig(prev => ({ ...prev, quality: q }))}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${config.quality === q
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 hover:bg-slate-200'
                        }`}
                    >
                      {q === 50 ? '低' : q === 75 ? '中' : '高'}
                    </button>
                  ))}
                </div>
              )}
              <Slider
                value={[config.quality]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, quality: value }))}
                max={100}
                min={config.lossless ? 0 : 10}
                step={1}
                className="w-full"
              />
              {config.lossless && (
                <p className="text-xs text-muted-foreground mt-2">
                  0 = 最快压缩，100 = 最小文件
                </p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* 输出目录选择 */}
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

            {/* Tip */}
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-muted-foreground">💾 设置会自动保存</p>
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
                ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'
                }
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
              <p className="text-sm text-muted-foreground">
                支持 PNG、JPG、WebP 格式
              </p>
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
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-3 bg-white rounded-lg border"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>

                    {/* Info & Progress */}
                    <div className="flex-1 min-w-0">
                      {/* Editable filename */}
                      {file.isEditing ? (
                        <div className="flex items-center gap-2 mb-1">
                          <Input
                            value={file.outputName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateOutputName(file.id, e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onBlur={() => finishEditing(file.id)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') finishEditing(file.id)
                              if (e.key === 'Escape') finishEditing(file.id)
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => finishEditing(file.id)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{file.outputName}.webp</p>
                          {file.status === 'done' && (
                            <button
                              onClick={() => startEditing(file.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {file.width} × {file.height} · {(file.size / 1024).toFixed(1)} KB
                      </p>
                      {file.status === 'processing' && (
                        <Progress value={file.progress} className="h-1 mt-1.5" />
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {file.status === 'processing' && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{file.progress}%</span>
                        </div>
                      )}
                      {file.status === 'ready' && (
                        <Badge variant="secondary" className="text-xs">待下载</Badge>
                      )}
                      {file.status === 'done' && downloadingId !== file.id && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(file.status === 'ready' || file.status === 'done') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(file)}
                          disabled={downloadingId === file.id}
                          className="h-8"
                        >
                          {downloadingId === file.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(file.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
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
                {doneCount > 0 && `${doneCount} 个已完成`}
                {processingCount === 0 && doneCount === 0 && `${files.length} 个待处理`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAll}>
                  清空全部
                </Button>
                {doneCount > 0 && (
                  <Button size="sm" onClick={downloadAll} disabled={downloadingId === 'all'}>
                    {downloadingId === 'all' ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    全部下载
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
